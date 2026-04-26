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
  const contentType = sanitizeImageContentType(file?.mimetype);
  if (!contentType) {
    throw new Error(`Unsupported contentType for ${kind}`);
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
    } catch (_e) {
      return err(res, 'Could not store verification documents', 500, 'storage_error');
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
    await upsertUser(u);
    return ok(
      res,
      {
        verificationStatus: 'pending',
        message: 'Verification submitted. Review takes 1-2 business days.',
      },
      201,
    );
  } catch (_e) {
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
