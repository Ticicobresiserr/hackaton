import { Router } from 'express';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { broadcast } from '../sse.js';
import { runProject } from '../runner.js';

export const router = Router();

router.post('/', async (req, res) => {
  const { url, token } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'url is required' });
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  if (parsed.hostname !== 'github.com') {
    return res.status(400).json({ error: 'Only github.com URLs are supported' });
  }

  const destDir = `/tmp/hackaton-${randomUUID()}`;

  // Build authenticated URL (never log this)
  let cloneUrl = url;
  if (token) {
    cloneUrl = `https://${encodeURIComponent(token)}@github.com${parsed.pathname}`;
  }

  broadcast('status', { state: 'downloading', message: 'Cloning repository...' });

  const git = spawn('git', ['clone', '--depth=1', cloneUrl, destDir], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  git.stdout.on('data', (d) =>
    broadcast('log', { line: d.toString(), stream: 'stdout' })
  );
  git.stderr.on('data', (d) =>
    broadcast('log', { line: d.toString(), stream: 'stderr' })
  );

  git.on('error', (err) => {
    broadcast('status', { state: 'error', message: `Git error: ${err.message}` });
    res.status(500).json({ error: 'Git clone failed' });
  });

  git.on('close', (code) => {
    if (code !== 0) {
      broadcast('status', { state: 'error', message: 'Git clone failed' });
      if (!res.headersSent) res.status(500).json({ error: 'Git clone failed' });
      return;
    }
    if (!res.headersSent) res.json({ ok: true });
    runProject(destDir).catch((err) =>
      broadcast('status', { state: 'error', message: err.message })
    );
  });
});
