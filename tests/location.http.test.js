import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../app.js';
import { clearZipLocationCacheForTests } from '../services/zipLocationResolve.js';

describe('HTTP GET /location/postal', async () => {
  const app = await createApp();
  let originalFetch;

  beforeEach(() => {
    process.env.DISABLE_RATE_LIMIT = 'true';
    clearZipLocationCacheForTests();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.DISABLE_RATE_LIMIT;
  });

  it('returns 400 when country missing', async () => {
    const res = await request(app).get('/api/v1/location/postal').query({ postal: '95132' });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'validation_error');
  });

  it('returns 400 when postal missing', async () => {
    const res = await request(app).get('/api/v1/location/postal').query({ country: 'US' });
    assert.equal(res.status, 400);
  });

  it('returns zippopotam-shaped location and caches (single upstream fetch)', async () => {
    let calls = 0;
    globalThis.fetch = async (url) => {
      calls += 1;
      assert.match(String(url), /api\.zippopotam\.us\/us\/90210/);
      return {
        ok: true,
        json: async () => ({
          places: [{ 'place name': 'Beverly Hills', 'state abbreviation': 'CA' }],
        }),
      };
    };

    const res1 = await request(app).get('/api/v1/location/postal').query({ country: 'US', postal: '90210' });
    assert.equal(res1.status, 200);
    assert.equal(res1.body.data.location, 'Beverly Hills, CA');
    assert.equal(res1.body.data.source, 'zippopotam');

    const res2 = await request(app).get('/api/v1/location/postal').query({ country: 'US', postal: '90210' });
    assert.equal(res2.status, 200);
    assert.equal(res2.body.data.location, 'Beverly Hills, CA');
    assert.equal(calls, 1);
  });

  it('non-US returns fallback label', async () => {
    globalThis.fetch = async () => assert.fail('fetch should not run for non-US');
    const res = await request(app).get('/api/v1/location/postal').query({ country: 'GB', postal: 'SW1A1AA' });
    assert.equal(res.status, 200);
    assert.match(res.body.data.location, /^SW1A1AA,/);
    assert.equal(res.body.data.source, 'fallback');
  });
});
