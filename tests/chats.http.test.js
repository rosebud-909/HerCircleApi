import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../app.js';
import { resetMemoryStore } from '../memoryStore.js';
import { upsertUser, createRequestRow } from '../store.js';

describe('HTTP /chats and /community/members', async () => {
  const app = await createApp();

  beforeEach(async () => {
    resetMemoryStore();
    const now = new Date().toISOString();
    for (const id of ['alice', 'bob', 'carol']) {
      await upsertUser({
        id,
        name: id === 'alice' ? 'Alice' : id === 'bob' ? 'Bob' : 'Carol',
        email: `${id}@t.test`,
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

  it('POST /chats community returns 201', async () => {
    const res = await request(app)
      .post('/api/v1/chats')
      .set(as('alice'))
      .send({ peerUserId: 'bob' });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.requestId, null);
    assert.ok(Array.isArray(res.body.data.participants));
  });

  it('GET /chats includes community thread with request null', async () => {
    await request(app).post('/api/v1/chats').set(as('alice')).send({ peerUserId: 'bob' });
    const res = await request(app).get('/api/v1/chats').set(as('alice'));
    assert.equal(res.status, 200);
    assert.equal(Array.isArray(res.body.data), true);
    const row = res.body.data.find((c) => c.requestId === null);
    assert.ok(row);
    assert.equal(row.request, null);
    assert.equal(row.otherUser.id, 'bob');
  });

  it('GET /community/members excludes caller', async () => {
    const res = await request(app).get('/api/v1/community/members').set(as('alice'));
    assert.equal(res.status, 200);
    const ids = res.body.data.map((x) => x.id).sort();
    assert.deepEqual(ids, ['bob', 'carol']);
  });

  it('POST /chats request path returns 201', async () => {
    await createRequestRow({
      id: 'req_http_1',
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
    const res = await request(app)
      .post('/api/v1/chats')
      .set(as('alice'))
      .send({ requestId: 'req_http_1' });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.requestId, 'req_http_1');
  });
});
