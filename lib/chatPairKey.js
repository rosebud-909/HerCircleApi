/** Stable key for an unordered pair of user ids (community DM dedupe). */
export function chatPairKey(a, b) {
  return [String(a), String(b)].sort().join('__');
}
