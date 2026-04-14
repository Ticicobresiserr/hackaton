# Onboarding Agent Platform — Hackathon Implementation Spec

## What We're Building

A platform where SaaS owners upload their codebase, an AI agent (Opus 4.6 with extended thinking) analyzes it to detect all critical user flows, generates a structured onboarding program, and then a second agent guides end users through that program step by step via chat.

---

## Architecture

```
                         PLATFORM OWNER FLOW
                         ==================
  Upload repo (ZIP/GitHub)
           |
           v
  +-----------------+     +----------------------+
  | Existing Runner |     | NEW: Flow Analyzer   |
  | (install + run) |     | (Opus 4.6 + thinking)|
  | Sonnet 4.6      |     | 1M context window    |
  +-----------------+     +----------------------+
           |                        |
           v                        v
  App running on          Onboarding Program
  localhost:XXXX          (flows + steps JSON)
                                    |
                          Owner refines via chat
                                    |
                          "Publish" → persisted
                          
                         END USER FLOW
                         =============
  /onboard page
  +---------------------------+------------------+
  | Running app (iframe)      | Onboarding Chat  |
  | localhost:XXXX            | Sonnet 4.6       |
  |                           | with program     |
  |                           | as cached context|
  +---------------------------+------------------+
           User follows              Agent guides
           instructions              step by step
```

---

## What Already Exists (DO NOT REBUILD)

| File | What it does | Keep as-is? |
|------|-------------|-------------|
| `server/index.js` | Express server, SSE endpoint, route mounting | Modify to add new routes |
| `server/sse.js` | SSE broadcast to all clients | Keep |
| `server/agent.js` | Sonnet 4.6 DevOps analysis (how to run) | Keep |
| `server/runner.js` | Install + run project, port detection | Modify to trigger flow analysis |
| `server/portDetector.js` | Detect port from stdout | Keep |
| `server/routes/upload.js` | ZIP upload + extraction | Keep |
| `server/routes/github.js` | GitHub clone | Keep |
| `server/routes/control.js` | Stop/restart project | Keep |
| `client/src/app/page.tsx` | Upload UI (DropZone + GitHubForm) | Modify to add navigation + analysis view |
| `client/src/components/*` | DropZone, GitHubForm, LogPanel, ActionBar, StatusBadge | Keep |
| `client/src/hooks/useSSE.ts` | SSE client hook | Modify to handle new events |

---

## New Files to Create

### Server

| File | Purpose | Owner |
|------|---------|-------|
| `server/flowAnalyzer.js` | Opus 4.6 analysis agent — reads repo, detects flows, streams thinking | Person 2 |
| `server/routes/program.js` | GET/POST program, chat refinement endpoint | Person 2 |
| `server/routes/onboard.js` | Onboarding chat endpoint (Sonnet 4.6) | Person 2 |
| `server/store.js` | In-memory store for program + user sessions | Person 2 |

### Client

| File | Purpose | Owner |
|------|---------|-------|
| `client/src/app/program/page.tsx` | Program view: flow cards + refinement chat | Person 1 |
| `client/src/app/onboard/page.tsx` | Split view: iframe (running app) + chat | Person 3 |
| `client/src/app/dashboard/page.tsx` | User progress through flows | Person 1 |
| `client/src/components/FlowCard.tsx` | Single flow card with expandable steps | Person 1 |
| `client/src/components/ChatPanel.tsx` | Reusable chat UI (messages + input) | Person 1 |
| `client/src/components/NavBar.tsx` | Top navigation bar between pages | Person 1 |

---

## Data Models

