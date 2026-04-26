import { buildAdminFlagsMap } from '../lib/adminFlags.js';
import { communityDiscoverableLimit } from '../lib/communityDiscoverLimit.js';
import { pickDiscoverableMembers } from '../lib/communityMembers.js';
import { listUsers } from '../store.js';
import { ok, err } from '../utils/http.js';

export async function listMembers(req, res) {
  try {
    const all = await listUsers();
    const adminFlags = await buildAdminFlagsMap(all);
    const data = pickDiscoverableMembers(all, req.userId, {
      limit: communityDiscoverableLimit(),
      adminFlags,
    });
    return ok(res, data);
  } catch (_e) {
    return err(res, 'Internal error', 500, 'internal');
  }
}
