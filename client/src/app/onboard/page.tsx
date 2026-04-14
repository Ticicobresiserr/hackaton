'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { OnboardingProgram } from '@/hooks/useSSE';
import { useSSE } from '@/hooks/useSSE';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface Progress {
  currentFlowIndex: number;
  currentStepIndex: number;
  completedSteps: string[];
  completedFlows: string[];
  totalFlows: number;
  totalSteps: number;
}

export default function OnboardPage() {
  const { portUrl } = useSSE();
  const [program, setProgram] = useState<OnboardingProgram | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [input, setInput] = useState('');
  const [userName, setUserName] = useState('');
  const [started, setStarted] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}`);
  const [progress, setProgress] = useState<Progress | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  useEffect(() => {
    fetch('/api/program')
      .then((r) => r.json())
      .then((data) => setProgram(data.program));
  }, []);

  const sendMessage = useCallback(
    async (message: string) => {
      if (streaming) return;

      setMessages((prev) => [...prev, { role: 'user', content: message }]);
      setStreaming(true);
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      try {
        const res = await fetch('/api/onboard/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            userName,
            message,
          }),
        });

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        if (!reader) return;

        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'text') {
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last && last.role === 'assistant') {
                    const raw = last.content + data.content;
                    // Filter out all internal markers
                    const clean = raw
                      .replace(/===STEP_COMPLETE===/g, '')
                      .replace(/===FLOW_COMPLETE===/g, '')
                      .replace(/===PROGRAM_JSON===[\s\S]*/g, '');
                    updated[updated.length - 1] = { ...last, content: clean.trim() };
                  }
                  return updated;
                });
              } else if (data.type === 'progress') {
                setProgress(data);
              }
            } catch { /* skip */ }
          }
        }
      } catch (err) {
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: 'assistant', content: `Error: ${err instanceof Error ? err.message : 'Unknown'}` },
        ]);
      } finally {
        setStreaming(false);
      }
    },
    [streaming, sessionId, userName]
  );

  function handleStart() {
    if (!userName.trim()) return;
    setStarted(true);
    sendMessage(`Hi, I'm ${userName.trim()}. I'm ready to start the onboarding.`);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || streaming) return;
    sendMessage(input.trim());
    setInput('');
  }

  if (!program) {
    return (
      <main className="min-h-screen p-6 md:p-10 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-2">Onboarding</h1>
        <p className="text-gray-400">
          No onboarding program available. Upload and analyze a repo first, then publish the program.
        </p>
      </main>
    );
  }

  if (!started) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="rounded-xl border border-gray-700 bg-gray-900/50 p-8 max-w-md w-full mx-4">
          <h1 className="text-2xl font-bold text-white mb-2">Welcome to {program.platformName}</h1>
          <p className="text-gray-400 text-sm mb-6">
            {program.platformDescription}. Let&apos;s get you up to speed with a guided onboarding.
          </p>
          <label className="block text-sm font-medium text-gray-300 mb-2">Your name</label>
          <input
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleStart()}
            placeholder="Enter your name..."
            className="w-full rounded-lg bg-gray-800 border border-gray-600 px-3 py-2 text-sm text-gray-100
              placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
          />
          <button
            onClick={handleStart}
            disabled={!userName.trim()}
            className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700
              disabled:cursor-not-allowed px-4 py-2.5 text-sm font-semibold text-white
              transition-colors duration-150"
          >
            Start Onboarding
          </button>
          <p className="text-xs text-gray-600 mt-3 text-center">
            {program.flows.length} flows, {program.flows.reduce((s, f) => s + f.steps.length, 0)} steps
          </p>
        </div>
      </main>
    );
  }

  const completedPct = progress
    ? Math.round((progress.completedSteps.length / progress.totalSteps) * 100)
    : 0;

  const currentFlow = progress
    ? program.flows[progress.currentFlowIndex]
    : program.flows[0];

  const currentStep = currentFlow
    ? currentFlow.steps[progress?.currentStepIndex ?? 0]
    : null;

  return (
    <main className="h-[calc(100vh-56px)] flex">
      {/* Left: iframe with running app */}
      <div className="flex-1 flex flex-col border-r border-gray-800">
        <div className="px-4 py-2 border-b border-gray-800 bg-gray-900/50 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {portUrl || 'No app running — start the app from the Upload page'}
          </span>
          {portUrl && (
            <a
              href={portUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              Open in new tab
            </a>
          )}
        </div>
        {portUrl ? (
          <iframe
            src={portUrl}
            className="flex-1 w-full bg-white"
            title="Running application"
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-600">
            <p>Upload and run a repo to see the app here</p>
          </div>
        )}
      </div>

      {/* Right: chat */}
      <div className="w-[420px] flex flex-col bg-gray-950">
        {/* Progress bar */}
        <div className="px-4 py-3 border-b border-gray-800">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-gray-400">
              {progress && progress.currentFlowIndex >= program.flows.length
                ? 'Onboarding complete!'
                : currentFlow
                  ? `Flow ${(progress?.currentFlowIndex ?? 0) + 1}/${program.flows.length}: ${currentFlow.name}`
                  : 'Starting...'}
            </span>
            <span className="text-xs text-gray-500">{completedPct}%</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${completedPct}%` }}
            />
          </div>
          {currentStep && (
            <p className="text-xs text-gray-500 mt-1.5 truncate">
              Step {(progress?.currentStepIndex ?? 0) + 1}: {currentStep.title}
            </p>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[90%] rounded-xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-200 border border-gray-700'
                }`}
              >
                {msg.content}
                {streaming && i === messages.length - 1 && msg.role === 'assistant' && (
                  <span className="inline-block w-2 h-4 bg-blue-400 ml-1 animate-pulse" />
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="border-t border-gray-800 p-3 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={streaming}
            placeholder="Type a message or 'done' when finished..."
            className="flex-1 rounded-lg bg-gray-800 border border-gray-600 px-3 py-2 text-sm text-gray-100
              placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500
              disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            className="rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700
              disabled:cursor-not-allowed px-4 py-2 text-sm font-semibold text-white
              transition-colors duration-150"
          >
            Send
          </button>
        </form>
      </div>
    </main>
  );
}