```typescript
// === ONBOARDING PROGRAM (output of analysis) ===

interface OnboardingProgram {
  platformName: string;
  platformDescription: string;
  flows: OnboardingFlow[];
  generatedAt: string; // ISO date
}

interface OnboardingFlow {
  id: string;           // e.g. "flow_1"
  name: string;         // e.g. "Create Your First Project"
  description: string;  // Why this flow matters
  estimatedMinutes: number;
  order: number;
  steps: OnboardingStep[];
}

interface OnboardingStep {
  id: string;            // e.g. "flow_1_step_1"
  title: string;         // e.g. "Navigate to the Dashboard"
  instruction: string;   // Exact UI instruction: "Click the 'Projects' tab in the sidebar"
  explanation: string;   // Why this step matters
  page: string;          // Which page/route this happens on, e.g. "/dashboard"
  order: number;
}

// === USER SESSION (end user being onboarded) ===

interface UserSession {
  id: string;
  userName: string;
  currentFlowIndex: number;
  currentStepIndex: number;
  completedFlows: string[];   // flow IDs
  completedSteps: string[];   // step IDs
  startedAt: string;
  lastActiveAt: string;
  chatHistory: ChatMessage[];
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}
```

---

## API Contracts

### POST `/api/analyze-flows`

Triggers Opus 4.6 flow analysis. Called after repo is extracted.

**Request:** `{ projectDir: string }`

**Response:** SSE stream via existing `/api/events` endpoint with new event types:
- `event: thinking` — `{ text: string }` (Opus extended thinking stream)
- `event: program` — `{ program: OnboardingProgram }` (final structured output)

### POST `/api/program/refine`

Chat with agent to refine the program.

**Request:**
```json
{ "message": "Add a step about inviting team members after creating a project" }
```

**Response:** SSE stream via `/api/events`:
- `event: refine-response` — `{ text: string }` (streamed text response)
- `event: program` — `{ program: OnboardingProgram }` (updated program)

### GET `/api/program`

Returns current program.

**Response:** `{ program: OnboardingProgram | null }`

### POST `/api/program/publish`

Marks program as published and ready for end users.

**Response:** `{ ok: true }`

### POST `/api/onboard/chat`

End user sends a message during onboarding.

**Request:**
```json
{
  "sessionId": "session_abc",
  "userName": "Alice",
  "message": "I'm done with this step",
  "currentUrl": "http://localhost:5173/dashboard"
}
```

**Response:** Server-Sent Events stream (dedicated, NOT via the shared /api/events):
```
data: {"type":"text","content":"Great job!..."}
data: {"type":"text","content":" Now let's..."}
data: {"type":"progress","currentFlow":0,"currentStep":2,"completedSteps":["flow_1_step_1"]}
data: {"type":"done"}
```

### GET `/api/onboard/sessions`

Returns all user sessions for the dashboard.

**Response:** `{ sessions: UserSession[] }`

---

## Server Implementation Details

### `server/store.js`

```javascript
// Simple in-memory store. No database needed for hackathon.

let program = null;         // OnboardingProgram | null
let published = false;
const sessions = new Map(); // sessionId -> UserSession
let projectDir = null;      // Current project directory

export const store = {
  getProgram: () => program,
  setProgram: (p) => { program = p; },
  isPublished: () => published,
  publish: () => { published = true; },
  getSession: (id) => sessions.get(id),
  setSession: (id, s) => sessions.set(id, s),
  getAllSessions: () => [...sessions.values()],
  getProjectDir: () => projectDir,
  setProjectDir: (d) => { projectDir = d; },
};
```

### `server/flowAnalyzer.js` — THE CORE AGENT

```javascript
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import path from 'path';
import { broadcast } from './sse.js';

const client = new Anthropic();

// File extensions to analyze (web apps)
const CODE_EXTENSIONS = new Set([
  '.tsx', '.ts', '.jsx', '.js', '.vue', '.svelte',
  '.html', '.css', '.py', '.rb', '.go', '.rs',
  '.json', '.yaml', '.yml', '.toml', '.md',
]);

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.next', 'dist', 'build',
  '__pycache__', '.cache', 'coverage', '.turbo',
  'vendor', '.svelte-kit', '.nuxt',
]);

const SYSTEM_PROMPT = `You are an expert product analyst. You analyze web application source code to identify the critical user flows that a new user must learn.

