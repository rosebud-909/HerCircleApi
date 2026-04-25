import { communityDiscoverableLimit } from '../lib/communityDiscoverLimit.js';
import { pickDiscoverableMembers } from '../lib/communityMembers.js';
import { listUsers } from '../store.js';
import { ok, err } from '../utils/http.js';

export async function listMembers(req, res) {
  try {
    const all = await listUsers();
    const data = pickDiscoverableMembers(all, req.userId, { limit: communityDiscoverableLimit() });
    return ok(res, data);
  } catch (_e) {
    return err(res, 'Internal error', 500, 'internal');
  }
}
