/**
 * Public row for GET /community/members (API spec — no email).
 * @param {{ id: string, name: string, location?: string | null, bio?: string | null, verificationStatus: string, listInCommunityDirectory?: boolean }} u
 * @param {Map<string, boolean>} [adminFlags] uid -> is admin
 */
export function toCommunityMemberRow(u, adminFlags = new Map()) {
  const isAdmin = adminFlags.get(u.id) === true;
  const base = {
    id: u.id,
    name: u.name,
    location: u.location ?? null,
    bio: u.bio ?? null,
    verificationStatus: u.verificationStatus,
  };
  if (!isAdmin) return base;
  return {
    ...base,
    isAdmin: true,
    listInCommunityDirectory: u.listInCommunityDirectory === true,
  };
}

/**
 * v1 discoverable list: registered users except self; admins only if opted in; stable order, capped.
 * @param {Array<{ id: string, name: string, location?: string | null, bio?: string | null, verificationStatus: string, listInCommunityDirectory?: boolean, email?: string | null }>} users
 * @param {string} selfId
 * @param {{ limit?: number, adminFlags?: Map<string, boolean> }} [opts]
 */
export function pickDiscoverableMembers(users, selfId, { limit = 100, adminFlags = new Map() } = {}) {
  return users
    .filter((u) => u && u.id !== selfId)
    .filter((u) => {
      const isAdm = adminFlags.get(u.id) === true;
      if (!isAdm) return true;
      return u.listInCommunityDirectory === true;
    })
    .sort((a, b) => String(a.name).localeCompare(String(b.name)))
    .slice(0, limit)
    .map((u) => toCommunityMemberRow(u, adminFlags));
}

/**
 * Same rules as GET /community/members — used to validate POST /chats { peerUserId }.
 * @param {Array<{ id: string, name: string, listInCommunityDirectory?: boolean }>} users
 * @param {string} selfId
 * @param {string} peerId
 */
export function peerIdIsDiscoverableForCommunity(users, selfId, peerId, options = {}) {
  return pickDiscoverableMembers(users, selfId, options).some((m) => m.id === peerId);
}
