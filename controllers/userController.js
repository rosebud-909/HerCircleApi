import { getUserById, listMyRequests, listUsers, upsertUser } from '../store.js';
import { ok, err } from '../utils/http.js';
import { userMe, userPublic } from '../utils/presenters.js';

export async function upsertMe(req, res) {
  try {
    const { name, location, alias, email } = req.body ?? {};
    if (typeof name !== 'string' || !name.trim()) {
      return err(res, 'name is required');
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
    return ok(res, userMe(user), existing ? 200 : 201);
  } catch (_e) {
    return err(res, 'Internal error', 500, 'internal');
  }
}

export async function getMe(req, res) {
  try {
    const u = await getUserById(req.userId);
    if (!u) return err(res, 'User not found', 404, 'not_found');
    return ok(res, userMe(u));
  } catch (_e) {
    return err(res, 'Internal error', 500, 'internal');
  }
}

export async function patchMe(req, res) {
  try {
    const u = await getUserById(req.userId);
    if (!u) return err(res, 'User not found', 404, 'not_found');
    const { bio, alias, location } = req.body ?? {};
    if (bio !== undefined) {
      if (typeof bio !== 'string') return err(res, 'bio must be a string', 400, 'validation_error');
      u.bio = bio.trim() || null;
    }
    if (alias !== undefined) {
      if (alias !== null && typeof alias !== 'string') {
        return err(res, 'alias must be a string or null', 400, 'validation_error');
      }
      u.alias = alias === null || !String(alias).trim() ? null : String(alias).trim();
    }
    if (location !== undefined) {
      if (location !== null && typeof location !== 'string') {
        return err(res, 'location must be a string or null', 400, 'validation_error');
      }
      u.location = location === null || !String(location).trim() ? null : String(location).trim();
    }
    await upsertUser(u);
    return ok(res, userMe(u));
  } catch (_e) {
    return err(res, 'Internal error', 500, 'internal');
  }
}

export async function listMyRequestsHandler(req, res) {
  try {
    const mine = await listMyRequests(req.userId);
    const data = mine.map((r) => ({
      id: r.id,
      category: r.category,
      requestType: r.requestType ?? null,
      description: r.description,
      urgency: r.urgency,
      location: r.location,
      status: r.status,
      isAnonymous: r.isAnonymous,
      createdAt: r.createdAt,
    }));
    return ok(res, data);
  } catch (_e) {
    return err(res, 'Internal error', 500, 'internal');
  }
}

export async function getUserByIdPublic(req, res) {
  try {
    const u = await getUserById(req.params.id);
    if (!u) return err(res, 'User not found', 404, 'not_found');
    return ok(res, userPublic(u));
  } catch (_e) {
    return err(res, 'Internal error', 500, 'internal');
  }
}

export async function listUsersPublic(_req, res) {
  try {
    const rows = await listUsers();
    return ok(res, rows.map((u) => userPublic(u)));
  } catch (_e) {
    return err(res, 'Internal error', 500, 'internal');
  }
}
