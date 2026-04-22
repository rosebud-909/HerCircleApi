import { getFirebaseAdminAuth } from '../firebaseAdmin.js';

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', code: 'unauthorized' });
  }
  const token = header.slice(7);

  try {
    const decoded = await getFirebaseAdminAuth().verifyIdToken(token);
    req.userId = decoded.uid;
    req.firebase = decoded;
    const out = next();
    if (out && typeof out.then === 'function') await out;
    return;
  } catch (_e) {
    return res.status(401).json({ error: 'Invalid or expired token', code: 'unauthorized' });
  }
}
