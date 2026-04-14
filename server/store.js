// Simple in-memory store. No database needed for hackathon.

let program = null;
let published = false;
const sessions = new Map();
let projectDir = null;

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
