import { getFirebaseAdminAuth } from '../firebaseAdmin.js';

function looksLikeAdminCredentialError(e) {
  const msg = (e && typeof e.message === 'string' ? e.message : String(e || '')).toLowerCase();
  const code = e && typeof e.code === 'string' ? e.code.toLowerCase() : '';
  return (
    code.includes('invalid-credential') ||
    code.includes('app/invalid-credential') ||
    msg.includes('default credentials') ||
    msg.includes('could not load the default credentials') ||
    msg.includes('invalid credential') ||
    msg.includes('service account') ||
    msg.includes('credential') ||
    msg.includes('failed to parse private key')
  );
}

export async function requireAuth(req, res, next) {
  // Automated tests only: never enable ALLOW_TEST_AUTH in deployed environments.
  if (process.env.ALLOW_TEST_AUTH === 'true') {
    const testUid = req.headers['x-test-user-id'];
    if (typeof testUid === 'string' && testUid.trim()) {
      req.userId = testUid.trim();
      req.firebase = { uid: req.userId, email: null };
      const out = next();
      if (out && typeof out.then === 'function') await out;
      return;
    }
  }

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
  } catch (e) {
    // If Admin credentials are missing/misconfigured, returning 401 is misleading.
    if (looksLikeAdminCredentialError(e)) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Firebase Admin credential/config error while verifying ID token:', e);
      }
      return res.status(500).json({
        error:
          'Auth verification is misconfigured on the server (Firebase Admin credentials). Check GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_JSON.',
        code: 'server_auth_misconfigured',
      });
    }
    return res.status(401).json({ error: 'Invalid or expired token', code: 'unauthorized' });
  }
}
