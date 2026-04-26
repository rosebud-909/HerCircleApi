import { getFirebaseAdminFirestore } from '../firebaseAdmin.js';

const USERS = 'users';

const PLACEHOLDER_BIO =
  'Big fan of cozy nights, good boundaries, and even better playlists. Here to give and get support, share wins, and keep it real.';

// Set to true if you want to overwrite existing non-empty bios.
const OVERWRITE = false;
const REPLACE_THESE_BIOS = new Set(['Bio coming soon.']);

async function main() {
  const db = getFirebaseAdminFirestore();

  let updated = 0;
  let skipped = 0;
  let scanned = 0;

  const PAGE_SIZE = 500;
  const BATCH_LIMIT = 400; // keep safety margin under Firestore 500 writes

  let last = null;

  while (true) {
    let q = db.collection(USERS).orderBy('__name__').limit(PAGE_SIZE);
    if (last) q = q.startAfter(last);

    const page = await q.get();
    if (page.empty) break;

    scanned += page.size;

    let batch = db.batch();
    let writes = 0;

    for (const doc of page.docs) {
      const data = doc.data() ?? {};
      const existingBio = data.bio;
      const trimmed = existingBio == null ? '' : String(existingBio).trim();
      const hasBio = trimmed !== '' && !REPLACE_THESE_BIOS.has(trimmed);

      if (!OVERWRITE && hasBio) {
        skipped += 1;
        continue;
      }

      batch.set(doc.ref, { bio: PLACEHOLDER_BIO }, { merge: true });
      updated += 1;
      writes += 1;

      if (writes >= BATCH_LIMIT) {
        await batch.commit();
        batch = db.batch();
        writes = 0;
      }
    }

    if (writes > 0) await batch.commit();

    last = page.docs[page.docs.length - 1];
  }

  console.log(
    JSON.stringify(
      {
        placeholderBio: PLACEHOLDER_BIO,
        overwrite: OVERWRITE,
        scanned,
        updated,
        skipped,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exitCode = 1;
});

