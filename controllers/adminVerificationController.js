import { getFirebaseAdminFirestore, getFirebaseAdminStorageBucket } from '../firebaseAdmin.js';
import { ok, err } from '../utils/http.js';

const USERS = 'users';

function db() {
  return getFirebaseAdminFirestore();
}

async function signedUrlForPath(path) {
  const bucket = getFirebaseAdminStorageBucket();
  const f = bucket.file(String(path));
  const [url] = await f.getSignedUrl({
    action: 'read',
    expires: Date.now() + 15 * 60 * 1000, // 15 minutes
  });
  return url;
}

export async function listPending(req, res) {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const qs = await db().collection(USERS).where('verificationStatus', '==', 'pending').limit(limit).get();
    const rows = qs.docs.map((d) => ({ id: d.id, ...d.data() }));
    const out = rows.map((u) => ({
      id: String(u.id),
      name: u.name ?? null,
      email: u.email ?? null,
      submittedAt: u._verification?.submittedAt ?? null,
      estimatedCompletion: u._verification?.estimatedCompletion ?? null,
      verificationStatus: u.verificationStatus ?? 'unverified',
    }));
    return ok(res, { users: out });
  } catch (_e) {
    return err(res, 'Internal error', 500, 'internal');
  }
}

export async function getOne(req, res) {
  try {
    const userId = String(req.params.userId || '');
    if (!userId) return err(res, 'userId is required', 400, 'validation_error');
    const snap = await db().collection(USERS).doc(userId).get();
    if (!snap.exists) return err(res, 'User not found', 404, 'not_found');
    const u = { id: snap.id, ...snap.data() };
    const v = u._verification;
    if (!v?.files) {
      return ok(res, {
        user: {
          id: String(u.id),
          name: u.name ?? null,
          email: u.email ?? null,
          verificationStatus: u.verificationStatus ?? 'unverified',
        },
        verification: null,
      });
    }

    const frontPath = v.files.governmentIdFront?.path;
    const backPath = v.files.governmentIdBack?.path;
    const selfiePath = v.files.selfieImage?.path;
    if (!frontPath || !backPath || !selfiePath) {
      return err(res, 'Verification files are missing', 500, 'internal');
    }

    const [frontUrl, backUrl, selfieUrl] = await Promise.all([
      signedUrlForPath(frontPath),
      signedUrlForPath(backPath),
      signedUrlForPath(selfiePath),
    ]);

    return ok(res, {
      user: {
        id: String(u.id),
        name: u.name ?? null,
        email: u.email ?? null,
        verificationStatus: u.verificationStatus ?? 'unverified',
      },
      verification: {
        submittedAt: v.submittedAt ?? null,
        estimatedCompletion: v.estimatedCompletion ?? null,
        ssnLast4: v.ssnLast4 ?? null,
        dateOfBirth: v.dateOfBirth ?? null,
        phoneNumber: v.phoneNumber ?? null,
        address: v.address ?? null,
        files: {
          governmentIdFront: { url: frontUrl, meta: v.files.governmentIdFront ?? null },
          governmentIdBack: { url: backUrl, meta: v.files.governmentIdBack ?? null },
          selfieImage: { url: selfieUrl, meta: v.files.selfieImage ?? null },
        },
        review: v.review ?? null,
      },
    });
  } catch (_e) {
    return err(res, 'Internal error', 500, 'internal');
  }
}

export async function decide(req, res) {
  try {
    const userId = String(req.params.userId || '');
    const status = req.body?.status;
    const reason = req.body?.reason;
    if (!userId) return err(res, 'userId is required', 400, 'validation_error');
    if (status !== 'verified' && status !== 'rejected') {
      return err(res, 'status must be verified or rejected', 400, 'validation_error');
    }
    const snap = await db().collection(USERS).doc(userId).get();
    if (!snap.exists) return err(res, 'User not found', 404, 'not_found');
    const u = { id: snap.id, ...snap.data() };
    const now = new Date().toISOString();
    const patch = {
      verificationStatus: status,
      ...(status === 'verified' ? { verifiedAt: now } : { verifiedAt: null }),
      _verification: {
        ...(u._verification ?? {}),
        review: {
          decidedAt: now,
          decidedBy: req.userId ?? null,
          status,
          ...(typeof reason === 'string' && reason.trim() ? { reason: reason.trim() } : {}),
        },
      },
    };
    await db().collection(USERS).doc(userId).set(patch, { merge: true });
    return ok(res, { userId, verificationStatus: status });
  } catch (_e) {
    return err(res, 'Internal error', 500, 'internal');
  }
}

