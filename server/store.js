// Simple in-memory store. No database needed for hackathon.
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Pre-load cached program if it exists (saves API credits during testing)
let program = null;
try {
  const cached = path.join(__dirname, '..', 'onboarding-program.json');
  if (fs.existsSync(cached)) {
    program = JSON.parse(fs.readFileSync(cached, 'utf8'));
    console.log(`[store] Pre-loaded program: ${program.platformName} (${program.flows.length} flows)`);
  }
} catch { /* no cached program */ }
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
