import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { createRequire } from 'module';

// NOTE: firebase-admin uses optional dependencies in some environments.
// `createRequire` keeps module resolution predictable in ESM.
createRequire(import.meta.url);

function initFirebaseAdmin() {
  if (getApps().length > 0) return;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;
  if (serviceAccountJson) {
    const parsed = JSON.parse(serviceAccountJson);
    initializeApp({
      credential: cert(parsed),
      ...(storageBucket ? { storageBucket } : {}),
    });
    return;
  }

  // Supports GOOGLE_APPLICATION_CREDENTIALS (recommended for local dev + servers)
  initializeApp({
    credential: applicationDefault(),
    ...(storageBucket ? { storageBucket } : {}),
  });
}

export function getFirebaseAdminAuth() {
  initFirebaseAdmin();
  return getAuth();
}

export function getFirebaseAdminFirestore() {
  initFirebaseAdmin();
  return getFirestore();
}

export function getFirebaseAdminStorageBucket() {
  initFirebaseAdmin();
  return getStorage().bucket();
}

