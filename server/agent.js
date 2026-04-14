import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import path from 'path';

const client = new Anthropic();

const MANIFEST_FILES = [
  'README.md', 'readme.md', 'Readme.md',
  'package.json',
  'requirements.txt',
  'Cargo.toml',
  'go.mod',
  'Makefile',
  'pyproject.toml',
  'setup.py',
  'composer.json',
  'Gemfile',
  'build.gradle',
  'pom.xml',
];

const SYSTEM_PROMPT = `You are a DevOps expert that analyzes software projects and determines how to run them locally in development mode.

Given information about a project directory, respond ONLY with a valid JSON object (no markdown fences, no explanation):
{
  "install": <array of strings for the install command, or null if no install step needed>,
  "run": <array of strings for the start/dev command>,
  "port": <integer port number the app will listen on, or null if unknown>,
  "env": <object of extra environment variables needed, or {}>,
  "notes": <brief string explaining your reasoning>
}

Rules:
- Each command is a flat array: ["npm", "install"] not ["npm install"]
- Do NOT use shell syntax (no &&, ||, ;, >, |, backticks)
- "run" must be a long-running server/dev command, NOT a build-only command
- Prefer dev/watch mode commands over production mode
- For Node.js: prefer ["npm", "run", "dev"] or ["npm", "start"] or ["npx", "vite"] or ["node", "server.js"]
- For Python Flask/FastAPI: prefer ["python", "app.py"] or ["uvicorn", "main:app", "--reload"]
- For Python Django: ["python", "manage.py", "runserver"]
- For Go: ["go", "run", "."] or ["go", "run", "main.go"]
- For Rust: ["cargo", "run"]
- For Ruby: ["ruby", "app.rb"] or ["rails", "server"]
- For Makefile with a "run" or "serve" target: ["make", "run"]
- If you cannot determine the run command, use ["echo", "Could not determine run command"] and explain in notes
- Set BROWSER=none in env to prevent auto-opening browsers`;

export async function analyzeProject(projectDir) {
  // List top-level files
  let entries;
  try {
    entries = await fs.readdir(projectDir);
  } catch {
    throw new Error(`Cannot read project directory: ${projectDir}`);
  }

  // If single top-level directory, look inside it (common with ZIP/clone)
  let workDir = projectDir;
  if (entries.length === 1) {
    const single = path.join(projectDir, entries[0]);
    try {
      const stat = await fs.stat(single);
      if (stat.isDirectory()) {
        workDir = single;
        entries = await fs.readdir(workDir);
      }
    } catch { /* ignore */ }
  }

  // Read manifest files
  const fileContents = {};
  for (const file of MANIFEST_FILES) {
    try {
      const content = await fs.readFile(path.join(workDir, file), 'utf8');
      fileContents[file] = content.slice(0, 4000);
    } catch { /* not present */ }
  }

  const userPrompt = buildPrompt(entries, fileContents, workDir);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = response.content.find((b) => b.type === 'text')?.text ?? '';

  // Strip markdown fences if present
  const cleaned = text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Try to extract bare JSON object
    const match = cleaned.match(/(\{[\s\S]+\})/);
    if (!match) throw new Error(`Claude returned non-JSON: ${text.slice(0, 200)}`);
    parsed = JSON.parse(match[1]);
  }

  // Attach resolved workDir so runner knows where to run
  parsed._workDir = workDir;
  return parsed;
}

function buildPrompt(entries, fileContents, workDir) {
  const lines = [
    `Project directory: ${workDir}`,
    `Top-level files and folders: ${entries.join(', ')}`,
    '',
  ];

  for (const [file, content] of Object.entries(fileContents)) {
    lines.push(`=== ${file} ===`);
    lines.push(content);
    lines.push('');
  }

  return lines.join('\n');
}
