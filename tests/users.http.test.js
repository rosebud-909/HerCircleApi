import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../app.js';
import { resetMemoryStore } from '../memoryStore.js';
import { upsertUser, createRequestRow } from '../store.js';

describe('HTTP GET /users/me connectedUserIds', async () => {
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
  });

  function as(userId) {
    return { 'X-Test-User-Id': userId };
  }

  it('includes connectedUserIds after community chat', async () => {
    await request(app).post('/api/v1/chats').set(as('alice')).send({ peerUserId: 'bob' });
    const res = await request(app).get('/api/v1/users/me').set(as('alice'));
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data.connectedUserIds, ['bob']);
  });

  it('does not list request-scoped chat partner as connected', async () => {
    await createRequestRow({
      id: 'r1',
      userId: 'bob',
      category: 'food',
      requestType: null,
      description: 'Need',
      urgency: 'medium',
      location: 'Here',
      status: 'open',
      isAnonymous: false,
      createdAt: new Date().toISOString(),
    });
    await request(app).post('/api/v1/chats').set(as('alice')).send({ requestId: 'r1' });
    const res = await request(app).get('/api/v1/users/me').set(as('alice'));
    assert.deepEqual(res.body.data.connectedUserIds, []);
  });
});
