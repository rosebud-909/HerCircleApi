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
  // Firebase-deployed Functions: env keys prefixed with FIREBASE_ are reserved; use STORAGE_BUCKET (or GCLOUD_STORAGE_BUCKET) in prod.
  const storageBucket =
    process.env.STORAGE_BUCKET ||
    process.env.GCLOUD_STORAGE_BUCKET ||
    process.env.FIREBASE_STORAGE_BUCKET;
  if (serviceAccountJson) {
    const parsed = JSON.parse(serviceAccountJson);
    initializeApp({
      credential: cert(parsed),
      ...(storageBucket ? { storageBucket } : {}),
    });
  } else {
    // Supports GOOGLE_APPLICATION_CREDENTIALS (recommended for local dev + servers)
    // and Application Default Credentials on Cloud Run / Cloud Functions.
    initializeApp({
      credential: applicationDefault(),
      ...(storageBucket ? { storageBucket } : {}),
    });
  }

  // Avoid Firestore rejecting merged user docs that contain `undefined` fields.
  getFirestore().settings({ ignoreUndefinedProperties: true });
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
  const name = [process.env.STORAGE_BUCKET, process.env.GCLOUD_STORAGE_BUCKET, process.env.FIREBASE_STORAGE_BUCKET]
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .find(Boolean);
  if (name) return getStorage().bucket(name);
  return getStorage().bucket();
}

