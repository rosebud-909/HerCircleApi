import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../app.js';
import { resetMemoryStore } from '../memoryStore.js';
import { chatPairKey } from '../lib/chatPairKey.js';
import {
  upsertUser,
  createRequestRow,
  createChatRow,
  appendMessage,
  createSosRow,
  getUserById,
  nextId,
} from '../store.js';

describe('HTTP DELETE /users/me', async () => {
  const app = await createApp();

  beforeEach(async () => {
    resetMemoryStore();
    const now = new Date().toISOString();
    for (const row of [
      { id: 'alice', name: 'Alice' },
      { id: 'bob', name: 'Bob' },
    ]) {
      await upsertUser({
        id: row.id,
        name: row.name,
        email: `${row.id}@t.test`,
        alias: null,
        location: 'Chicago',
        bio: null,
        verificationStatus: 'unverified',
        verifiedAt: null,
        createdAt: now,
      });
    }
    await createRequestRow({
      id: 'r_alice',
      userId: 'alice',
      category: 'food',
      requestType: null,
      description: 'Need',
      urgency: 'medium',
      location: 'Here',
      status: 'open',
      isAnonymous: false,
      createdAt: now,
    });
    const chatId = nextId('chat');
    await createChatRow({
      id: chatId,
      participants: ['alice', 'bob'].sort(),
      requestId: null,
      communityPairKey: chatPairKey('alice', 'bob'),
      lastMessage: null,
      updatedAt: now,
    });
    await appendMessage({
      chatId,
      message: {
        id: nextId('msg'),
        chatId,
        senderId: 'alice',
        content: 'hi',
        createdAt: now,
      },
    });
    await createSosRow({
      id: nextId('sos'),
      userId: 'alice',
      location: 'X',
      message: null,
      status: 'active',
      createdAt: now,
      coordinates: null,
      notifiedCount: 0,
      policeNotified: false,
    });
  });

  function as(userId) {
    return { 'X-Test-User-Id': userId };
  }

  it('removes user, owned requests, SOS, and chats they joined', async () => {
    const res = await request(app).delete('/api/v1/users/me').set(as('alice'));
    assert.equal(res.status, 200);
    assert.equal(res.body.data?.deleted, true);

    assert.equal(await getUserById('alice'), null);
    assert.ok(await getUserById('bob'));

    const mine = await request(app).get('/api/v1/users/me/requests').set(as('bob'));
    assert.equal(mine.status, 200);
    assert.equal(mine.body.data?.length ?? 0, 0);

    const chats = await request(app).get('/api/v1/chats').set(as('bob'));
    assert.equal(chats.status, 200);
    assert.deepEqual(chats.body.data ?? [], []);
  });
});
