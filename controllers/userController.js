import { actorIsAdmin } from '../middleware/admin.js';
import { getFirebaseAdminAuth } from '../firebaseAdmin.js';
import { deleteUserOwnedStorageObjects } from '../services/deleteUserStorage.js';
import { generateInviteToken } from '../lib/inviteToken.js';
import { NON_ADMIN_INVITE_CAP, resolveInviteForNewProfile } from '../services/inviteEligibility.js';
import { getUserById, listChatsForUser, listMyRequests, listUsers, listUsersInvitedBy, purgeUserAccountData, upsertUser } from '../store.js';
import { communityConnectedUserIdsFromChats } from '../services/userConnections.js';
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
    let invitedByUserId = existing?.invitedByUserId ?? null;
    if (!existing) {
      try {
        const inv = await resolveInviteForNewProfile(req.body ?? {});
        invitedByUserId = inv.invitedByUserId;
      } catch (e) {
        const status = e && typeof e.status === 'number' ? e.status : 403;
        const code = e && typeof e.code === 'string' ? e.code : 'forbidden';
        const msg = e instanceof Error ? e.message : 'Invitation required';
        return err(res, msg, status, code);
      }
    }
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
      invitedByUserId,
      inviteToken: generateInviteToken(),
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

    if (user.inviteToken == null || user.inviteToken === '') {
      user.inviteToken = generateInviteToken();
    }

    await upsertUser(user);
    return ok(res, userMe(user), existing ? 200 : 201);
  } catch (_e) {
    return err(res, 'Internal error', 500, 'internal');
  }
}

export async function getMe(req, res) {
  try {
    let u = await getUserById(req.userId);
    if (!u) return err(res, 'User not found', 404, 'not_found');
    if (u.inviteToken == null || u.inviteToken === '') {
      u = { ...u, inviteToken: generateInviteToken() };
      await upsertUser(u);
    }
    const chats = await listChatsForUser(req.userId);
    const connectedUserIds = communityConnectedUserIdsFromChats(chats, req.userId);
    return ok(res, {
      ...userMe(u),
      connectedUserIds,
      isAdmin: actorIsAdmin(req),
    });
  } catch (_e) {
    return err(res, 'Internal error', 500, 'internal');
  }
}

export async function patchMe(req, res) {
  try {
    const u = await getUserById(req.userId);
    if (!u) return err(res, 'User not found', 404, 'not_found');
    const { bio, alias, location, listInCommunityDirectory } = req.body ?? {};
    if (listInCommunityDirectory !== undefined) {
      if (typeof listInCommunityDirectory !== 'boolean') {
        return err(res, 'listInCommunityDirectory must be a boolean', 400, 'validation_error');
      }
      if (!actorIsAdmin(req)) {
        return err(res, 'Only admins can change community directory visibility', 403, 'forbidden');
      }
      u.listInCommunityDirectory = listInCommunityDirectory;
    }
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
    return ok(res, { ...userMe(u), isAdmin: actorIsAdmin(req) });
  } catch (_e) {
    return err(res, 'Internal error', 500, 'internal');
  }
}

export async function getMyInvite(req, res) {
  try {
    let u = await getUserById(req.userId);
    if (!u) return err(res, 'User not found', 404, 'not_found');
    if (u.inviteToken == null || u.inviteToken === '') {
      u = { ...u, inviteToken: generateInviteToken() };
      await upsertUser(u);
    }
    const invitees = await listUsersInvitedBy(req.userId);
    const invitesUsed = invitees.length;
    const admin = actorIsAdmin(req);
    return ok(res, {
      inviteToken: u.inviteToken,
      sharePath: `/signup?invite=${encodeURIComponent(u.inviteToken)}`,
      invitesUsed,
      invitesMax: admin ? null : NON_ADMIN_INVITE_CAP,
      invitees: invitees.map((row) => userPublic(row)),
    });
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

export async function deleteMe(req, res) {
  const uid = req.userId;
  try {
    await deleteUserOwnedStorageObjects(uid);
    await purgeUserAccountData(uid);
    // Automated tests use in-memory store + header auth; Firebase Admin is not configured there.
    if (process.env.ALLOW_TEST_AUTH === 'true') {
      return ok(res, { deleted: true, auth: 'skipped_in_test_env' });
    }
    try {
      await getFirebaseAdminAuth().deleteUser(uid);
    } catch (e) {
      const code = e && typeof e.code === 'string' ? e.code : '';
      if (code === 'auth/user-not-found') {
        return ok(res, { deleted: true, auth: 'already_deleted' });
      }
      throw e;
    }
    return ok(res, { deleted: true });
  } catch (e) {
    console.error('deleteMe', e);
    const msg = e instanceof Error ? e.message : 'Could not delete account';
    return err(res, msg, 500, 'internal');
  }
}
