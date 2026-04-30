/** Same rules as the web app: server tokens are base64url from randomBytes(24). */
export function isPlausibleInviteToken(s) {
  const x = String(s ?? '').trim();
  if (x.length < 16 || x.length > 200) return false;
  return /^[A-Za-z0-9_-]+$/.test(x);
}
