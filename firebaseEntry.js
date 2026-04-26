import 'dotenv/config';
// Registers deploy-time params so STORAGE_BUCKET from CI `.env` is applied to Cloud Run.
import './firebaseParams.js';
import { onRequest } from 'firebase-functions/v2/https';
import { createApp } from './app.js';

const appPromise = createApp();

export const api = onRequest(
  {
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 120,
    invoker: 'public',
  },
  async (req, res) => {
    const app = await appPromise;
    app(req, res);
  },
);
