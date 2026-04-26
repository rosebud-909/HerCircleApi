import { getFirebaseAdminAuth } from '../firebaseAdmin.js';

function parseUidAllowlist() {
  return new Set(
    String(process.env.ADMIN_UIDS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

function parseEmailAllowlist() {
  return new Set(
    String(process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * Resolve admin role per user id for Community directory rules.
 * Uses ADMIN_UIDS / ADMIN_EMAILS (from profile email) and, when Firebase is available,
 * Auth custom claims on each uid.
 *
 * @param {Array<{ id: string, email?: string | null }>} users
 * @returns {Promise<Map<string, boolean>>}
 */
export async function buildAdminFlagsMap(users) {
  const allowUids = parseUidAllowlist();
  const allowEmails = parseEmailAllowlist();

  const map = new Map();
  for (const u of users) {
    if (!u?.id) continue;
    let v = allowUids.has(u.id);
    const em = typeof u.email === 'string' ? u.email.trim().toLowerCase() : '';
    if (!v && em && allowEmails.has(em)) v = true;
    map.set(u.id, v);
  }

  const testNoFirebase = process.env.ALLOW_TEST_AUTH === 'true';
  if (testNoFirebase) return map;

  try {
    const auth = getFirebaseAdminAuth();
    const uids = [...new Set(users.map((u) => u.id).filter(Boolean))];
    for (let i = 0; i < uids.length; i += 100) {
      const chunk = uids.slice(i, i + 100);
      const result = await auth.getUsers(chunk.map((uid) => ({ uid })));
      for (const r of result.users) {
        const c = r.customClaims || {};
        const email = (r.email || '').toLowerCase();
        if (c.admin === true || c.isAdmin === true || allowEmails.has(email)) {
          map.set(r.uid, true);
        }
      }
    }
  } catch {
    /* Missing credentials locally — env allowlists only */
  }

  return map;
}
