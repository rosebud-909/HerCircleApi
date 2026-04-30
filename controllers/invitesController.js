import { isPlausibleInviteToken } from '../lib/inviteTokenShape.js';
import { evaluateInviteTokenForNewUser, inviteOnlyDisabled } from '../services/inviteEligibility.js';
import { ok, err } from '../utils/http.js';

/**
 * GET /invites/validate?token=… — public, rate-limited.
 * Returns whether signups currently require an invite and whether the given token is acceptable.
 */
export async function validateInviteQuery(req, res) {
  try {
    const inviteRequired = !inviteOnlyDisabled();
    if (!inviteRequired) {
      return ok(res, { inviteRequired: false, valid: true });
    }

    const token = String(req.query.token || '').trim();
    if (!token) {
      return ok(res, { inviteRequired: true, valid: false });
    }

    const bootstrap = String(process.env.INVITE_BOOTSTRAP_TOKEN || '').trim();
    if (bootstrap && token === bootstrap) {
      return ok(res, { inviteRequired: true, valid: true });
    }

    if (!isPlausibleInviteToken(token)) {
      return ok(res, { inviteRequired: true, valid: false });
    }

    const ev = await evaluateInviteTokenForNewUser(token);
    return ok(res, { inviteRequired: true, valid: ev.valid });
  } catch (_e) {
    return err(res, 'Internal error', 500, 'internal');
  }
}
