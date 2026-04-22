import express from 'express';
import cors from 'cors';
import v1 from './routes/v1.js';

export async function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/v1', v1);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  return app;
}
