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
    const info = e && typeof e === 'object' && e !== null ? e : {};
    const top = 'code' in info && typeof info.code === 'string' ? info.code : '';
    const nested =
      'errorInfo' in info && info.errorInfo && typeof info.errorInfo === 'object' && 'code' in info.errorInfo
        ? String(info.errorInfo.code)
        : '';
    if (top === 'storage/invalid-argument' || nested === 'storage/invalid-argument') return;
    console.error('[deleteAccount] storage cleanup failed', e);
  }
}
