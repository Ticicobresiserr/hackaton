import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { store } from '../store.js';

export const router = Router();
const client = new Anthropic();

// Get all sessions (for dashboard)
router.get('/sessions', (_req, res) => {
  res.json({ sessions: store.getAllSessions() });
});

// Chat endpoint for onboarding
router.post('/chat', async (req, res) => {
  const { sessionId, userName, message, currentUrl, pageContext } = req.body;

  const program = store.getProgram();
  if (!program) {
    return res.status(400).json({ error: 'No program published yet' });
  }

  // Get or create session
  let session = store.getSession(sessionId);
  if (!session) {
    session = {
      id: sessionId,
      userName: userName || 'User',
      currentFlowIndex: 0,
      currentStepIndex: 0,
      completedFlows: [],
      completedSteps: [],
      startedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      chatHistory: [],
    };
  }

  // Add user message to history
  session.chatHistory.push({
    role: 'user',
    content: message,
    timestamp: new Date().toISOString(),
  });
  session.lastActiveAt = new Date().toISOString();

  const currentFlow = program.flows[session.currentFlowIndex];
  const currentStep = currentFlow?.steps[session.currentStepIndex];
  const totalSteps = program.flows.reduce((sum, f) => sum + f.steps.length, 0);
  const completedCount = session.completedSteps.length;

  // Set up SSE for this response
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  try {
    const allFlowsDone = session.currentFlowIndex >= program.flows.length;

    const systemPrompt = `You are Sherpa 🏔️, a witty and warm onboarding guide who's helped thousands of users up the "product mountain." You speak like a trail guide who's seen it all — confident, cheeky, encouraging, and always dropping quick metaphors about climbing, paths, base camps, and summits. Use emojis naturally (⛰️🧗‍♂️🎒🗺️🏕️🚩🔭🧭). Be genuinely fun — the kind of guide who makes people smile. One-liners, not paragraphs.

You are guiding ${session.userName} through ${program.platformName}.

CRITICAL FORMATTING RULES:
- Keep each bubble to 1-2 SHORT sentences MAX.
- Use "|||" to split your response into separate chat bubbles.
- Example: "Hey ${session.userName}! Ready to summit? 🏔️|||First base camp: let's create your first project. |||Hit the **New Project** button in the sidebar 👈"
- NEVER write paragraphs. NEVER exceed 2 sentences per bubble.
- Use **bold** for UI elements (buttons, links, fields).
- Be direct: tell them exactly what to click/type.
- NEVER mention URLs, localhost, ports, or technical details. You're talking to an end user, not a developer.
- NEVER include sign-in/login/authentication steps. The user is ALREADY signed in — they're inside the app right now. Skip any sign-in flows entirely and move to the next meaningful step.

ONBOARDING PROGRAM:
${JSON.stringify(program.flows, null, 2)}

PROGRESS:
- Flow: ${allFlowsDone ? 'ALL COMPLETE' : `"${currentFlow?.name}" (${session.currentFlowIndex + 1}/${program.flows.length})`}
- Step: ${allFlowsDone ? 'N/A' : `"${currentStep?.title}" (${session.currentStepIndex + 1}/${currentFlow?.steps.length ?? 0})`}
- Done: ${completedCount}/${totalSteps} steps

${allFlowsDone ? '' : `CURRENT STEP:\n${JSON.stringify(currentStep, null, 2)}`}

WHAT THE USER SEES RIGHT NOW (live DOM context):
${pageContext ? `- Page title: ${pageContext.title}
- Headings on screen: ${(pageContext.headings || []).join(', ') || 'none'}
- Buttons/links visible: ${(pageContext.buttons || []).join(', ') || 'none'}
- Input fields: ${(pageContext.inputs || []).join(', ') || 'none'}
- Navigation links: ${(pageContext.navLinks || []).join(', ') || 'none'}` : '(no page context available)'}

IMPORTANT: Use the DOM context above to give ACCURATE instructions. Reference the ACTUAL buttons, headings, and elements the user can see — not generic descriptions.

RULES:
1. ONE step at a time. Never skip ahead.
2. If the current step is about signing in, logging in, or authentication — SKIP IT. Immediately mark it complete and move to the next real step.
3. Give specific UI instructions — tell them exactly what to click.
4. When user confirms completion ("done", "next", "yes", "did it"), mark step complete and introduce next step.
5. On first message: quick fun welcome (1 bubble) + jump straight into the first real action step (1-2 bubbles).
6. When a flow finishes, brief congrats + intro next flow.
7. When ALL done, short celebration with mountain summit metaphor.

STEP COMPLETION:
When user completes the current step (or you skip a sign-in step), put this marker at the END on its own line:
===STEP_COMPLETE===`;

    // Build messages from chat history (last 20 for context)
    const recentHistory = session.chatHistory.slice(-20);
    const messages = recentHistory.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages,
    });

    let fullResponse = '';

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        fullResponse += event.delta.text;
        res.write(`data: ${JSON.stringify({ type: 'text', content: event.delta.text })}\n\n`);
      }
    }

    // Check for step completion
    if (fullResponse.includes('===STEP_COMPLETE===') && currentStep) {
      session.completedSteps.push(currentStep.id);
      session.currentStepIndex++;

      // Check if flow is complete
      if (session.currentStepIndex >= (currentFlow?.steps.length ?? 0)) {
        session.completedFlows.push(currentFlow.id);
        session.currentFlowIndex++;
        session.currentStepIndex = 0;
      }
    }

    // Clean markers from the saved response
    const cleanedResponse = fullResponse
      .replace(/===STEP_COMPLETE===/g, '')
      .replace(/===FLOW_COMPLETE===/g, '')
      .trim();

    session.chatHistory.push({
      role: 'assistant',
      content: cleanedResponse,
      timestamp: new Date().toISOString(),
    });

    store.setSession(sessionId, session);

    // Send progress update
    res.write(
      `data: ${JSON.stringify({
        type: 'progress',
        currentFlowIndex: session.currentFlowIndex,
        currentStepIndex: session.currentStepIndex,
        completedSteps: session.completedSteps,
        completedFlows: session.completedFlows,
        totalFlows: program.flows.length,
        totalSteps,
      })}\n\n`
    );

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
    res.end();
  }
});
