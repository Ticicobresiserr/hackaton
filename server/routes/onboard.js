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
  const { sessionId, userName, message, currentUrl } = req.body;

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

    const systemPrompt = `You are a friendly, expert onboarding guide for "${program.platformName}" — ${program.platformDescription}.

You are guiding a user named "${session.userName}" through the onboarding program step by step.

FULL ONBOARDING PROGRAM:
${JSON.stringify(program.flows, null, 2)}

CURRENT PROGRESS:
- Current flow: ${allFlowsDone ? 'ALL COMPLETE' : `"${currentFlow?.name}" (${session.currentFlowIndex + 1}/${program.flows.length})`}
- Current step: ${allFlowsDone ? 'N/A' : `"${currentStep?.title}" (step ${session.currentStepIndex + 1}/${currentFlow?.steps.length ?? 0})`}
- Overall progress: ${completedCount}/${totalSteps} steps completed
- Completed steps: ${JSON.stringify(session.completedSteps)}
${currentUrl ? `- User's current URL: ${currentUrl}` : ''}

${allFlowsDone ? '' : `CURRENT STEP DETAILS:\n${JSON.stringify(currentStep, null, 2)}`}

BEHAVIOR RULES:
1. Guide the user through ONE step at a time. Don't overwhelm them.
2. Give clear, specific UI instructions using the step data.
3. When the user says they're done / completed a step / confirms — mark it as complete and move to the next step.
4. If the user is confused or stuck, rephrase the instructions more simply. Reference visual landmarks on the page.
5. If the user asks about something unrelated to the current step, briefly answer then redirect to the current step.
6. Be encouraging but not overly cheerful. Professional and helpful.
7. When all steps in a flow are done, congratulate briefly and introduce the next flow.
8. When ALL flows are done, congratulate and say onboarding is complete.
9. If this is the user's first message, welcome them and introduce the current flow and step.

STEP COMPLETION:
When you determine the user has completed the current step, include this EXACT marker at the very END of your response on its own line:
===STEP_COMPLETE===

Only include this marker when you are confident the step is actually done (user confirmed, said "done", "next", "yes", "I did it", etc).`;

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
