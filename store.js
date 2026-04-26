import { useFirestore } from './dbMode.js';
import { nextId, store as memoryStore } from './memoryStore.js';
import { chatPairKey } from './lib/chatPairKey.js';
import {
  fsAppendMessage,
  fsCreateChat,
  fsCreateRequest,
  fsCreateSos,
  fsFindChatForCommunityPeers,
  fsFindChatForRequest,
  fsGetChat,
  fsGetRequest,
  fsGetSos,
  fsGetUser,
  fsListUsers,
  fsListActiveSos,
  fsListChatsForUser,
  fsListMessages,
  fsListRequestsFeed,
  fsListRequestsForUser,
  fsPurgeUserData,
  fsUpdateChatUpdatedAt,
  fsUpdateRequestStatus,
  fsUpdateSos,
  fsUpsertUser,
  requestSortKeys,
} from './firestoreRepo.js';

export { nextId };

export async function getUserById(userId) {
  if (useFirestore()) return fsGetUser(userId);
  return memoryStore.users.get(userId) ?? null;
}

export async function listUsers() {
  if (useFirestore()) return fsListUsers();
  const rows = [...memoryStore.users.values()];
  rows.sort((a, b) => {
    const tb = Date.parse(String(b.createdAt || 0));
    const ta = Date.parse(String(a.createdAt || 0));
    return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
  });
  return rows;
}

export async function upsertUser(user) {
  if (useFirestore()) return fsUpsertUser(user);
  memoryStore.users.set(user.id, user);
  return user;
}

/** Firestore or in-memory: remove all app data for this uid (not Auth or GCS). */
export async function purgeUserAccountData(userId) {
  if (useFirestore()) return fsPurgeUserData(userId);
  const uid = String(userId);
  memoryStore.users.delete(uid);
  memoryStore.requests = memoryStore.requests.filter((r) => r.userId !== uid);
  memoryStore.sos = memoryStore.sos.filter((s) => s.userId !== uid);
  const removeChatIds = [];
  for (const [id, chat] of memoryStore.chats) {
    if (Array.isArray(chat.participants) && chat.participants.includes(uid)) removeChatIds.push(id);
  }
  for (const id of removeChatIds) {
    memoryStore.chats.delete(id);
    memoryStore.messages.delete(id);
  }
}

export async function getRequestById(requestId) {
  if (useFirestore()) return fsGetRequest(requestId);
  return memoryStore.requests.find((x) => x.id === requestId) ?? null;
}

export async function createRequestRow(row) {
  const normalized = {
    ...row,
    requestType: row.category === 'other' ? row.requestType ?? null : null,
  };

  if (useFirestore()) {
    const withKeys = { ...normalized, ...requestSortKeys(normalized) };
    await fsCreateRequest(withKeys);
    return withKeys;
  }

  memoryStore.requests.push(normalized);
  return normalized;
}

export async function updateRequestStatus(requestId, status) {
  if (useFirestore()) {
    await fsUpdateRequestStatus(requestId, status);
    return;
  }
  const r = memoryStore.requests.find((x) => x.id === requestId);
  if (r) r.status = status;
}

export async function listMyRequests(userId) {
  if (useFirestore()) return fsListRequestsForUser(userId);
  return memoryStore.requests.filter((r) => r.userId === userId);
}

export async function listRequestsFeed(filters) {
  if (useFirestore()) return fsListRequestsFeed(filters);
  // Memory path mirrors old behavior: filter + sort in-process.
  let list = [...memoryStore.requests];
  const { category, status = 'open', sortBy = 'urgency', requestType } = filters;
  const categories = ['menstrual', 'food', 'hygiene', 'kids', 'transport', 'errands', 'other'];
  const requestTypes = ['housing', 'health', 'emotional'];
  if (category && categories.includes(String(category))) {
    list = list.filter((r) => r.category === String(category));
  }
  if (requestType && requestTypes.includes(String(requestType))) {
    list = list.filter((r) => (r.requestType ?? null) === String(requestType));
  }
  if (status && ['open', 'fulfilled'].includes(status)) {
    list = list.filter((r) => r.status === status);
  }
  const urgencyOrder = { high: 0, medium: 1, low: 2 };
  if (sortBy === 'createdAt') {
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } else {
    list.sort((a, b) => {
      const uo = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      if (uo !== 0) return uo;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }
  return list;
}

export async function getChatById(chatId) {
  if (useFirestore()) return fsGetChat(chatId);
  return memoryStore.chats.get(chatId) ?? null;
}

export async function findChatForRequest({ requestId, ownerId, helperId }) {
  if (useFirestore()) return fsFindChatForRequest({ requestId, ownerId, helperId });
  for (const c of memoryStore.chats.values()) {
    if (c.requestId === requestId && c.participants.includes(ownerId) && c.participants.includes(helperId)) {
      return c;
    }
  }
  return null;
}

export async function findChatForCommunityPeers(userIdA, userIdB) {
  if (useFirestore()) return fsFindChatForCommunityPeers({ userIdA, userIdB });
  const key = chatPairKey(userIdA, userIdB);
  for (const c of memoryStore.chats.values()) {
    if (c.communityPairKey === key) return c;
  }
  return null;
}

export async function createChatRow(chat) {
  if (useFirestore()) {
    await fsCreateChat(chat);
    return chat;
  }
  memoryStore.chats.set(chat.id, chat);
  memoryStore.messages.set(chat.id, []);
  return chat;
}

export async function listChatsForUser(userId) {
  if (useFirestore()) return fsListChatsForUser(userId);
  return [...memoryStore.chats.values()].filter((c) => c.participants.includes(userId));
}

export async function listMessages(chatId) {
  if (useFirestore()) return fsListMessages(chatId);
  return [...(memoryStore.messages.get(chatId) ?? [])];
}

export async function appendMessage({ chatId, message }) {
  if (useFirestore()) {
    await fsAppendMessage(chatId, message);
    return;
  }
  const arr = memoryStore.messages.get(chatId) ?? [];
  arr.push(message);
  memoryStore.messages.set(chatId, arr);
  const chat = memoryStore.chats.get(chatId);
  if (chat) chat.updatedAt = message.createdAt;
}

export async function touchChatUpdatedAt(chatId, updatedAt) {
  if (useFirestore()) {
    await fsUpdateChatUpdatedAt(chatId, updatedAt);
    return;
  }
  const chat = memoryStore.chats.get(chatId);
  if (chat) chat.updatedAt = updatedAt;
}

export async function createSosRow(row) {
  if (useFirestore()) {
    await fsCreateSos(row);
    return row;
  }
  memoryStore.sos.push(row);
  return row;
}

export async function getSosById(sosId) {
  if (useFirestore()) return fsGetSos(sosId);
  return memoryStore.sos.find((s) => s.id === sosId) ?? null;
}

export async function patchSos(sosId, patch) {
  if (useFirestore()) {
    await fsUpdateSos(sosId, patch);
    return;
  }
  const row = memoryStore.sos.find((s) => s.id === sosId);
  if (!row) return;
  Object.assign(row, patch);
}

export async function listActiveSos() {
  if (useFirestore()) return fsListActiveSos();
  return memoryStore.sos.filter((s) => s.status === 'active');
}
