import { buildAdminFlagsMap } from '../lib/adminFlags.js';
import { getUserByInviteToken, listUsersInvitedBy } from '../store.js';

export const NON_ADMIN_INVITE_CAP = 5;

/** When `INVITE_ONLY` is exactly `false`, new profiles do not require an invite (local/tests). */
export function inviteOnlyDisabled() {
  return String(process.env.INVITE_ONLY || '').trim().toLowerCase() === 'false';
}

export async function inviterIsAdminForCap(inviter) {
  const map = await buildAdminFlagsMap([inviter]);
  return map.get(inviter.id) === true;
}

/**
 * Shared Firestore/bootstrap rules for whether a token can create a new profile.
 * @param {string} token - trimmed invite token (may be empty when checking "open signup").
 * @returns {Promise<{ valid: boolean, invitedByUserId: string | null, code: string }>}
 */
export async function evaluateInviteTokenForNewUser(token) {
  const trimmed = typeof token === 'string' ? token.trim() : '';
  if (inviteOnlyDisabled()) {
    return { valid: true, invitedByUserId: null, code: 'invite_disabled' };
  }
  if (!trimmed) {
    return { valid: false, invitedByUserId: null, code: 'missing' };
  }
  const bootstrap = String(process.env.INVITE_BOOTSTRAP_TOKEN || '').trim();
  if (bootstrap && trimmed === bootstrap) {
    return { valid: true, invitedByUserId: null, code: 'bootstrap' };
  }
  const inviter = await getUserByInviteToken(trimmed);
  if (!inviter) {
    return { valid: false, invitedByUserId: null, code: 'invalid' };
  }
  const adminInviter = await inviterIsAdminForCap(inviter);
  if (!adminInviter) {
    const invitees = await listUsersInvitedBy(inviter.id);
    if (invitees.length >= NON_ADMIN_INVITE_CAP) {
      return { valid: false, invitedByUserId: null, code: 'cap' };
    }
  }
  return { valid: true, invitedByUserId: inviter.id, code: 'ok' };
}

/**
 * @param {object} body - request body (register / google / upsertMe)
 * @returns {Promise<{ invitedByUserId: string | null }>}
 */
export async function resolveInviteForNewProfile(body) {
  if (inviteOnlyDisabled()) {
    return { invitedByUserId: null };
  }

  const raw = body?.inviteToken ?? body?.invite;
  const token = typeof raw === 'string' ? raw.trim() : '';
  if (!token) {
    const err = new Error('An invitation is required to join.');
    err.code = 'invite_required';
    err.status = 403;
    throw err;
  }

  const ev = await evaluateInviteTokenForNewUser(token);
  if (!ev.valid) {
    const err = new Error(
      ev.code === 'cap'
        ? 'This invitation link has reached its member limit.'
        : 'This invitation link is not valid.',
    );
    err.code = ev.code === 'cap' ? 'invite_cap_reached' : 'invalid_invite';
    err.status = 403;
    throw err;
  }

  return { invitedByUserId: ev.invitedByUserId ?? null };
}
