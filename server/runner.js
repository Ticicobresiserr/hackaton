import { spawn } from 'child_process';
import { broadcast } from './sse.js';
import { analyzeProject } from './agent.js';
import { analyzeFlows } from './flowAnalyzer.js';
import { store } from './store.js';
import { detectPort, resetPortDetector } from './portDetector.js';

let currentProcess = null;
let currentDir = null;

export async function runProject(projectDir) {
  // Stop any running project first
  if (currentProcess) {
    await stopProject();
    await new Promise((r) => setTimeout(r, 500));
  }

  currentDir = projectDir;
  resetPortDetector();

  broadcast('status', { state: 'setting-up', message: 'Analyzing project with AI agent...' });

  let commands;
  try {
    commands = await analyzeProject(projectDir);
  } catch (err) {
    broadcast('status', { state: 'error', message: `Analysis failed: ${err.message}` });
    return;
  }

  const workDir = commands._workDir ?? projectDir;
  broadcast('log', { line: `Agent notes: ${commands.notes ?? 'none'}`, stream: 'stdout' });

  // Install step
  if (commands.install) {
    broadcast('status', {
      state: 'setting-up',
      message: `Installing dependencies: ${commands.install.join(' ')}`,
    });
    try {
      await runStep(commands.install, workDir);
    } catch (err) {
      broadcast('status', { state: 'error', message: `Install failed: ${err.message}` });
      return;
    }
  }

  // Run step
  broadcast('status', {
    state: 'running',
    message: `Starting: ${commands.run.join(' ')}`,
  });

  const extraEnv = {
    BROWSER: 'none',
    FORCE_COLOR: '0',
    ...(commands.env ?? {}),
    ...(commands.port ? { PORT: String(commands.port) } : {}),
  };

  currentProcess = spawn(commands.run[0], commands.run.slice(1), {
    cwd: workDir,
    env: { ...process.env, ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  currentProcess.stdout.on('data', (chunk) => {
    const line = chunk.toString();
    broadcast('log', { line, stream: 'stdout' });
    const port = detectPort(line);
    if (port) broadcast('port', { port, url: `http://localhost:${port}` });
  });

  currentProcess.stderr.on('data', (chunk) => {
    const line = chunk.toString();
    broadcast('log', { line, stream: 'stderr' });
    const port = detectPort(line);
    if (port) broadcast('port', { port, url: `http://localhost:${port}` });
  });

  currentProcess.on('close', (code) => {
    currentProcess = null;
    broadcast('stopped', { code });
    // Only go idle if we're not mid-analysis — otherwise the page resets
    const currentState = store.getStatus().state;
    if (currentState !== 'analyzing') {
      broadcast('status', { state: 'idle', message: `Process exited with code ${code}` });
    }
  });

  currentProcess.on('error', (err) => {
    broadcast('status', { state: 'error', message: `Failed to start process: ${err.message}` });
    currentProcess = null;
  });

  // Trigger flow analysis in parallel (don't block the runner)
  store.setProjectDir(workDir);

  store.setProjectDir(workDir);

  if (store.getProgram() && process.env.SKIP_ANALYSIS === 'true') {
    console.log('[runner] SKIP_ANALYSIS=true, using cached program');
    broadcast('program', { program: store.getProgram() });
  } else {
    analyzeFlows(workDir)
      .then((program) => {
        store.setProgram(program);
        broadcast('program', { program });
      })
      .catch((err) => {
        console.error('[runner] Flow analysis error:', err.message);
        broadcast('log', { line: `Flow analysis error: ${err.message}\n`, stream: 'stderr' });
      });
  }
}

export function stopProject() {
  return new Promise((resolve) => {
    if (!currentProcess) return resolve();
    const proc = currentProcess;
    const timer = setTimeout(() => proc.kill('SIGKILL'), 5000);
    proc.on('close', () => {
      clearTimeout(timer);
      resolve();
    });
    proc.kill('SIGTERM');
  });
}

export function getCurrentDir() {
  return currentDir;
}

async function runStep(cmd, cwd) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd[0], cmd.slice(1), {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    proc.stdout.on('data', (d) =>
      broadcast('log', { line: d.toString(), stream: 'stdout' })
    );
    proc.stderr.on('data', (d) =>
      broadcast('log', { line: d.toString(), stream: 'stderr' })
    );
    proc.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd[0]} exited with code ${code}`))
    );
    proc.on('error', reject);
  });
}
