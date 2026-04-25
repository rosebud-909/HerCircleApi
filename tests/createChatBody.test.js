import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseCreateChatBody } from '../lib/createChatBody.js';

describe('parseCreateChatBody', () => {
  it('accepts requestId only', () => {
    const r = parseCreateChatBody({ requestId: 'req_1' });
    assert.equal(r.ok, true);
    assert.equal(r.kind, 'request');
    assert.equal(r.requestId, 'req_1');
  });

  it('trims requestId', () => {
    const r = parseCreateChatBody({ requestId: '  abc  ' });
    assert.equal(r.ok, true);
    assert.equal(r.requestId, 'abc');
  });

  it('accepts peerUserId only', () => {
    const r = parseCreateChatBody({ peerUserId: 'u_peer' });
    assert.equal(r.ok, true);
    assert.equal(r.kind, 'community');
    assert.equal(r.peerUserId, 'u_peer');
  });

  it('rejects both fields', () => {
    const r = parseCreateChatBody({ requestId: 'r1', peerUserId: 'u2' });
    assert.equal(r.ok, false);
    assert.equal(r.status, 400);
  });

  it('rejects neither field', () => {
    const r = parseCreateChatBody({});
    assert.equal(r.ok, false);
    assert.equal(r.code, 'validation_error');
  });

  it('rejects empty strings as missing', () => {
    const r = parseCreateChatBody({ requestId: '', peerUserId: '' });
    assert.equal(r.ok, false);
  });
});