Your task:
1. Read the entire codebase provided
2. Understand what the application does (its purpose, main entities, user roles)
3. Identify the 3-7 MOST CRITICAL user flows (the actions a new user MUST learn to use the platform effectively)
4. For each flow, describe the exact steps with precise UI instructions

Think deeply about:
- What is the core value proposition of this app?
- What are the first things a new user needs to do?
- What are the most common daily actions?
- What flows involve multiple steps that could confuse a new user?

You MUST respond with ONLY a valid JSON object (no markdown fences, no extra text) matching this exact schema:

{
  "platformName": "string — the name of the platform",
  "platformDescription": "string — one sentence describing what the platform does",
  "flows": [
    {
      "id": "flow_1",
      "name": "string — clear action name, e.g. 'Create Your First Project'",
      "description": "string — why this flow matters to the user",
      "estimatedMinutes": number,
      "order": number,
      "steps": [
        {
          "id": "flow_1_step_1",
          "title": "string — short step title",
          "instruction": "string — EXACT UI instruction: which button, which page, which field. Be specific: 'Click the blue + New Project button in the top right corner of the Dashboard page'",
          "explanation": "string — brief explanation of why this step matters",
          "page": "string — the route/page where this happens, e.g. '/dashboard'",
          "order": number
        }
      ]
    }
  ],
  "generatedAt": "ISO date string"
}

