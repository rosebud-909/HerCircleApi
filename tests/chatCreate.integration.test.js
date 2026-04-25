import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resetMemoryStore } from '../memoryStore.js';
import { upsertUser, createRequestRow } from '../store.js';
import { runCreateChat } from '../services/chatCreate.js';

describe('runCreateChat (memory store)', () => {
  beforeEach(() => {
    resetMemoryStore();
  });

  async function seedUsers() {
    const now = new Date().toISOString();
    await upsertUser({
      id: 'owner1',
      name: 'Owner',
      email: 'o@x.com',
      alias: null,
      location: null,
      bio: null,
      verificationStatus: 'verified',
      verifiedAt: null,
      createdAt: now,
    });
    await upsertUser({
      id: 'helper1',
      name: 'Helper',
      email: 'h@x.com',
      alias: null,
      location: null,
      bio: null,
      verificationStatus: 'unverified',
      verifiedAt: null,
      createdAt: now,
    });
    await upsertUser({
      id: 'peer2',
      name: 'Peer',
      email: 'p@x.com',
      alias: null,
      location: null,
      bio: 'Hi',
      verificationStatus: 'verified',
      verifiedAt: null,
      createdAt: now,
    });
  }

  it('creates request-scoped chat as helper', async () => {
    await seedUsers();
    await createRequestRow({
      id: 'req1',
      userId: 'owner1',
      category: 'food',
      requestType: null,
      description: 'Need food',
      urgency: 'high',
      location: 'Here',
      status: 'open',
      isAnonymous: false,
      createdAt: new Date().toISOString(),
    });

    const first = await runCreateChat('helper1', { requestId: 'req1' });
    assert.equal(first.success, true);
    assert.equal(first.status, 201);
    assert.equal(first.data.requestId, 'req1');
    assert.deepEqual(first.data.participants.sort(), ['helper1', 'owner1'].sort());

    const second = await runCreateChat('helper1', { requestId: 'req1' });
    assert.equal(second.success, true);
    assert.equal(second.status, 200);
    assert.equal(second.data.id, first.data.id);
  });

  it('rejects chat on own request', async () => {
    await seedUsers();
    await createRequestRow({
      id: 'req1',
      userId: 'owner1',
      category: 'food',
      requestType: null,
      description: 'Need food',
      urgency: 'high',
      location: 'Here',
      status: 'open',
      isAnonymous: false,
      createdAt: new Date().toISOString(),
    });

    const r = await runCreateChat('owner1', { requestId: 'req1' });
    assert.equal(r.success, false);
    assert.equal(r.status, 400);
  });

  it('creates community chat and dedupes', async () => {
    await seedUsers();
    const a = await runCreateChat('helper1', { peerUserId: 'peer2' });
    assert.equal(a.success, true);
    assert.equal(a.status, 201);
    assert.equal(a.data.requestId, null);
    assert.ok(a.data.participants.includes('helper1'));
    assert.ok(a.data.participants.includes('peer2'));

    const b = await runCreateChat('peer2', { peerUserId: 'helper1' });
    assert.equal(b.success, true);
    assert.equal(b.status, 200);
    assert.equal(b.data.id, a.data.id);
  });

  it('rejects community chat with self', async () => {
    await seedUsers();
    const r = await runCreateChat('helper1', { peerUserId: 'helper1' });
    assert.equal(r.success, false);
    assert.equal(r.status, 400);
  });

  it('returns 404 for unknown peer', async () => {
    await seedUsers();
    const r = await runCreateChat('helper1', { peerUserId: 'nobody' });
    assert.equal(r.success, false);
    assert.equal(r.status, 404);
  });

  it('rejects new community DM when peer outside discoverable cap', async () => {
    await seedUsers();
    const r = await runCreateChat('helper1', { peerUserId: 'peer2' }, { discoverableMemberLimit: 1 });
    assert.equal(r.success, false);
    assert.equal(r.status, 400);
    const okOwner = await runCreateChat('helper1', { peerUserId: 'owner1' }, { discoverableMemberLimit: 1 });
    assert.equal(okOwner.success, true);
  });

  it('reopens existing community chat even when peer outside discoverable cap', async () => {
    await seedUsers();
    const first = await runCreateChat('helper1', { peerUserId: 'peer2' });
    assert.equal(first.success, true);
    const second = await runCreateChat('helper1', { peerUserId: 'peer2' }, { discoverableMemberLimit: 1 });
    assert.equal(second.success, true);
    assert.equal(second.status, 200);
    assert.equal(second.data.id, first.data.id);
  });
});
