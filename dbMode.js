function envFlag(name) {
  const v = process.env[name];
  if (!v) return undefined;
  return ['1', 'true', 'yes', 'on'].includes(String(v).trim().toLowerCase());
}

export function useFirestore() {
  const explicit = envFlag('USE_FIRESTORE');
  if (explicit !== undefined) return explicit;

  // Default: if Firebase Admin credentials are configured, persist to Firestore.
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS);
}
