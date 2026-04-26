import 'dotenv/config';
import { getFirebaseAdminAuth } from '../firebaseAdmin.js';

const emails = [
  'rlei99@gmail.com',
  'isaiahlove085@gmail.com',
];

const auth = getFirebaseAdminAuth();

for (const email of emails) {
  const user = await auth.getUserByEmail(email);
  const prev = user.customClaims || {};
  await auth.setCustomUserClaims(user.uid, { ...prev, admin: true });
  console.log(JSON.stringify({ email, uid: user.uid, admin: true }, null, 2));
}

console.log('Done. Users must re-login (or refresh ID token) to pick up claims.');

