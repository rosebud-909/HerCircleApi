/** Max rows returned by GET /community/members and used when validating community DMs. */
export function communityDiscoverableLimit() {
  const raw = process.env.COMMUNITY_MEMBER_LIMIT;
  if (raw === undefined || raw === '') return 100;
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? Math.min(500, n) : 100;
}
