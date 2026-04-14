import 'dotenv/config';
import express from 'express';
import { addClient, removeClient, broadcast } from './sse.js';
import { store } from './store.js';
import { router as uploadRouter } from './routes/upload.js';
import { router as githubRouter } from './routes/github.js';
import { router as controlRouter } from './routes/control.js';
import { router as programRouter } from './routes/program.js';
import { router as onboardRouter } from './routes/onboard.js';

const app = express();
const PORT = process.env.SERVER_PORT ?? 3001;

app.use(express.json());

// CORS — allow direct browser connections from Next.js dev server
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (_req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Serve widget static files
app.use('/widget', express.static(new URL('./public', import.meta.url).pathname));

// SSE endpoint
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  // Send CURRENT state (not hardcoded idle) — prevents reset on reconnect
  const currentStatus = store.getStatus();
  res.write(`event: status\ndata: ${JSON.stringify(currentStatus)}\n\n`);

  // Also send program if it exists
  const program = store.getProgram();
  if (program) {
    res.write(`event: program\ndata: ${JSON.stringify({ program })}\n\n`);
  }

  addClient(res);
  req.on('close', () => removeClient(res));
});

app.use('/api/upload', uploadRouter);
app.use('/api/github', githubRouter);
app.use('/api/control', controlRouter);
app.use('/api/program', programRouter);
app.use('/api/onboard', onboardRouter);

// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
