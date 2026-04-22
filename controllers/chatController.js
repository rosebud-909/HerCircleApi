import {
  appendMessage,
  createChatRow,
  findChatForRequest,
  getChatById,
  getRequestById,
  getUserById,
  listChatsForUser,
  listMessages,
  nextId,
} from '../store.js';
import { ok, err } from '../utils/http.js';

export async function createChat(req, res) {
  try {
    const { requestId } = req.body ?? {};
    if (typeof requestId !== 'string') return err(res, 'requestId is required', 400, 'validation_error');
    const request = await getRequestById(requestId);
    if (!request) return err(res, 'Request not found', 404, 'not_found');
    if (request.userId === req.userId) {
      return err(res, 'Cannot start a chat on your own request', 400, 'bad_request');
    }
    const ownerId = request.userId;
    const helperId = req.userId;

    const existing = await findChatForRequest({ requestId, ownerId, helperId });
    if (existing) {
      const msgs = await listMessages(existing.id);
      const last = msgs[msgs.length - 1];
      return ok(res, {
        id: existing.id,
        requestId: existing.requestId,
        participants: existing.participants,
        lastMessage: last ? last.content : null,
        updatedAt: existing.updatedAt,
      });
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
    return ok(
      res,
      {
        id: chat.id,
        requestId: chat.requestId,
        participants: chat.participants,
        lastMessage: null,
        updatedAt: chat.updatedAt,
      },
      201,
    );
  } catch (_e) {
    return err(res, 'Internal error', 500, 'internal');
  }
}

export async function listChats(req, res) {
  try {
    const chats = await listChatsForUser(req.userId);
    const list = await Promise.all(
      chats.map(async (chat) => {
        const request = await getRequestById(chat.requestId);
        const otherId = chat.participants.find((p) => p !== req.userId);
        const other = otherId ? await getUserById(otherId) : null;
        const msgs = await listMessages(chat.id);
        const last = msgs[msgs.length - 1];
        return {
          id: chat.id,
          requestId: chat.requestId,
          participants: chat.participants,
          lastMessage: last ? last.content : null,
          updatedAt: chat.updatedAt,
          otherUser: other
            ? {
                id: other.id,
                name: other.name,
                verificationStatus: other.verificationStatus,
              }
            : null,
          request: request
            ? {
                id: request.id,
                category: request.category,
                description:
                  request.description.length > 40
                    ? `${request.description.slice(0, 37)}...`
                    : request.description,
              }
            : null,
        };
      }),
    );
    list.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    return ok(res, list);
  } catch (_e) {
    return err(res, 'Internal error', 500, 'internal');
  }
}

export async function getMessages(req, res) {
  try {
    const chat = await getChatById(req.params.chatId);
    if (!chat || !chat.participants.includes(req.userId)) {
      return err(res, 'Chat not found', 404, 'not_found');
    }
    const msgs = await listMessages(chat.id);
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '50'), 10) || 50));
    const total = msgs.length;
    const slice = msgs.slice((page - 1) * limit, page * limit);
    return ok(res, {
      messages: slice,
      pagination: { page, limit, total },
    });
  } catch (_e) {
    return err(res, 'Internal error', 500, 'internal');
  }
}

export async function postMessage(req, res) {
  try {
    const chat = await getChatById(req.params.chatId);
    if (!chat || !chat.participants.includes(req.userId)) {
      return err(res, 'Chat not found', 404, 'not_found');
    }
    const { content } = req.body ?? {};
    if (typeof content !== 'string' || !content.trim()) {
      return err(res, 'content is required', 400, 'validation_error');
    }
    const msg = {
      id: nextId('m'),
      chatId: chat.id,
      senderId: req.userId,
      content: content.trim(),
      createdAt: new Date().toISOString(),
    };
    await appendMessage({ chatId: chat.id, message: msg });
    return ok(res, msg, 201);
  } catch (_e) {
    return err(res, 'Internal error', 500, 'internal');
  }
}
