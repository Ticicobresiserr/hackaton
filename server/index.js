import 'dotenv/config';
import express from 'express';
import { addClient, removeClient, broadcast } from './sse.js';
import { router as uploadRouter } from './routes/upload.js';
import { router as githubRouter } from './routes/github.js';
import { router as controlRouter } from './routes/control.js';

const app = express();
const PORT = process.env.SERVER_PORT ?? 3001;

app.use(express.json());

// SSE endpoint
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  // Send initial state
  res.write(`event: status\ndata: ${JSON.stringify({ state: 'idle', message: 'Ready' })}\n\n`);

  addClient(res);
  req.on('close', () => removeClient(res));
});

app.use('/api/upload', uploadRouter);
app.use('/api/github', githubRouter);
app.use('/api/control', controlRouter);

// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
