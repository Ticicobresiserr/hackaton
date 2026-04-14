'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, ExternalLink, User, Mountain } from 'lucide-react';
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
      <main className="min-h-screen flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md px-6"
        >
          <div className="w-16 h-16 rounded-2xl bg-surface-elevated border border-surface-border flex items-center justify-center mx-auto mb-5">
            <Mountain className="w-7 h-7 text-gray-500" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">No onboarding available</h2>
          <p className="text-gray-500 text-sm leading-relaxed">
            Upload and analyze a repo first, then publish the program.
          </p>
        </motion.div>
      </main>
    );
  }

  if (!started) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', damping: 20 }}
          className="rounded-2xl border border-surface-border bg-surface-elevated/80 p-8 max-w-md w-full mx-4 border-glow-sherpa"
        >
          <div className="w-12 h-12 rounded-xl bg-sherpa-500/10 flex items-center justify-center mb-5">
            <Mountain className="w-6 h-6 text-sherpa-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Welcome to {program.platformName}
          </h1>
          <p className="text-gray-400 text-sm mb-8 leading-relaxed">
            {program.platformDescription}. Your AI guide will walk you through every feature step by step.
          </p>
          <label className="block text-sm font-medium text-gray-300 mb-2">Your name</label>
          <input
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleStart()}
            placeholder="Enter your name..."
            className="w-full rounded-xl bg-surface-card border border-surface-border px-4 py-3 text-sm text-gray-100
              placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-sherpa-500/40 focus:border-sherpa-500/30 mb-5 transition-all"
          />
          <button
            onClick={handleStart}
            disabled={!userName.trim()}
            className="w-full rounded-xl bg-gradient-to-r from-sherpa-500 to-sherpa-600
              hover:from-sherpa-400 hover:to-sherpa-500 disabled:from-gray-700 disabled:to-gray-700
              disabled:cursor-not-allowed px-4 py-3 text-sm font-semibold text-white
              transition-all duration-200 shadow-lg shadow-sherpa-500/20 disabled:shadow-none"
          >
            Start Onboarding
          </button>
          <p className="text-xs text-gray-600 mt-4 text-center">
            {program.flows.length} flows &middot; {program.flows.reduce((s, f) => s + f.steps.length, 0)} steps
          </p>
        </motion.div>
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

  const isComplete = progress && progress.currentFlowIndex >= program.flows.length;

  return (
    <main className="h-[calc(100vh-56px)] flex">
      {/* Left: iframe */}
      <div className="flex-1 flex flex-col border-r border-surface-border">
        <div className="px-4 py-2 border-b border-surface-border bg-surface-elevated/50 flex items-center justify-between">
          <span className="text-xs text-gray-500 truncate">
            {portUrl || 'No app running'}
          </span>
          {portUrl && (
            <a
              href={portUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-sherpa-400 hover:text-sherpa-300 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              New tab
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
          <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-600 text-sm">Upload and run a repo to see the app here</p>
          </div>
        )}
      </div>

      {/* Right: chat */}
      <div className="w-[420px] flex flex-col bg-surface">
        {/* Progress bar */}
        <div className="px-4 py-3.5 border-b border-surface-border bg-surface-elevated/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-300">
              {isComplete
                ? 'Onboarding complete!'
                : currentFlow
                  ? `Flow ${(progress?.currentFlowIndex ?? 0) + 1}/${program.flows.length}: ${currentFlow.name}`
                  : 'Starting...'}
            </span>
            <span className={`text-xs font-semibold ${isComplete ? 'text-green-400' : 'text-sherpa-400'}`}>
              {completedPct}%
            </span>
          </div>
          <div className="w-full bg-surface-card rounded-full h-1.5 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${completedPct}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className={`h-full rounded-full ${isComplete ? 'bg-gradient-to-r from-green-500 to-emerald-400' : 'bg-gradient-to-r from-sherpa-500 to-sherpa-400'}`}
            />
          </div>
          {currentStep && !isComplete && (
            <p className="text-[11px] text-gray-500 mt-1.5 truncate">
              Step {(progress?.currentStepIndex ?? 0) + 1}: {currentStep.title}
            </p>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="flex-shrink-0 w-6 h-6 rounded-lg bg-sherpa-500/10 flex items-center justify-center mr-2 mt-1">
                  <Bot className="w-3.5 h-3.5 text-sherpa-400" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-sherpa-500 to-sherpa-600 text-white rounded-br-md'
                    : 'bg-surface-elevated text-gray-200 border border-surface-border rounded-bl-md'
                }`}
              >
                {msg.content}
                {streaming && i === messages.length - 1 && msg.role === 'assistant' && (
                  <span className="inline-flex gap-0.5 ml-1.5 -mb-0.5">
                    <span className="typing-dot w-1.5 h-1.5 rounded-full bg-sherpa-400" />
                    <span className="typing-dot w-1.5 h-1.5 rounded-full bg-sherpa-400" />
                    <span className="typing-dot w-1.5 h-1.5 rounded-full bg-sherpa-400" />
                  </span>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="flex-shrink-0 w-6 h-6 rounded-lg bg-surface-card border border-surface-border flex items-center justify-center ml-2 mt-1">
                  <User className="w-3.5 h-3.5 text-gray-400" />
                </div>
              )}
            </motion.div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="border-t border-surface-border p-3 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={streaming}
            placeholder="Type a message or 'done' when finished..."
            className="flex-1 rounded-xl bg-surface-card border border-surface-border px-4 py-2.5 text-sm text-gray-100
              placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-sherpa-500/40 focus:border-sherpa-500/30
              disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            className="rounded-xl bg-gradient-to-r from-sherpa-500 to-sherpa-600 hover:from-sherpa-400 hover:to-sherpa-500
              disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed
              px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200
              shadow-md shadow-sherpa-500/15 disabled:shadow-none"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </main>
  );
}
