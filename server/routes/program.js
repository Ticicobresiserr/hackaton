import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { store } from '../store.js';

export const router = Router();
const client = new Anthropic();

router.get('/', (_req, res) => {
  const program = store.getProgram();
  res.json({ program, published: store.isPublished() });
});

router.post('/publish', (_req, res) => {
  if (!store.getProgram()) {
    return res.status(400).json({ error: 'No program to publish' });
  }
  store.publish();
  res.json({ ok: true });
});

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
    // Single Haiku call — responds conversationally AND outputs a JSON patch
    const stream = await client.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      system: `You are Sherpa, an expert onboarding architect. You speak concisely and confidently — like a seasoned product consultant who has designed onboarding for hundreds of SaaS products. You're direct, warm, and opinionated. You call the user "you" not "the user." If a request is vague, you make a smart default choice and explain why. You never say "Sure!" or "Of course!" — you just do it.

Given the current program and a user request, respond in TWO parts:

1. A brief confirmation (1-2 sentences, no JSON).
2. Then the exact marker ===PATCH=== on its own line, followed by a JSON array of patch operations:

Supported ops:
- {"op":"remove_flow","flow_id":"flow_X"} — removes a flow
- {"op":"remove_step","flow_id":"flow_X","step_id":"flow_X_step_Y"} — removes a step
- {"op":"add_step","flow_id":"flow_X","after_step_id":"flow_X_step_Y","step":{"id":"...","title":"...","instruction":"...","explanation":"...","page":"...","order":N}} — adds a step
- {"op":"update_step","flow_id":"flow_X","step_id":"flow_X_step_Y","updates":{"title":"...","instruction":"..."}} — modifies a step
- {"op":"update_flow","flow_id":"flow_X","updates":{"name":"...","description":"..."}} — modifies a flow

Current program flows: ${JSON.stringify(currentProgram.flows.map(f => ({ id: f.id, name: f.name, steps: f.steps.map(s => ({ id: s.id, title: s.title })) })))}`,
      messages: [{ role: 'user', content: message }],
    });

    let fullText = '';

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        fullText += event.delta.text;
        // Only stream text BEFORE the patch marker
        if (!fullText.includes('===PATCH===')) {
          res.write(`data: ${JSON.stringify({ type: 'text', content: event.delta.text })}\n\n`);
        }
      }
    }

    // Apply patch
    const patchMarker = fullText.indexOf('===PATCH===');
    if (patchMarker !== -1) {
      const patchStr = fullText.slice(patchMarker + '===PATCH==='.length).trim()
        .replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();

      try {
        const ops = JSON.parse(patchStr);
        const updated = applyPatch(currentProgram, ops);
        store.setProgram(updated);
        res.write(`data: ${JSON.stringify({ type: 'program', program: updated })}\n\n`);
      } catch (e) {
        console.error('[refine] Patch parse error:', e.message, patchStr.slice(0, 200));
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Failed to apply changes' })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
    res.end();
  }
});

function applyPatch(program, ops) {
  const updated = JSON.parse(JSON.stringify(program)); // deep clone

  for (const op of ops) {
    if (op.op === 'remove_flow') {
      updated.flows = updated.flows.filter(f => f.id !== op.flow_id);
    } else if (op.op === 'remove_step') {
      const flow = updated.flows.find(f => f.id === op.flow_id);
      if (flow) flow.steps = flow.steps.filter(s => s.id !== op.step_id);
    } else if (op.op === 'add_step' && op.step) {
      const flow = updated.flows.find(f => f.id === op.flow_id);
      if (flow) {
        const idx = op.after_step_id
          ? flow.steps.findIndex(s => s.id === op.after_step_id) + 1
          : flow.steps.length;
        flow.steps.splice(idx, 0, op.step);
      }
    } else if (op.op === 'update_step' && op.updates) {
      const flow = updated.flows.find(f => f.id === op.flow_id);
      const step = flow?.steps.find(s => s.id === op.step_id);
      if (step) Object.assign(step, op.updates);
    } else if (op.op === 'update_flow' && op.updates) {
      const flow = updated.flows.find(f => f.id === op.flow_id);
      if (flow) Object.assign(flow, op.updates);
    }
  }

  // Reorder
  updated.flows.forEach((f, i) => {
    f.order = i + 1;
    f.steps.forEach((s, j) => { s.order = j + 1; });
  });

  return updated;
}
