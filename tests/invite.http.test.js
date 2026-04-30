import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../app.js';
import { resetMemoryStore } from '../memoryStore.js';
import { upsertUser } from '../store.js';

/** Must satisfy `isPlausibleInviteToken` (16+ base64url chars) for GET /invites/validate tests. */
const ALICE_INVITE = 'invitetest_alice_aaaaaaaa';
const BOB_INVITE = 'invitetest_bob_aaaaaaaaaa';

describe('HTTP invites (INVITE_ONLY=true)', async () => {
  const app = await createApp();

  beforeEach(async () => {
    process.env.INVITE_ONLY = 'true';
    resetMemoryStore();
    const now = new Date().toISOString();
    await upsertUser({
      id: 'alice',
      name: 'Alice',
      email: 'alice@t.test',
      alias: null,
      location: 'Chicago',
      bio: null,
      verificationStatus: 'unverified',
      verifiedAt: null,
      createdAt: now,
      inviteToken: ALICE_INVITE,
      invitedByUserId: null,
    });
  });

  afterEach(() => {
    process.env.INVITE_ONLY = 'false';
  });

  function as(userId) {
    return { 'X-Test-User-Id': userId };
  }

  it('rejects register without inviteToken', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set(as('newbie'))
      .send({ name: 'New', email: 'n@t.test' });
    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'invite_required');
  });

  it('GET /invites/validate without token', async () => {
    const res = await request(app).get('/api/v1/invites/validate');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.inviteRequired, true);
    assert.equal(res.body.data.valid, false);
  });

  it('GET /invites/validate accepts Alice token', async () => {
    const res = await request(app).get('/api/v1/invites/validate').query({ token: ALICE_INVITE });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.inviteRequired, true);
    assert.equal(res.body.data.valid, true);
  });

  it('GET /invites/validate rejects unknown plausible token', async () => {
    const res = await request(app)
      .get('/api/v1/invites/validate')
      .query({ token: 'xxxxxxxx_unknowninvite' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.valid, false);
  });

  it('creates user with valid invite and sets invitedByUserId', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set(as('newbie'))
      .send({ name: 'New', email: 'n@t.test', inviteToken: ALICE_INVITE });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.user.invitedByUserId, 'alice');
    assert.ok(typeof res.body.data.user.id === 'string');
  });

  it('rejects invalid invite token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set(as('newbie'))
      .send({ name: 'New', email: 'n@t.test', inviteToken: 'nope' });
    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'invalid_invite');
  });

  it('rejects when inviter is at cap', async () => {
    const now = new Date().toISOString();
    for (let i = 0; i < 5; i += 1) {
      const id = `child${i}`;
      await upsertUser({
        id,
        name: `C${i}`,
        email: `${id}@t.test`,
        alias: null,
        location: 'X',
        bio: null,
        verificationStatus: 'unverified',
        verifiedAt: null,
        createdAt: now,
        inviteToken: `invitetest_child_${id}_aaaa`,
        invitedByUserId: 'alice',
      });
    }
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set(as('sixth'))
      .send({ name: 'Six', email: 'six@t.test', inviteToken: ALICE_INVITE });
    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'invite_cap_reached');
  });

  it('GET /invites/validate rejects Alice token at cap', async () => {
    const now = new Date().toISOString();
    for (let i = 0; i < 5; i += 1) {
      const id = `capkid${i}`;
      await upsertUser({
        id,
        name: `C${i}`,
        email: `${id}@t.test`,
        alias: null,
        location: 'X',
        bio: null,
        verificationStatus: 'unverified',
        verifiedAt: null,
        createdAt: now,
        inviteToken: `invitetest_cap_${id}_aaaa`,
        invitedByUserId: 'alice',
      });
    }
    const res = await request(app).get('/api/v1/invites/validate').query({ token: ALICE_INVITE });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.valid, false);
  });

  it('GET /users/me/invite returns invitees', async () => {
    const now = new Date().toISOString();
    await upsertUser({
      id: 'bob',
      name: 'Bob',
      email: 'bob@t.test',
      alias: null,
      location: 'X',
      bio: null,
      verificationStatus: 'unverified',
      verifiedAt: null,
      createdAt: now,
      inviteToken: BOB_INVITE,
      invitedByUserId: 'alice',
    });
    const res = await request(app).get('/api/v1/users/me/invite').set(as('alice'));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.inviteToken, ALICE_INVITE);
    assert.equal(res.body.data.invitesUsed, 1);
    assert.equal(res.body.data.invitees.length, 1);
    assert.equal(res.body.data.invitees[0].id, 'bob');
  });
});
