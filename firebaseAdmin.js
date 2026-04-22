import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { createRequire } from 'module';

// NOTE: firebase-admin uses optional dependencies in some environments.
// `createRequire` keeps module resolution predictable in ESM.
createRequire(import.meta.url);

function initFirebaseAdmin() {
  if (getApps().length > 0) return;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    const parsed = JSON.parse(serviceAccountJson);
    initializeApp({ credential: cert(parsed) });
    return;
  }

  // Supports GOOGLE_APPLICATION_CREDENTIALS (recommended for local dev + servers)
  initializeApp({ credential: applicationDefault() });
}

export function getFirebaseAdminAuth() {
  initFirebaseAdmin();
  return getAuth();
}

export function getFirebaseAdminFirestore() {
  initFirebaseAdmin();
  return getFirestore();
}

