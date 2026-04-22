import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });

export const verificationUpload = upload.fields([
  { name: 'governmentIdFront', maxCount: 1 },
  { name: 'governmentIdBack', maxCount: 1 },
  { name: 'selfieImage', maxCount: 1 },
]);
