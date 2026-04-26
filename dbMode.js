function envFlag(name) {
  const v = process.env[name];
  if (!v) return undefined;
  return ['1', 'true', 'yes', 'on'].includes(String(v).trim().toLowerCase());
}

function runningOnGoogleServerless() {
  // Cloud Run (incl. many Firebase Functions v2 workloads)
  if (process.env.K_SERVICE) return true;
  // Cloud Functions
  if (process.env.FUNCTION_TARGET || process.env.FUNCTION_NAME) return true;
  return false;
}

export function useFirestore() {
  const explicit = envFlag('USE_FIRESTORE');
  if (explicit !== undefined) return explicit;

  // On Cloud Run / Functions, ADC is available without these env vars — use Firestore by default.
  if (runningOnGoogleServerless()) return true;

  // Local / custom servers: persist when credentials are configured.
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS);
}