IMPORTANT:
- Steps must be specific enough that someone who has never seen the app can follow them
- Reference exact UI elements: button labels, menu items, form field names
- Include the page/route where each step happens
- Order flows from most essential to least essential
- Each flow should be completable in 1-10 minutes`;

export async function analyzeFlows(projectDir) {
  broadcast('status', { state: 'analyzing', message: 'Reading source files...' });

  // Collect all source files
  const files = await collectSourceFiles(projectDir);
  
  broadcast('status', { 
    state: 'analyzing', 
    message: `Analyzing ${files.length} files with Claude Opus 4.6...` 
  });

  // Build the content string
  let codeContent = '';
  for (const file of files) {
    codeContent += `\n=== ${file.relativePath} ===\n${file.content}\n`;
  }

  // Truncate if needed (keep under 800K tokens ~ 3.2M chars to be safe)
  if (codeContent.length > 3_200_000) {
    codeContent = codeContent.slice(0, 3_200_000);
    codeContent += '\n\n[... truncated due to size ...]';
  }

  try {
    const stream = await client.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 16000,
      thinking: {
        type: 'enabled',
        budget_tokens: 10000,
      },
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `Analyze this web application codebase and identify the critical user onboarding flows.\n\n${codeContent}`,
        },
      ],
    });

    let thinkingText = '';
    let responseText = '';

    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        if (event.delta.type === 'thinking_delta') {
          thinkingText += event.delta.thinking;
          broadcast('thinking', { text: event.delta.thinking });
        } else if (event.delta.type === 'text_delta') {
          responseText += event.delta.text;
        }
      }
    }

    // Parse the JSON response
    const cleaned = responseText
      .replace(/^```(?:json)?\s*/m, '')
      .replace(/\s*```\s*$/m, '')
      .trim();

    let program;
    try {
      program = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/(\{[\s\S]+\})/);
      if (!match) throw new Error('Could not parse program JSON from response');
      program = JSON.parse(match[1]);
    }

    program.generatedAt = new Date().toISOString();
    broadcast('program', { program });
    return program;

  } catch (err) {
    broadcast('status', { state: 'error', message: `Flow analysis failed: ${err.message}` });
    throw err;
  }
}

async function collectSourceFiles(dir, basePath = dir) {
  const files = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    if (entry.name.startsWith('.') && entry.name !== '.env.example') continue;

    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(basePath, fullPath);

    if (entry.isDirectory()) {
      const subFiles = await collectSourceFiles(fullPath, basePath);
      files.push(...subFiles);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (!CODE_EXTENSIONS.has(ext)) continue;
      
      try {
        const content = await fs.readFile(fullPath, 'utf8');
        // Skip very large files (likely generated/bundled)
        if (content.length > 50_000) continue;
        files.push({ relativePath, content });
      } catch { /* skip unreadable files */ }
    }
  }

  return files;
}
```

### `server/routes/program.js`

```javascript
import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { store } from '../store.js';
import { broadcast } from '../sse.js';

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

  // Set up SSE for this response
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
      const jsonStr = fullText.slice(markerIndex + jsonMarker.length).trim()
        .replace(/^```(?:json)?\s*/m, '')
        .replace(/\s*```\s*$/m, '')
        .trim();
      try {
        const updated = JSON.parse(jsonStr);
        store.setProgram(updated);
        res.write(`data: ${JSON.stringify({ type: 'program', program: updated })}\n\n`);
      } catch (e) {
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
```

### `server/routes/onboard.js`

```javascript
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
    return res.status(400).json({ error: 'No program published' });
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

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  try {
    const systemPrompt = `You are a friendly, expert onboarding guide for "${program.platformName}" — ${program.platformDescription}.

You are guiding a user named "${session.userName}" through the onboarding program step by step.

FULL ONBOARDING PROGRAM:
${JSON.stringify(program.flows, null, 2)}

CURRENT PROGRESS:
- Current flow: "${currentFlow?.name}" (${session.currentFlowIndex + 1}/${program.flows.length})
- Current step: "${currentStep?.title}" (step ${session.currentStepIndex + 1}/${currentFlow?.steps.length ?? 0})
- Overall progress: ${completedCount}/${totalSteps} steps completed
- Completed steps: ${JSON.stringify(session.completedSteps)}
${currentUrl ? `- User's current URL: ${currentUrl}` : ''}

CURRENT STEP DETAILS:
${currentStep ? JSON.stringify(currentStep, null, 2) : 'All flows completed!'}

BEHAVIOR RULES:
1. Guide the user through ONE step at a time. Don't overwhelm them.
2. Give clear, specific UI instructions using the step data.
3. When the user says they're done / completed a step / confirms — mark it as complete and move to the next step.
4. If the user is confused or stuck, rephrase the instructions more simply. Reference visual landmarks on the page.
5. If the user asks about something unrelated to the current step, briefly answer then redirect to the current step.
6. Be encouraging but not overly cheerful. Professional and helpful.
7. When all steps in a flow are done, congratulate briefly and introduce the next flow.
8. When ALL flows are done, congratulate and say onboarding is complete.

STEP COMPLETION:
When you determine the user has completed the current step, include this EXACT marker at the END of your response on its own line:
===STEP_COMPLETE===

When all steps in the current flow are done and you're moving to the next flow, include:
===FLOW_COMPLETE===

Only include these markers when you are confident the step/flow is actually done.`;

    // Build messages from chat history (last 20 messages for context)
    const recentHistory = session.chatHistory.slice(-20);
    const messages = recentHistory.map(m => ({
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

    // Check for step/flow completion markers
    if (fullResponse.includes('===STEP_COMPLETE===')) {
      if (currentStep) {
        session.completedSteps.push(currentStep.id);
        session.currentStepIndex++;

        // Check if flow is complete
        if (session.currentStepIndex >= (currentFlow?.steps.length ?? 0)) {
          session.completedFlows.push(currentFlow.id);
          session.currentFlowIndex++;
          session.currentStepIndex = 0;
        }
      }
    }

    // Clean the response of markers before saving
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
    res.write(`data: ${JSON.stringify({
      type: 'progress',
      currentFlowIndex: session.currentFlowIndex,
      currentStepIndex: session.currentStepIndex,
      completedSteps: session.completedSteps,
      completedFlows: session.completedFlows,
      totalFlows: program.flows.length,
      totalSteps,
    })}\n\n`);

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
    res.end();
  }
});
```

---

## Modifications to Existing Files

### `server/index.js` — Add new routes

```javascript
// ADD these imports:
import { router as programRouter } from './routes/program.js';
import { router as onboardRouter } from './routes/onboard.js';

// ADD these route mounts (after existing routes):
app.use('/api/program', programRouter);
app.use('/api/onboard', onboardRouter);
```

### `server/runner.js` — Trigger flow analysis after extraction

After the project starts running, also trigger flow analysis.
Add at the end of the `runProject` function, right after the process is spawned:

```javascript
// ADD this import at the top:
import { analyzeFlows } from './flowAnalyzer.js';
import { store } from './store.js';

// ADD inside runProject(), after currentProcess is spawned and event listeners are set:
// Trigger flow analysis in parallel (don't await — runs alongside the project)
store.setProjectDir(workDir);
analyzeFlows(workDir)
  .then((program) => {
    store.setProgram(program);
    broadcast('status', { state: 'running', message: 'App running. Onboarding program ready.' });
  })
  .catch((err) => {
    broadcast('log', { line: `Flow analysis error: ${err.message}`, stream: 'stderr' });
  });
```

### `client/src/hooks/useSSE.ts` — Handle new events

Add to the AppState type and reducer:

```typescript
// ADD to AppState:
thinking: string;
program: OnboardingProgram | null;

// ADD to INITIAL_STATE:
thinking: '',
program: null,

// ADD to Action type:
| { type: 'THINKING'; payload: { text: string } }
| { type: 'PROGRAM'; payload: { program: any } }

// ADD to reducer:
case 'THINKING':
  return { ...state, thinking: state.thinking + action.payload.text };
case 'PROGRAM':
  return { ...state, program: action.payload.program };

// ADD to AppStatus type:
'analyzing'

// ADD event listeners in useEffect:
es.addEventListener('thinking', (e) => {
  const data = JSON.parse(e.data);
  dispatch({ type: 'THINKING', payload: data });
});

es.addEventListener('program', (e) => {
  const data = JSON.parse(e.data);
  dispatch({ type: 'PROGRAM', payload: data });
});
```

---

## Client Pages — Wireframes

### Page: `/` (modify existing)

Keep the existing upload UI. ADD:
- A top navigation bar (NavBar) with links: Upload | Program | Onboard | Dashboard
- Below the existing ActionBar, when status is 'analyzing': show a "thinking" panel that streams the Opus reasoning
- When program is received via SSE: show a notification/button "Onboarding program detected! View flows ->"

### Page: `/program`

```
+-------------------------------------------------------+
| NavBar: [Upload] [Program*] [Onboard] [Dashboard]     |
+-------------------------------------------------------+
| Program for: {platformName}                            |
| {platformDescription}                                  |
|                                                        |
| +---------------------------------------------------+ |
| | FLOWS                     | REFINE VIA CHAT       | |
| |                           |                       | |
| | [Flow 1 Card]             | Chat messages...      | |
| |   Step 1 - ...            |                       | |
| |   Step 2 - ...            | [User]: Add a step    | |
| |   Step 3 - ...            |   about settings      | |
| |                           | [Agent]: Done! I've   | |
| | [Flow 2 Card]             |   added...            | |
| |   Step 1 - ...            |                       | |
| |   Step 2 - ...            |                       | |
| |                           | +-------------------+ | |
| | [Flow 3 Card]             | | Type message...   | | |
| |   ...                     | +-------------------+ | |
| +---------------------------------------------------+ |
|                                                        |
| [Publish Program]                                      |
+-------------------------------------------------------+
```

### Page: `/onboard`

```
+-------------------------------------------------------+
| NavBar: [Upload] [Program] [Onboard*] [Dashboard]     |
+-------------------------------------------------------+
| +-------------------------------+-------------------+ |
| |                               | ONBOARDING CHAT   | |
| |    IFRAME                     |                   | |
| |    (running app at            | Flow 1 of 4       | |
| |     localhost:XXXX)           | Step 2 of 5       | |
| |                               | [========--] 40%  | |
| |                               |                   | |
| |                               | Agent: Click the  | |
| |                               | "+ New" button...  | |
| |                               |                   | |
| |                               | User: Done!       | |
| |                               |                   | |
| |                               | Agent: Great!     | |
| |                               | Now let's...      | |
| |                               |                   | |
| |                               | +--------------+  | |
| |                               | | Message...   |  | |
| |                               | +--------------+  | |
| +-------------------------------+-------------------+ |
+-------------------------------------------------------+
```

### Page: `/dashboard`

```
+-------------------------------------------------------+
| NavBar: [Upload] [Program] [Onboard] [Dashboard*]     |
+-------------------------------------------------------+
| Onboarding Dashboard                                   |
|                                                        |
| +---------------------------------------------------+ |
| | User     | Progress    | Current Flow | Last Active| |
| |----------|-------------|-------------|-------------| |
| | Alice    | ████░░ 60%  | Create Task | 2 min ago   | |
| | Bob      | ██████ 100% | Completed!  | 1 hour ago  | |
| | Carol    | ██░░░░ 20%  | Sign Up     | 5 min ago   | |
| +---------------------------------------------------+ |
+-------------------------------------------------------+
```

---

## Demo Strategy

### What to Use as the "Client" App

The demo needs a real web app repo to analyze. Best options (in order of preference):

1. **A teammate's existing project** — most authentic, you know the flows
2. **Any simple open-source web app** — clone from GitHub, analyze it live
3. **The hackathon project itself** (meta demo) — upload this repo, analyze the Repo Runner UI

For the demo, the flow is:
1. Open Tab 1: our app (localhost:3000)
2. Paste a GitHub URL or upload a ZIP
3. Watch Opus 4.6 think (streaming thinking visible — WOW moment)
4. See the detected flows appear
5. Navigate to /program — refine via chat ("add a step about X")
6. Click Publish
7. Navigate to /onboard — show the running app in iframe + chat
8. Walk through 2-3 onboarding steps with the chat agent
9. Show /dashboard — see the progress

### Demo Script (3 minutes)

**Minute 1 — The Problem + Upload**
"Companies ship fast. Users get lost. Training costs a fortune. We fix this in minutes, not months."
- Paste a GitHub URL
- Show Opus analyzing with visible thinking stream
- "That's Claude Opus 4.6 with extended thinking — reading the entire codebase, reasoning about what matters."

**Minute 2 — The Program + Refinement**
- Show detected flows: "It found 5 critical flows automatically."
- Type in chat: "Add a step about exporting data" → program updates instantly
- Click Publish

**Minute 3 — The Onboarding Experience**
- Open /onboard — running app in iframe, chat on the right
- Chat agent guides: "Welcome! Let's start by creating your first project. Click the '+ New' button..."
- Complete 2 steps — show progress bar advancing
- Quick flash of /dashboard: "And here's where the platform owner tracks all their users."

"We turn any codebase into an intelligent onboarding agent. No configuration, no manual setup. Just upload your repo."

---

## Anthropic Primitives to Highlight in Pitch

| Primitive | Where We Use It | Why It Matters |
|-----------|----------------|----------------|
| **Opus 4.6 (1M context)** | Repo analysis — ingests entire codebase in one call | No chunking, no RAG — the full codebase fits in context |
| **Extended Thinking (streaming)** | Visible reasoning during analysis | Demo wow factor — watch the AI reason about your codebase |
| **Prompt Caching** | Onboarding agent caches program as system context | Sub-second responses for end users, cheaper API calls |
| **Streaming** | Both analysis and chat stream in real-time | Responsive UX throughout |
| **Sonnet 4.6** | Onboarding chat agent + program refinement | Fast, cheap, excellent for production runtime |

---

## Build Order (3.5 Hours)

### Hour 1: Foundations (0:00 - 1:00)

**Person 1 (Frontend):**
- [ ] Create `NavBar.tsx` component with links to /, /program, /onboard, /dashboard
- [ ] Add NavBar to `layout.tsx`
- [ ] Create `FlowCard.tsx` component (show flow name, description, expandable steps)
- [ ] Create `ChatPanel.tsx` component (message list + input, reusable)

**Person 2 (Agent/Backend):**
- [ ] Create `server/store.js`
- [ ] Create `server/flowAnalyzer.js` (the Opus analysis agent)
- [ ] Create `server/routes/program.js` (GET + POST /refine + POST /publish)
- [ ] Create `server/routes/onboard.js` (POST /chat + GET /sessions)
- [ ] Modify `server/index.js` to mount new routes

**Person 3 (Product/Integration):**
- [ ] Set up .env with ANTHROPIC_API_KEY
- [ ] Run `npm install` in both root and client
- [ ] Test existing upload/run flow works
- [ ] Find and prepare the demo target repo
- [ ] Start drafting the demo script / pitch deck

### Hour 2: Integration (1:00 - 2:00)

**Person 1:**
- [ ] Build `/program` page (flow cards left, chat right)
- [ ] Wire ChatPanel to POST /api/program/refine (SSE)
- [ ] Handle program updates from SSE → re-render flow cards

**Person 2:**
- [ ] Modify `runner.js` to trigger `analyzeFlows()` in parallel
- [ ] Modify `useSSE.ts` to handle `thinking` and `program` events
- [ ] Test: upload a repo → see thinking stream → see program appear
- [ ] Debug and tune the analysis prompt

**Person 3:**
- [ ] Build `/onboard` page (iframe left, chat right)
- [ ] Wire chat to POST /api/onboard/chat
- [ ] Add progress bar component (current flow/step, percentage)
- [ ] Test onboarding chat with a published program

### Hour 3: Polish + Dashboard (2:00 - 3:00)

**Person 1:**
- [ ] Build `/dashboard` page (table of user sessions + progress)
- [ ] Add thinking stream panel to the upload page (show Opus reasoning)
- [ ] Polish UI: loading states, transitions, status indicators

**Person 2:**
- [ ] Tune agent prompts based on testing
- [ ] Add "analyzing" status to the SSE flow
- [ ] Handle edge cases: empty repos, analysis failures
- [ ] Ensure program refinement works end-to-end

**Person 3:**
- [ ] End-to-end demo walkthrough — test 3 times minimum
- [ ] Identify and fix any broken flows
- [ ] Prepare demo target app (ensure it runs cleanly)

### Final 30 min: Demo Prep (3:00 - 3:30)

**Everyone:**
- [ ] Run the complete demo flow start to finish
- [ ] Fix any last-minute issues
- [ ] Person 3 practices the demo narration
- [ ] Have backup plan if live demo fails (screenshots/recording)

---

## Environment Setup

Create `.env` in root:

```
ANTHROPIC_API_KEY=your-key-here
SERVER_PORT=3001
```

Run:
```bash
npm install
cd client && npm install && cd ..
npm run dev
```

This starts both the Express server (:3001) and Next.js client (:3000).
The Next.js config already proxies `/api/*` to `:3001`.

---

## Scope Cuts (DO NOT BUILD)

- Voice — skip entirely, too risky for 3.5 hours
- User authentication — no login, sessions are identified by name
- Persistent database — in-memory is fine
- Automatic URL verification — the chat agent asks the user to confirm
- Multiple platforms — one program at a time
- Widget injection — use iframe instead
- Agent Skills API / Managed Agents — would be cool but adds complexity with no demo payoff
