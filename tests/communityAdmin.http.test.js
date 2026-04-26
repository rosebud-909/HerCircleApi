import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

describe('HTTP community admin directory opt-in', async () => {
  const prevUids = process.env.ADMIN_UIDS;
  process.env.ADMIN_UIDS = 'carol';

  const { createApp } = await import('../app.js');
  const { resetMemoryStore } = await import('../memoryStore.js');
  const { upsertUser } = await import('../store.js');

  const app = await createApp();

  after(() => {
    if (prevUids === undefined) delete process.env.ADMIN_UIDS;
    else process.env.ADMIN_UIDS = prevUids;
  });

  beforeEach(async () => {
    resetMemoryStore();
    const now = new Date().toISOString();
    for (const row of [
      { id: 'alice', name: 'Alice', email: 'alice@t.test' },
      { id: 'bob', name: 'Bob', email: 'bob@t.test' },
      { id: 'carol', name: 'Carol', email: 'carol@t.test' },
    ]) {
      await upsertUser({
        id: row.id,
        name: row.name,
        email: row.email,
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

  it('hides admin from GET /community/members unless opted in', async () => {
    const r = await request(app).get('/api/v1/community/members').set(as('alice'));
    assert.equal(r.status, 200);
    const ids = r.body.data.map((x) => x.id).sort();
    assert.deepEqual(ids, ['bob']);
  });

  it('rejects non-admin PATCH listInCommunityDirectory', async () => {
    const r = await request(app)
      .patch('/api/v1/users/me')
      .set(as('alice'))
      .send({ listInCommunityDirectory: true });
    assert.equal(r.status, 403);
  });

  it('shows admin after opt-in PATCH', async () => {
    const patch = await request(app)
      .patch('/api/v1/users/me')
      .set(as('carol'))
      .send({ listInCommunityDirectory: true });
    assert.equal(patch.status, 200);
    assert.equal(patch.body.data.listInCommunityDirectory, true);

    const r = await request(app).get('/api/v1/community/members').set(as('alice'));
    const ids = r.body.data.map((x) => x.id).sort();
    assert.deepEqual(ids, ['bob', 'carol']);
    const carolRow = r.body.data.find((x) => x.id === 'carol');
    assert.ok(carolRow);
    assert.equal(carolRow.isAdmin, true);
    assert.equal(carolRow.listInCommunityDirectory, true);
  });

  it('GET /users/me includes isAdmin for admins', async () => {
    const r = await request(app).get('/api/v1/users/me').set(as('carol'));
    assert.equal(r.status, 200);
    assert.equal(r.body.data.isAdmin, true);
    assert.equal(r.body.data.listInCommunityDirectory, false);
  });
});
