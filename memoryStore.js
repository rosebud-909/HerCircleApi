let idSeq = 0;
export function nextId(prefix) {
  idSeq += 1;
  return `${prefix}_${Date.now()}_${idSeq}`;
}

export const store = {
  users: new Map(),
  requests: [],
  chats: new Map(),
  messages: new Map(),
  sos: [],
};

/** Clears in-memory data (for tests only; never call in production). */
export function resetMemoryStore() {
  store.users.clear();
  store.requests.length = 0;
  store.chats.clear();
  store.messages.clear();
  store.sos.length = 0;
}

