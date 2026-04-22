import { getUserById, upsertUser } from '../store.js';
import { ok, err } from '../utils/http.js';

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
    u.verificationStatus = 'pending';
    u._verification = {
      submittedAt,
      estimatedCompletion: new Date(Date.now() + 2 * 86400000).toISOString(),
      fileSizes: { front: front.size, back: back.size, selfie: selfie.size },
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
