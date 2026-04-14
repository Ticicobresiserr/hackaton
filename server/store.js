// Simple in-memory store. No database needed for hackathon.
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Feature flag: set SKIP_ANALYSIS=true in .env to use cached program (saves credits)
// Remove it or set to false for the real demo
let program = null;
if (process.env.SKIP_ANALYSIS === 'true') {
  try {
    const cached = path.join(__dirname, '..', 'onboarding-program.json');
    if (fs.existsSync(cached)) {
      program = JSON.parse(fs.readFileSync(cached, 'utf8'));
      console.log(`[store] SKIP_ANALYSIS=true → loaded cached program (${program.flows.length} flows)`);
    }
  } catch { /* no cached program */ }
}

let published = false;
const sessions = new Map();
let projectDir = null;
let currentStatus = { state: 'idle', message: 'Ready' };

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
  getStatus: () => currentStatus,
  setStatus: (s) => { currentStatus = s; },
};
