import { getUserById, upsertUser } from '../store.js';
import { ok, err } from '../utils/http.js';
import { getFirebaseAdminStorageBucket } from '../firebaseAdmin.js';

function sanitizeImageContentType(ct) {
  const t = String(ct || '').toLowerCase();
  if (t === 'image/jpeg' || t === 'image/jpg') return 'image/jpeg';
  if (t === 'image/png') return 'image/png';
  if (t === 'image/webp') return 'image/webp';
  if (t === 'image/heic' || t === 'image/heif') return t;
  return null;
}

/** Some mobile browsers send empty or generic mimetype; infer from original filename. */
function inferContentTypeFromOriginalName(originalname) {
  const n = String(originalname || '').toLowerCase();
  if (n.endsWith('.png')) return 'image/png';
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg';
  if (n.endsWith('.webp')) return 'image/webp';
  if (n.endsWith('.heic')) return 'image/heic';
  if (n.endsWith('.heif')) return 'image/heif';
  return null;
}

function extForContentType(ct) {
  switch (ct) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/heic':
      return 'heic';
    case 'image/heif':
      return 'heif';
    case 'image/jpeg':
    default:
      return 'jpg';
  }
}

async function uploadVerificationImage({ userId, kind, file, submittedAt }) {
  const bucket = getFirebaseAdminStorageBucket();
  let contentType = sanitizeImageContentType(file?.mimetype);
  if (!contentType && file?.originalname) {
    contentType = inferContentTypeFromOriginalName(file.originalname);
  }
  if (!contentType) {
    throw new Error(`Unsupported contentType for ${kind} (mimetype=${file?.mimetype}, name=${file?.originalname})`);
  }
  const ext = extForContentType(contentType);
  const ts = Date.parse(String(submittedAt));
  const safeTs = Number.isFinite(ts) ? ts : Date.now();
  const objectPath = `verification/${String(userId)}/${safeTs}/${kind}.${ext}`;
  const gcsFile = bucket.file(objectPath);
  await gcsFile.save(file.buffer, {
    resumable: false,
    metadata: {
      contentType,
      cacheControl: 'private, max-age=0, no-transform',
      metadata: {
        userId: String(userId),
        kind: String(kind),
        submittedAt: String(submittedAt),
      },
    },
  });
  return { bucket: bucket.name, path: objectPath, contentType, size: file.size };
}

async function cleanupPreviousVerificationFiles(user) {
  const prev = user?._verification?.files;
  if (!prev) return;
  const paths = [
    prev.governmentIdFront?.path,
    prev.governmentIdBack?.path,
    prev.selfieImage?.path,
  ].filter((p) => typeof p === 'string' && p.trim());

  if (paths.length === 0) return;

  const bucket = getFirebaseAdminStorageBucket();
  await Promise.all(
    paths.map((p) =>
      bucket
        .file(String(p))
        .delete({ ignoreNotFound: true })
        .catch(() => null),
    ),
  );
}

export async function submitVerification(req, res) {
  try {
    const files = req.files ?? {};
    const front = files.governmentIdFront?.[0];
    const back = files.governmentIdBack?.[0];
    const selfie = files.selfieImage?.[0];
    if (!front || !back || !selfie) {
      return err(
        res,
        'governmentIdFront, governmentIdBack, and selfieImage are required',
        400,
        'validation_error',
      );
    }
    const {
      ssn,
      dateOfBirth,
      phoneNumber,
      addressStreet,
      addressCity,
      addressState,
      addressZip,
    } = req.body ?? {};
    const required = {
      ssn,
      dateOfBirth,
      phoneNumber,
      addressStreet,
      addressCity,
      addressState,
      addressZip,
    };
    for (const [k, v] of Object.entries(required)) {
      if (typeof v !== 'string' || !v.trim()) {
        return err(res, `${k} is required`, 400, 'validation_error');
      }
    }
    const u = await getUserById(req.userId);
    if (!u) return err(res, 'User not found', 404, 'not_found');
    const submittedAt = new Date().toISOString();

    if (!front?.buffer || !back?.buffer || !selfie?.buffer) {
      return err(res, 'File uploads missing data', 400, 'validation_error');
    }

    // Best-effort cleanup — must never block a new submission (delete/IAM can fail in prod).
    try {
      await cleanupPreviousVerificationFiles(u);
    } catch (e) {
      console.warn('verification submit: skipped cleanup of previous verification files', e);
    }

    // Upload images to Firebase Storage (manual verification workflow).
    let frontObj;
    let backObj;
    let selfieObj;
    try {
      [frontObj, backObj, selfieObj] = await Promise.all([
        uploadVerificationImage({ userId: req.userId, kind: 'governmentIdFront', file: front, submittedAt }),
        uploadVerificationImage({ userId: req.userId, kind: 'governmentIdBack', file: back, submittedAt }),
        uploadVerificationImage({ userId: req.userId, kind: 'selfieImage', file: selfie, submittedAt }),
      ]);
    } catch (e) {
      console.error('verification submit: storage upload failed', e);
      const text = e instanceof Error ? e.message : String(e);
      const perm =
        /403|permission|access denied|forbidden|does not have storage/i.test(text) ||
        (typeof e === 'object' && e !== null && Number(e.code) === 403);
      const hint = perm
        ? 'Storage permission denied. Grant the Cloud Run service account Storage Object Admin (or object create) on your bucket.'
        : 'Could not store verification documents. Check STORAGE_BUCKET, bucket IAM, and image format.';
      return err(res, hint, 500, 'storage_error');
    }

    u.verificationStatus = 'pending';
    u._verification = {
      submittedAt,
      estimatedCompletion: new Date(Date.now() + 2 * 86400000).toISOString(),
      files: {
        governmentIdFront: frontObj,
        governmentIdBack: backObj,
        selfieImage: selfieObj,
      },
      ssnLast4: String(ssn).trim().slice(-4),
      dateOfBirth: String(dateOfBirth).trim(),
      phoneNumber: String(phoneNumber).trim(),
      address: {
        street: String(addressStreet).trim(),
        city: String(addressCity).trim(),
        state: String(addressState).trim(),
        zip: String(addressZip).trim(),
      },
    };
    try {
      await upsertUser(u);
    } catch (e) {
      console.error('verification submit: firestore upsert failed', e);
      return err(res, 'Could not save verification record', 500, 'firestore_error');
    }
    return ok(
      res,
      {
        verificationStatus: 'pending',
        message: 'Verification submitted. Review takes 1-2 business days.',
      },
      201,
    );
  } catch (e) {
    const code = typeof e === 'object' && e !== null && 'code' in e ? e.code : undefined;
    const msg = e instanceof Error ? e.message : String(e);
    console.error('verification submit: internal error', { code, msg, err: e });
    return err(res, 'Internal error', 500, 'internal');
  }
}

export async function getVerificationStatus(req, res) {
  try {
    const u = await getUserById(req.userId);
    if (!u) return err(res, 'User not found', 404, 'not_found');
    const v = u._verification;
    if (!v) {
      return ok(res, {
        verificationStatus: u.verificationStatus,
        submittedAt: null,
        estimatedCompletion: null,
      });
    }
    return ok(res, {
      verificationStatus: u.verificationStatus,
      submittedAt: v.submittedAt,
      estimatedCompletion: v.estimatedCompletion,
    });
  } catch (_e) {
    return err(res, 'Internal error', 500, 'internal');
  }
}
