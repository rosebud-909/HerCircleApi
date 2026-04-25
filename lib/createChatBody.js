/**
 * Validates POST /chats body: exactly one of requestId or peerUserId (API spec).
 * @param {unknown} body
 * @returns {{ ok: true, kind: 'request', requestId: string } | { ok: true, kind: 'community', peerUserId: string } | { ok: false, error: string, code: string, status: number }}
 */
export function parseCreateChatBody(body) {
  const b = body && typeof body === 'object' ? body : {};
  const rawReq = b.requestId;
  const rawPeer = b.peerUserId;
  const requestId = typeof rawReq === 'string' ? rawReq.trim() : '';
  const peerUserId = typeof rawPeer === 'string' ? rawPeer.trim() : '';

  const hasReqField = rawReq !== undefined && rawReq !== null;
  const hasPeerField = rawPeer !== undefined && rawPeer !== null;
  const reqSent = hasReqField && requestId !== '';
  const peerSent = hasPeerField && peerUserId !== '';

  if (reqSent && peerSent) {
    return {
      ok: false,
      error: 'Send either requestId or peerUserId, not both',
      code: 'validation_error',
      status: 400,
    };
  }
  if (!reqSent && !peerSent) {
    return {
      ok: false,
      error: 'Either requestId or peerUserId is required',
      code: 'validation_error',
      status: 400,
    };
  }
  if (reqSent) return { ok: true, kind: 'request', requestId };
  return { ok: true, kind: 'community', peerUserId };
}
