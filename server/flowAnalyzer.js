import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import path from 'path';
import { broadcast } from './sse.js';

const client = new Anthropic();

const CODE_EXTENSIONS = new Set([
  '.tsx', '.ts', '.jsx', '.js', '.vue', '.svelte',
  '.html', '.css', '.py', '.rb', '.go', '.rs',
  '.json', '.yaml', '.yml', '.toml', '.md',
]);

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.next', 'dist', 'build',
  '__pycache__', '.cache', 'coverage', '.turbo',
  'vendor', '.svelte-kit', '.nuxt', '.vercel',
  '.output', 'static', 'public', 'assets',
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

You MUST respond with ONLY a valid JSON object (no markdown fences, no explanation) matching this exact schema:

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

  const files = await collectSourceFiles(projectDir);

  broadcast('status', {
    state: 'analyzing',
    message: `Analyzing ${files.length} files with Claude Opus 4.6...`,
  });

  let codeContent = '';
  for (const file of files) {
    codeContent += `\n=== ${file.relativePath} ===\n${file.content}\n`;
  }

  // Keep under ~800K tokens to be safe within 1M context
  if (codeContent.length > 3_200_000) {
    codeContent = codeContent.slice(0, 3_200_000);
    codeContent += '\n\n[... truncated due to size ...]';
  }

  broadcast('log', {
    line: `Flow analyzer: sending ${(codeContent.length / 1024).toFixed(0)}KB of code to Opus 4.6\n`,
    stream: 'stdout',
  });

  try {
    const stream = await client.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 16000,
      thinking: {
        type: 'enabled',
        budget_tokens: 50000,
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

    let responseText = '';

    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        if (event.delta.type === 'thinking_delta') {
          broadcast('thinking', { text: event.delta.thinking });
        } else if (event.delta.type === 'text_delta') {
          responseText += event.delta.text;
        }
      }
    }

    // Parse JSON response
    const cleaned = responseText
      .replace(/^```(?:json)?\s*/m, '')
      .replace(/\s*```\s*$/m, '')
      .trim();

    let program;
    try {
      program = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/(\{[\s\S]+\})/);
      if (!match) throw new Error('Could not parse program JSON from Opus response');
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
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return files;
  }

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
      } catch { /* skip unreadable */ }
    }
  }

  return files;
}
