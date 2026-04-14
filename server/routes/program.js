import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { store } from '../store.js';

export const router = Router();
const client = new Anthropic();

// Get current program
router.get('/', (_req, res) => {
  const program = store.getProgram();
  res.json({ program, published: store.isPublished() });
});

// Publish program
router.post('/publish', (_req, res) => {
  if (!store.getProgram()) {
    return res.status(400).json({ error: 'No program to publish' });
  }
  store.publish();
  res.json({ ok: true });
});

// Refine program via chat
router.post('/refine', async (req, res) => {
  const { message } = req.body;
  const currentProgram = store.getProgram();

  if (!currentProgram) {
    return res.status(400).json({ error: 'No program to refine' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  try {
    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      system: `You are refining an onboarding program for a web platform based on the owner's feedback.

Current program:
${JSON.stringify(currentProgram, null, 2)}

The user will ask you to modify flows, add steps, remove steps, reorder things, etc.

Respond in two parts:
1. A brief natural language acknowledgment of what you changed (2-3 sentences max)
2. Then on a new line, the marker ===PROGRAM_JSON=== followed by the COMPLETE updated program JSON

IMPORTANT: Always return the COMPLETE program (all flows, all steps), not just the changed parts. The JSON must be valid and match the original schema exactly.`,
      messages: [{ role: 'user', content: message }],
    });

    let fullText = '';

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        fullText += event.delta.text;
        res.write(`data: ${JSON.stringify({ type: 'text', content: event.delta.text })}\n\n`);
      }
    }

    // Extract updated program JSON
    const jsonMarker = '===PROGRAM_JSON===';
    const markerIndex = fullText.indexOf(jsonMarker);
    if (markerIndex !== -1) {
      const jsonStr = fullText
        .slice(markerIndex + jsonMarker.length)
        .trim()
        .replace(/^```(?:json)?\s*/m, '')
        .replace(/\s*```\s*$/m, '')
        .trim();
      try {
        const updated = JSON.parse(jsonStr);
        store.setProgram(updated);
        res.write(`data: ${JSON.stringify({ type: 'program', program: updated })}\n\n`);
      } catch {
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Failed to parse updated program' })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
    res.end();
  }
});
