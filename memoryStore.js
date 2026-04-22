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
