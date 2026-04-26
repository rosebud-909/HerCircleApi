import { defineString } from 'firebase-functions/params';

/** Injected at deploy from `.env` (CI) or Firebase console. Empty = use default project bucket. */
export const storageBucket = defineString('STORAGE_BUCKET', {
  default: '',
  description: 'Firebase Storage bucket id (e.g. my-project.appspot.com)',
});
