import { getFirebaseAdminStorageBucket } from '../firebaseAdmin.js';

/**
 * Best-effort removal of GCS objects owned by this Firebase uid (verification uploads,
 * profile photos under the documented client path).
 */
export async function deleteUserOwnedStorageObjects(userId) {
  const uid = String(userId);
  const prefixes = [`verification/${uid}/`, `profile-photos/${uid}/`];
  try {
    const bucket = getFirebaseAdminStorageBucket();
    for (const prefix of prefixes) {
      const [files] = await bucket.getFiles({ prefix });
      await Promise.all(files.map((f) => f.delete({ ignoreNotFound: true }).catch(() => null)));
    }
  } catch (e) {
    const code = e && typeof e === 'object' && 'code' in e ? String((/** @type {{ code?: string }} */ (e)).code) : '';
    const nested =
      e && typeof e === 'object' && e !== null && 'errorInfo' in e && typeof (/** @type {{ errorInfo?: { code?: string } }} */ (e)).errorInfo === 'object'
        ? String((/** @type {{ errorInfo?: { code?: string } }} */ (e)).errorInfo?.code ?? '')
        : '';
    if (code === 'storage/invalid-argument' || nested === 'storage/invalid-argument') return;
    console.error('[deleteAccount] storage cleanup failed', e);
  }
}
