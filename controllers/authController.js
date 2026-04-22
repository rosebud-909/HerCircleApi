import { getUserById, upsertUser } from '../store.js';
import { ok, err } from '../utils/http.js';
import { userMe } from '../utils/presenters.js';

export async function register(req, res) {
  try {
    const { name, location, alias, email } = req.body ?? {};
    if (typeof name !== 'string' || !name.trim()) {
      return err(res, 'name is required', 400, 'validation_error');
    }
    const now = new Date().toISOString();
    const existing = await getUserById(req.userId);
    const user = existing ?? {
      id: req.userId,
      name: name.trim(),
      email: null,
      alias: null,
      location: null,
      bio: null,
      verificationStatus: 'unverified',
      verifiedAt: null,
      createdAt: now,
    };
    user.name = name.trim();
    if (typeof location === 'string' && location.trim()) {
      user.location = location.trim();
    }
    if (typeof alias === 'string' && alias.trim()) {
      user.alias = alias.trim();
    }
    if (typeof email === 'string' && email.trim()) {
      user.email = email.trim();
    } else if (req.firebase?.email) {
      user.email = req.firebase.email;
    }
    await upsertUser(user);
    return ok(res, { user: userMe(user) }, existing ? 200 : 201);
  } catch (_e) {
    return err(res, 'Internal error', 500, 'internal');
  }
}

export async function googleAuth(req, res) {
  try {
    const { name, email } = req.body ?? {};
    if (typeof name !== 'string' || !name.trim()) {
      return err(res, 'name is required', 400, 'validation_error');
    }
    const now = new Date().toISOString();
    const existing = await getUserById(req.userId);
    const user = existing ?? {
      id: req.userId,
      name: name.trim(),
      email: null,
      alias: null,
      location: null,
      bio: null,
      verificationStatus: 'unverified',
      verifiedAt: null,
      createdAt: now,
    };
    user.name = name.trim();
    if (typeof email === 'string' && email.trim()) {
      user.email = email.trim();
    } else if (req.firebase?.email) {
      user.email = req.firebase.email;
    }
    await upsertUser(user);
    return ok(res, { user: userMe(user), isNewUser: !existing }, existing ? 200 : 201);
  } catch (_e) {
    return err(res, 'Internal error', 500, 'internal');
  }
}

export function logout(_req, res) {
  return ok(res, { message: 'Logged out successfully' });
}
