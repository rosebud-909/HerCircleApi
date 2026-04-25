import { communityDiscoverableLimit } from '../lib/communityDiscoverLimit.js';
import { chatPairKey } from '../lib/chatPairKey.js';
import { parseCreateChatBody } from '../lib/createChatBody.js';
import { peerIdIsDiscoverableForCommunity } from '../lib/communityMembers.js';
import {
  createChatRow,
  findChatForCommunityPeers,
  findChatForRequest,
  getRequestById,
  getUserById,
  listMessages,
  listUsers,
  nextId,
} from '../store.js';

/**
 * @param {string} userId
 * @param {unknown} body
 * @param {{ discoverableMemberLimit?: number }} [options] discoverableMemberLimit for tests only (caps same list as GET /community/members)
 * @returns {Promise<{ success: true, status: number, data: object } | { success: false, status: number, error: string, code: string }>}
 */
export async function runCreateChat(userId, body, options = {}) {
  const parsed = parseCreateChatBody(body);
  if (!parsed.ok) {
    return { success: false, status: parsed.status, error: parsed.error, code: parsed.code };
  }

  if (parsed.kind === 'request') {
    const { requestId } = parsed;
    const request = await getRequestById(requestId);
    if (!request) {
      return { success: false, status: 404, error: 'Request not found', code: 'not_found' };
    }
    if (request.userId === userId) {
      return {
        success: false,
        status: 400,
        error: 'Cannot start a chat on your own request',
        code: 'bad_request',
      };
    }
    const ownerId = request.userId;
    const helperId = userId;
    const existing = await findChatForRequest({ requestId, ownerId, helperId });
    if (existing) {
      const msgs = await listMessages(existing.id);
      const last = msgs[msgs.length - 1];
      return {
        success: true,
        status: 200,
        data: {
          id: existing.id,
          requestId: existing.requestId,
          participants: existing.participants,
          lastMessage: last ? last.content : null,
          updatedAt: existing.updatedAt,
        },
      };
    }
    const id = nextId('c');
    const now = new Date().toISOString();
    const chat = {
      id,
      requestId,
      participants: [ownerId, helperId].sort(),
      updatedAt: now,
    };
    await createChatRow(chat);
    return {
      success: true,
      status: 201,
      data: {
        id: chat.id,
        requestId: chat.requestId,
        participants: chat.participants,
        lastMessage: null,
        updatedAt: chat.updatedAt,
      },
    };
  }

  const { peerUserId } = parsed;
  if (peerUserId === userId) {
    return {
      success: false,
      status: 400,
      error: 'peerUserId cannot be the current user',
      code: 'validation_error',
    };
  }
  const peer = await getUserById(peerUserId);
  if (!peer) {
    return { success: false, status: 404, error: 'User not found', code: 'not_found' };
  }

  const existing = await findChatForCommunityPeers(userId, peerUserId);
  if (existing) {
    const msgs = await listMessages(existing.id);
    const last = msgs[msgs.length - 1];
    return {
      success: true,
      status: 200,
      data: {
        id: existing.id,
        requestId: existing.requestId ?? null,
        participants: existing.participants,
        lastMessage: last ? last.content : null,
        updatedAt: existing.updatedAt,
      },
    };
  }

  const limit =
    typeof options.discoverableMemberLimit === 'number'
      ? options.discoverableMemberLimit
      : communityDiscoverableLimit();
  const discoverOpts = { limit };
  const allUsers = await listUsers();
  if (!peerIdIsDiscoverableForCommunity(allUsers, userId, peerUserId, discoverOpts)) {
    return {
      success: false,
      status: 400,
      error: 'That user is not available for community messages right now',
      code: 'bad_request',
    };
  }

  const id = nextId('c');
  const now = new Date().toISOString();
  const chat = {
    id,
    requestId: null,
    participants: [userId, peerUserId].sort(),
    communityPairKey: chatPairKey(userId, peerUserId),
    updatedAt: now,
  };
  await createChatRow(chat);
  return {
    success: true,
    status: 201,
    data: {
      id: chat.id,
      requestId: null,
      participants: chat.participants,
      lastMessage: null,
      updatedAt: chat.updatedAt,
    },
  };
}
