import { Router } from 'express';
import multer from 'multer';
import unzipper from 'unzipper';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import { broadcast } from '../sse.js';
import { runProject } from '../runner.js';

export const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
});

router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // Validate ZIP magic bytes: PK\x03\x04
  const buf = req.file.buffer;
  if (buf[0] !== 0x50 || buf[1] !== 0x4b || buf[2] !== 0x03 || buf[3] !== 0x04) {
    return res.status(400).json({ error: 'File is not a valid ZIP archive' });
  }

  const destDir = `/tmp/hackaton-${randomUUID()}`;

  broadcast('status', { state: 'setting-up', message: 'Extracting ZIP...' });

  try {
    await fs.mkdir(destDir, { recursive: true });

    const directory = await unzipper.Open.buffer(buf);
    const destResolved = path.resolve(destDir);

    for (const file of directory.files) {
      // ZIP slip prevention
      const entryPath = path.join(destDir, file.path);
      const entryResolved = path.resolve(entryPath);
      if (!entryResolved.startsWith(destResolved + path.sep) && entryResolved !== destResolved) {
        broadcast('status', { state: 'error', message: 'ZIP contains unsafe paths' });
        return res.status(400).json({ error: 'ZIP contains unsafe paths' });
      }

      if (file.type === 'Directory') {
        await fs.mkdir(entryPath, { recursive: true });
      } else {
        await fs.mkdir(path.dirname(entryPath), { recursive: true });
        const content = await file.buffer();
        await fs.writeFile(entryPath, content);
      }
    }
  } catch (err) {
    broadcast('status', { state: 'error', message: `Extraction failed: ${err.message}` });
    return res.status(500).json({ error: 'Extraction failed' });
  }

  res.json({ ok: true });
  // Run in background — don't await
  runProject(destDir).catch((err) =>
    broadcast('status', { state: 'error', message: err.message })
  );
});
