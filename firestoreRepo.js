import { getFirebaseAdminFirestore } from './firebaseAdmin.js';
import { chatPairKey as pairKey } from './lib/chatPairKey.js';

const USERS = 'users';
const REQUESTS = 'requests';
const CHATS = 'chats';
const MESSAGES = 'messages';
const SOS = 'sos';

function db() {
  return getFirebaseAdminFirestore();
}

function urgencyRank(urgency) {
  const order = { high: 0, medium: 1, low: 2 };
  return order[String(urgency)] ?? 9;
}

export function requestSortKeys({ urgency, createdAt }) {
  const createdMs = Date.parse(String(createdAt));
  const safeCreatedMs = Number.isFinite(createdMs) ? createdMs : Date.now();
  const ur = urgencyRank(urgency);
  // Lower is "more urgent" for default feed ordering.
  const urgencySortKey = ur * 1e15 + safeCreatedMs;
  // Higher is newer for createdAt sorting.
  const createdAtSortKey = safeCreatedMs * 10 + (2 - ur);
  return { urgencySortKey, createdAtSortKey, urgencyRank: ur, createdAtMs: safeCreatedMs };
}

export async function fsGetUser(userId) {
  const snap = await db().collection(USERS).doc(String(userId)).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
}

export async function fsUpsertUser(user) {
  const ref = db().collection(USERS).doc(String(user.id));
  await ref.set(user, { merge: true });
  return user;
}

export async function fsListUsers() {
  const qs = await db().collection(USERS).orderBy('createdAt', 'desc').limit(500).get();
  return qs.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fsGetRequest(requestId) {
  const snap = await db().collection(REQUESTS).doc(String(requestId)).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
}

export async function fsCreateRequest(request) {
  const ref = db().collection(REQUESTS).doc(String(request.id));
  const keys = requestSortKeys(request);
  await ref.set({ ...request, ...keys });
  return request;
}

export async function fsUpdateRequestStatus(requestId, status) {
  await db().collection(REQUESTS).doc(String(requestId)).set({ status }, { merge: true });
}

export async function fsListRequestsForUser(userId) {
  const qs = await db()
    .collection(REQUESTS)
    .where('userId', '==', String(userId))
    .orderBy('createdAt', 'desc')
    .limit(200)
    .get();
  return qs.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fsListRequestsFeed({ category, requestType, status, sortBy }) {
  let q = db().collection(REQUESTS).where('status', '==', String(status));
  if (category) q = q.where('category', '==', String(category));
  if (requestType) q = q.where('requestType', '==', String(requestType));

  if (sortBy === 'createdAt') {
    q = q.orderBy('createdAtSortKey', 'desc');
  } else {
    q = q.orderBy('urgencySortKey', 'asc');
  }

  const qs = await q.limit(500).get();
  return qs.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fsGetChat(chatId) {
  const snap = await db().collection(CHATS).doc(String(chatId)).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
}

export async function fsFindChatForRequest({ requestId, ownerId, helperId }) {
  const qs = await db().collection(CHATS).where('requestId', '==', String(requestId)).limit(25).get();
  const pair = pairKey(ownerId, helperId);
  for (const d of qs.docs) {
    const c = { id: d.id, ...d.data() };
    if (Array.isArray(c.participants) && pairKey(c.participants[0], c.participants[1]) === pair) {
      return c;
    }
  }
  return null;
}

export async function fsFindChatForCommunityPeers({ userIdA, userIdB }) {
  const key = pairKey(userIdA, userIdB);
  const qs = await db().collection(CHATS).where('communityPairKey', '==', key).limit(1).get();
  if (qs.empty) return null;
  const d = qs.docs[0];
  return { id: d.id, ...d.data() };
}

export async function fsCreateChat(chat) {
  const ref = db().collection(CHATS).doc(String(chat.id));
  await ref.set(chat);
  return chat;
}

export async function fsUpdateChatUpdatedAt(chatId, updatedAt) {
  await db().collection(CHATS).doc(String(chatId)).set({ updatedAt }, { merge: true });
}

export async function fsListChatsForUser(userId) {
  const qs = await db()
    .collection(CHATS)
    .where('participants', 'array-contains', String(userId))
    .orderBy('updatedAt', 'desc')
    .limit(200)
    .get();
  return qs.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fsListMessages(chatId) {
  const qs = await db()
    .collection(CHATS)
    .doc(String(chatId))
    .collection(MESSAGES)
    .orderBy('createdAt', 'asc')
    .limit(2000)
    .get();
  return qs.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fsAppendMessage(chatId, message) {
  const msgRef = db().collection(CHATS).doc(String(chatId)).collection(MESSAGES).doc(String(message.id));
  const chatRef = db().collection(CHATS).doc(String(chatId));
  const batch = db().batch();
  batch.set(msgRef, message);
  batch.set(chatRef, { updatedAt: message.createdAt }, { merge: true });
  await batch.commit();
  return message;
}

export async function fsCreateSos(row) {
  await db().collection(SOS).doc(String(row.id)).set(row);
  return row;
}

export async function fsGetSos(sosId) {
  const snap = await db().collection(SOS).doc(String(sosId)).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
}

export async function fsUpdateSos(sosId, patch) {
  await db().collection(SOS).doc(String(sosId)).set(patch, { merge: true });
}

export async function fsListActiveSos() {
  const qs = await db()
    .collection(SOS)
    .where('status', '==', 'active')
    .orderBy('createdAt', 'desc')
    .limit(200)
    .get();
  return qs.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// List queries use orderBy with composite indexes from `firestore.indexes.json`.
// If a query fails with a missing-index URL, deploy indexes and wait until Enabled.

