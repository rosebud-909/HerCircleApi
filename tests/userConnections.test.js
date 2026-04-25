import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { communityConnectedUserIdsFromChats } from '../services/userConnections.js';

describe('communityConnectedUserIdsFromChats', () => {
  it('collects other participants from community threads only', () => {
    const ids = communityConnectedUserIdsFromChats(
      [
        { requestId: null, participants: ['u1', 'u2'] },
        { requestId: 'req1', participants: ['u1', 'u3'] },
        { requestId: '', participants: ['u1', 'u4'] },
        { requestId: null, participants: ['u1', 'u2'] },
      ],
      'u1',
    );
    assert.deepEqual(ids, ['u2', 'u4']);
  });

  it('treats missing requestId like community', () => {
    const ids = communityConnectedUserIdsFromChats([{ participants: ['a', 'b'] }], 'a');
    assert.deepEqual(ids, ['b']);
  });
});
