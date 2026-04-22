import { createApp } from './app.js';

const PORT = Number(process.env.PORT) || 3000;

const app = await createApp();
app.listen(PORT, () => {
  console.log(`HerCircle API listening on http://localhost:${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
  console.log(`API base: http://localhost:${PORT}/api/v1`);
});
