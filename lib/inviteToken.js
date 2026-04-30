import crypto from 'node:crypto';

/** URL-safe token for ?invite= links (stored on `users.inviteToken`). */
export function generateInviteToken() {
  return crypto.randomBytes(24).toString('base64url');
}
