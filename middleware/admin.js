export function requireAdmin(req, res, next) {
  const uid = req.userId;
  const claims = req.firebase && typeof req.firebase === 'object' ? req.firebase : null;

  const hasClaim = Boolean(claims && (claims.admin === true || claims.isAdmin === true));

  const allowUids = String(process.env.ADMIN_UIDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const allowEmails = String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const email =
    claims && typeof claims.email === 'string' ? String(claims.email).toLowerCase() : null;
  const uidAllowed = uid && allowUids.includes(String(uid));
  const emailAllowed = email && allowEmails.includes(String(email));

  if (hasClaim || uidAllowed || emailAllowed) return next();
  return res.status(403).json({ error: 'Forbidden', code: 'forbidden' });
}

