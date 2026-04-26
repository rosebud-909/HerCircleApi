import { getFirebaseAdminFirestore } from './firebaseAdmin.js';
import { chatPairKey as pairKey } from './lib/chatPairKey.js';

const USERS = 'users';
const REQUESTS = 'requests';
const CHATS = 'chats';
const MESSAGES = 'messages';
const SOS = 'sos';
/** Lazy-filled US ZIP → display location (`City, ST`); populated from successful Zippopotam lookups. */
const POSTAL_LOCATIONS = 'postalLocations';

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

export async function fsUpdateUserBio(userId, bio) {
  const ref = db().collection(USERS).doc(String(userId));
  await ref.set({ bio: bio ?? null }, { merge: true });
}

export async function fsBatchUpdateUserBios(entries, { overwrite = false } = {}) {
  const rows = Array.isArray(entries) ? entries : [];
  if (rows.length === 0) return { total: 0, updated: 0, skipped: 0 };

  let updated = 0;
  let skipped = 0;

  // Firestore batches are limited to 500 writes; keep a safety buffer.
  const CHUNK_SIZE = 400;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const batch = db().batch();

    if (overwrite) {
      for (const r of chunk) {
        if (!r?.id) {
          skipped += 1;
          continue;
        }
        batch.set(db().collection(USERS).doc(String(r.id)), { bio: r?.bio ?? null }, { merge: true });
        updated += 1;
      }
      await batch.commit();
      continue;
    }

    const refs = chunk
      .map((r) => (r?.id ? db().collection(USERS).doc(String(r.id)) : null))
      .filter(Boolean);
    const snaps = await db().getAll(...refs);
    const byId = new Map(snaps.map((s) => [s.id, s]));

    for (const r of chunk) {
      if (!r?.id) {
        skipped += 1;
        continue;
      }
      const snap = byId.get(String(r.id));
      const existingBio = snap?.exists ? snap.data()?.bio : undefined;
      if (existingBio != null && String(existingBio).trim() !== '') {
        skipped += 1;
        continue;
      }
      batch.set(db().collection(USERS).doc(String(r.id)), { bio: r?.bio ?? null }, { merge: true });
      updated += 1;
    }
    await batch.commit();
  }

  return { total: rows.length, updated, skipped };
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

export function fsPostalLocationDocId(countryCode, postalNormalized) {
  return `${String(countryCode).toUpperCase()}_${String(postalNormalized)}`;
}

export async function fsGetPostalLocation(countryCode, postalNormalized) {
  const id = fsPostalLocationDocId(countryCode, postalNormalized);
  const snap = await db().collection(POSTAL_LOCATIONS).doc(id).get();
  if (!snap.exists) return null;
  const d = snap.data();
  if (typeof d?.location !== 'string' || !d.location.trim()) return null;
  return {
    location: d.location.trim(),
    source: typeof d.source === 'string' && d.source.trim() ? d.source.trim() : 'persisted',
  };
}

export async function fsUpsertPostalLocation(countryCode, postalNormalized, { location, source }) {
  const id = fsPostalLocationDocId(countryCode, postalNormalized);
  await db()
    .collection(POSTAL_LOCATIONS)
    .doc(id)
    .set(
      {
        countryCode: String(countryCode).toUpperCase(),
        postal: String(postalNormalized),
        location: String(location).trim(),
        source: String(source),
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
}

async function fsDeleteAllMessagesInChat(chatId) {
  const col = db().collection(CHATS).doc(String(chatId)).collection(MESSAGES);
  for (;;) {
    const snap = await col.limit(450).get();
    if (snap.empty) break;
    const batch = db().batch();
    for (const d of snap.docs) batch.delete(d.ref);
    await batch.commit();
    if (snap.size < 450) break;
  }
}

/**
 * Removes all Firestore data keyed to this Firebase Auth uid (user doc, owned requests/SOS,
 * chats they participate in including subcollection messages). Does not touch Auth or Storage.
 */
export async function fsPurgeUserData(userId) {
  const uid = String(userId);

  for (;;) {
    const qs = await db().collection(REQUESTS).where('userId', '==', uid).limit(450).get();
    if (qs.empty) break;
    const batch = db().batch();
    for (const d of qs.docs) batch.delete(d.ref);
    await batch.commit();
  }

  for (;;) {
    const qs = await db().collection(SOS).where('userId', '==', uid).limit(450).get();
    if (qs.empty) break;
    const batch = db().batch();
    for (const d of qs.docs) batch.delete(d.ref);
    await batch.commit();
  }

  for (;;) {
    const qs = await db().collection(CHATS).where('participants', 'array-contains', uid).limit(40).get();
    if (qs.empty) break;
    for (const d of qs.docs) {
      await fsDeleteAllMessagesInChat(d.id);
      await d.ref.delete();
    }
  }

  await db().collection(USERS).doc(uid).delete();
}

// List queries use orderBy with composite indexes from `firestore.indexes.json`.
// If a query fails with a missing-index URL, deploy indexes and wait until Enabled.

