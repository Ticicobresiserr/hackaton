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
    // Run BOTH calls in parallel: conversational response + JSON update
    const chatPromise = client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system: `You are an assistant helping a platform owner refine their onboarding program.
The user will ask to add, remove, or change onboarding flows and steps.
Respond with a brief, friendly confirmation of what you'll change (2-3 sentences max).
Do NOT output any JSON, code, or technical details. Just a natural language acknowledgment.`,
      messages: [{ role: 'user', content: message }],
    });

    const jsonPromise = client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      system: `You modify onboarding programs based on user requests.
Given the current program and the user's requested change, output ONLY the complete updated program as valid JSON. No explanation, no markdown fences, just the JSON object.
The JSON must match the exact same schema as the input program.`,
      messages: [
        {
          role: 'user',
          content: `Current program:\n${JSON.stringify(currentProgram, null, 2)}\n\nRequested change: ${message}`,
        },
      ],
    });

    // Stream the chat response while JSON generates in background
    const chatStream = await chatPromise;
    for await (const event of chatStream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ type: 'text', content: event.delta.text })}\n\n`);
      }
    }

    // Signal that program is updating
    res.write(`data: ${JSON.stringify({ type: 'updating' })}\n\n`);

    // Wait for JSON result (may already be done since it ran in parallel)
    const jsonResponse = await jsonPromise;
    const jsonText = jsonResponse.content.find((b) => b.type === 'text')?.text ?? '';
    const cleaned = jsonText
      .replace(/^```(?:json)?\s*/m, '')
      .replace(/\s*```\s*$/m, '')
      .trim();

    try {
      const updated = JSON.parse(cleaned);
      store.setProgram(updated);
      res.write(`data: ${JSON.stringify({ type: 'program', program: updated })}\n\n`);
    } catch {
      const match = cleaned.match(/(\{[\s\S]+\})/);
      if (match) {
        const updated = JSON.parse(match[1]);
        store.setProgram(updated);
        res.write(`data: ${JSON.stringify({ type: 'program', program: updated })}\n\n`);
      } else {
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
