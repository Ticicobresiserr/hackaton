import { Router } from 'express';
import { stopProject, getCurrentDir } from '../runner.js';
import { runProject } from '../runner.js';
import { broadcast } from '../sse.js';

export const router = Router();

router.post('/stop', async (_req, res) => {
  await stopProject();
  broadcast('status', { state: 'idle', message: 'Stopped by user' });
  res.json({ ok: true });
});

router.post('/restart', async (_req, res) => {
  const dir = getCurrentDir();
  if (!dir) {
    return res.status(400).json({ error: 'No project loaded' });
  }
  res.json({ ok: true });
  await stopProject();
  runProject(dir).catch((err) =>
    broadcast('status', { state: 'error', message: err.message })
  );
});
