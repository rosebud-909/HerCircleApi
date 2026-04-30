import { buildAdminFlagsMap } from '../lib/adminFlags.js';
import { listUsers } from '../store.js';
import { ok, err } from '../utils/http.js';
import { userPublic } from '../utils/presenters.js';

export async function listUsersForAdmin(_req, res) {
  try {
    const rows = await listUsers();
    const flags = await buildAdminFlagsMap(rows);
    const data = rows.map((u) => ({
      ...userPublic(u),
      email: u.email ?? null,
      invitedByUserId: u.invitedByUserId ?? null,
      isAdmin: flags.get(u.id) === true,
    }));
    return ok(res, data);
  } catch (_e) {
    return err(res, 'Internal error', 500, 'internal');
  }
}
