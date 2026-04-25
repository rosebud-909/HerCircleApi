/**
 * User ids the caller has a **community** (non-request) DM with — for Connected badges / GET /users/me.
 * @param {Array<{ requestId?: string | null, participants?: string[] }>} chats
 * @param {string} userId
 * @returns {string[]}
 */
export function communityConnectedUserIdsFromChats(chats, userId) {
  const set = new Set();
  for (const c of chats) {
    const rid = c.requestId;
    if (typeof rid === 'string' && rid.length > 0) continue;
    const other = c.participants?.find((p) => p !== userId);
    if (other) set.add(other);
  }
  return [...set].sort();
}
