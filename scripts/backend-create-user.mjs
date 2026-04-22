/**
 * Creates a Firebase Auth user using the Admin SDK (same credentials as the API).
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json node scripts/backend-create-user.mjs
 *
 * Optional — also calls POST /api/v1/auth/register (API must be running, e.g. `npm start`):
 *   FIREBASE_WEB_API_KEY=... BASE_URL=http://localhost:3000 node scripts/backend-create-user.mjs
 */
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const credPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  resolve(root, 'serviceAccountKey.json');

function initAdmin() {
  if (getApps().length > 0) return;
  const json = JSON.parse(readFileSync(credPath, 'utf8'));
  initializeApp({ credential: cert(json) });
}

async function exchangeCustomTokenForIdToken(customToken, webApiKey) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${webApiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`signInWithCustomToken failed: ${res.status} ${JSON.stringify(body)}`);
  }
  return body.idToken;
}

async function registerProfile(baseUrl, idToken, name, email) {
  const url = `${baseUrl.replace(/\/$/, '')}/api/v1/auth/register`;
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ name, email }),
    });
  } catch (e) {
    const code = e.cause?.code ?? e.code;
    if (code === 'ECONNREFUSED') {
      const hint =
        `Nothing is listening at ${baseUrl}. In another terminal run: ` +
        `GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json npm start`;
      throw Object.assign(new Error('API connection refused'), { code: 'ECONNREFUSED', hint });
    }
    throw e;
  }
  const body = await res.json();
  return { status: res.status, body };
}

async function main() {
  initAdmin();
  const auth = getAuth();
  const stamp = Date.now();
  const email = `backend-created-${stamp}@example.com`;
  const password = `BkTest_${stamp}_aA1!`;

  const user = await auth.createUser({
    email,
    password,
    displayName: 'Backend test user',
    emailVerified: false,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        step: 'firebase_admin_createUser',
        uid: user.uid,
        email: user.email,
      },
      null,
      2,
    ),
  );

  const webKey = process.env.FIREBASE_WEB_API_KEY;
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  if (webKey) {
    const custom = await auth.createCustomToken(user.uid);
    const idToken = await exchangeCustomTokenForIdToken(custom, webKey);
    await auth.verifyIdToken(idToken);
    console.log(JSON.stringify({ step: 'admin_verifyIdToken', ok: true }, null, 2));
    try {
      const reg = await registerProfile(baseUrl, idToken, 'Backend test user', email);
      console.log(
        JSON.stringify(
          {
            step: 'api_auth_register',
            httpStatus: reg.status,
            body: reg.body,
          },
          null,
          2,
        ),
      );
      if (reg.status >= 400) process.exitCode = 1;
    } catch (e) {
      if (e.code === 'ECONNREFUSED') {
        console.log(
          JSON.stringify(
            {
              step: 'api_auth_register',
              ok: false,
              error: 'connection_refused',
              baseUrl,
              hint: e.hint,
            },
            null,
            2,
          ),
        );
        process.exitCode = 1;
        return;
      }
      throw e;
    }
  } else {
    console.log(
      '(Set FIREBASE_WEB_API_KEY to also call POST /api/v1/auth/register on BASE_URL)',
    );
  }
}

main().catch((e) => {
  if (e.hint) console.error(e.hint);
  console.error(e.message ?? e);
  process.exit(1);
});
