/**
 * Public row for GET /community/members (API spec — no email).
 * @param {{ id: string, name: string, location?: string | null, bio?: string | null, verificationStatus: string }} u
 */
export function toCommunityMemberRow(u) {
  return {
    id: u.id,
    name: u.name,
    location: u.location ?? null,
    bio: u.bio ?? null,
    verificationStatus: u.verificationStatus,
  };
}

/**
 * v1 discoverable list: all registered users except self, stable order, capped.
 * @param {Array<{ id: string, name: string, location?: string | null, bio?: string | null, verificationStatus: string }>} users
 * @param {string} selfId
 */
export function pickDiscoverableMembers(users, selfId, { limit = 100 } = {}) {
  return users
    .filter((u) => u && u.id !== selfId)
    .sort((a, b) => String(a.name).localeCompare(String(b.name)))
    .slice(0, limit)
    .map(toCommunityMemberRow);
}

/**
 * Same rules as GET /community/members — used to validate POST /chats { peerUserId }.
 * @param {Array<{ id: string, name: string }>} users
 * @param {string} selfId
 * @param {string} peerId
 */
export function peerIdIsDiscoverableForCommunity(users, selfId, peerId, options = {}) {
  return pickDiscoverableMembers(users, selfId, options).some((m) => m.id === peerId);
}
