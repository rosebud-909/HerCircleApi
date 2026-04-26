import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  peerIdIsDiscoverableForCommunity,
  pickDiscoverableMembers,
  toCommunityMemberRow,
} from '../lib/communityMembers.js';

describe('communityMembers', () => {
  it('toCommunityMemberRow omits email and includes bio', () => {
    const row = toCommunityMemberRow({
      id: '1',
      name: 'A',
      location: 'X',
      bio: 'Hello',
      verificationStatus: 'verified',
    });
    assert.deepEqual(row, {
      id: '1',
      name: 'A',
      location: 'X',
      bio: 'Hello',
      verificationStatus: 'verified',
    });
    assert.equal('email' in row, false);
  });

  it('pickDiscoverableMembers excludes self and sorts by name', () => {
    const users = [
      { id: 'self', name: 'Zoe', verificationStatus: 'unverified' },
      { id: 'a', name: 'Amy', verificationStatus: 'verified' },
      { id: 'b', name: 'Bob', verificationStatus: 'unverified' },
    ];
    const out = pickDiscoverableMembers(users, 'self', { limit: 10 });
    assert.deepEqual(
      out.map((x) => x.id),
      ['a', 'b'],
    );
  });

  it('respects limit', () => {
    const users = Array.from({ length: 5 }, (_, i) => ({
      id: `u${i}`,
      name: `User${i}`,
      verificationStatus: 'unverified',
    }));
    const out = pickDiscoverableMembers(users, 'u0', { limit: 2 });
    assert.equal(out.length, 2);
  });

  it('peerIdIsDiscoverableForCommunity respects the same limit', () => {
    const users = [
      { id: 'self', name: 'Self', verificationStatus: 'unverified' },
      { id: 'a', name: 'Amy', verificationStatus: 'unverified' },
      { id: 'b', name: 'Bob', verificationStatus: 'unverified' },
    ];
    assert.equal(peerIdIsDiscoverableForCommunity(users, 'self', 'a', { limit: 1 }), true);
    assert.equal(peerIdIsDiscoverableForCommunity(users, 'self', 'b', { limit: 1 }), false);
  });

  it('excludes admins who have not opted into the community directory', () => {
    const adminFlags = new Map([['b', true]]);
    const users = [
      { id: 'self', name: 'Self', verificationStatus: 'unverified' },
      { id: 'a', name: 'Amy', verificationStatus: 'verified' },
      { id: 'b', name: 'Bob', verificationStatus: 'unverified', listInCommunityDirectory: false },
    ];
    const out = pickDiscoverableMembers(users, 'self', { limit: 10, adminFlags });
    assert.deepEqual(
      out.map((x) => x.id),
      ['a'],
    );
  });

  it('includes admins who opted in, with flags on the row', () => {
    const adminFlags = new Map([['b', true]]);
    const users = [
      { id: 'self', name: 'Self', verificationStatus: 'unverified' },
      { id: 'b', name: 'Bob', verificationStatus: 'unverified', listInCommunityDirectory: true },
    ];
    const out = pickDiscoverableMembers(users, 'self', { limit: 10, adminFlags });
    assert.equal(out.length, 1);
    assert.equal(out[0].isAdmin, true);
    assert.equal(out[0].listInCommunityDirectory, true);
  });
});
