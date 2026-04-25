/**
 * Loaded first via `node --import ./tests/setup-env.mjs --test`.
 * Keeps tests on the in-memory store and test auth header (no Firebase).
 */
process.env.USE_FIRESTORE = 'false';
process.env.ALLOW_TEST_AUTH = 'true';
delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
