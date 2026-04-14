'use client';

import { useEffect, useState, useCallback } from 'react';
import FlowCard from '@/components/FlowCard';
import ChatPanel, { ChatMessage } from '@/components/ChatPanel';
import type { OnboardingProgram } from '@/hooks/useSSE';

export default function ProgramPage() {
  const [program, setProgram] = useState<OnboardingProgram | null>(null);
  const [published, setPublished] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch program on mount
  useEffect(() => {
    fetch('/api/program')
      .then((r) => r.json())
      .then((data) => {
        setProgram(data.program);
        setPublished(data.published);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSend = useCallback(
    async (message: string) => {
      if (streaming) return;

      // Add user message
      setMessages((prev) => [...prev, { role: 'user', content: message }]);
      setStreaming(true);

      // Add empty assistant message for streaming
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      try {
        const res = await fetch('/api/program/refine', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message }),
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
                    // Once we see the marker, stop adding any more text
                    const markerIdx = raw.indexOf('===PROGRAM_JSON===');
                    if (markerIdx >= 0) {
                      updated[updated.length - 1] = { ...last, content: raw.slice(0, markerIdx).trim() };
                    } else if (raw.includes('===PROGRAM')) {
                      // Partial marker arriving — freeze display at safe point
                      const safeIdx = raw.indexOf('===PROGRAM');
                      updated[updated.length - 1] = { ...last, content: raw.slice(0, safeIdx).trim() };
                    } else {
                      updated[updated.length - 1] = { ...last, content: raw };
                    }
                  }
                  return updated;
                });
              } else if (data.type === 'program') {
                setProgram(data.program);
              }
            } catch { /* skip malformed */ }
          }
        }
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}` },
        ]);
      } finally {
        setStreaming(false);
      }
    },
    [streaming]
  );

  async function handlePublish() {
    await fetch('/api/program/publish', { method: 'POST' });
    setPublished(true);
  }

  if (loading) {
    return (
      <main className="min-h-screen p-6 md:p-10 max-w-6xl mx-auto">
        <p className="text-gray-400">Loading program...</p>
      </main>
    );
  }

  if (!program) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="w-14 h-14 rounded-2xl bg-gray-800 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">&#128203;</span>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">No program yet</h2>
          <p className="text-gray-400 text-sm mb-6">
            Upload a repository first. Our AI will analyze it and generate the onboarding flows automatically.
          </p>
          <a href="/" className="inline-block rounded-xl bg-blue-600 hover:bg-blue-500 px-6 py-2.5 text-sm font-semibold text-white transition-colors">
            Go to Analyze
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 md:p-10 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">{program.platformName} — Onboarding Program</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {program.flows.length} flows, {program.flows.reduce((s, f) => s + f.steps.length, 0)} steps
          </p>
        </div>
        <div className="flex items-center gap-3">
          {published && (
            <a href="/onboard" className="rounded-xl bg-white/10 hover:bg-white/15 px-4 py-2 text-sm font-medium text-white transition-colors">
              Open Onboarding
            </a>
          )}
          {!published ? (
            <button
              onClick={handlePublish}
              className="rounded-xl bg-green-600 hover:bg-green-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors"
            >
              Publish
            </button>
          ) : (
            <span className="px-3 py-1.5 rounded-full bg-green-900/40 text-green-400 text-xs font-medium">
              Live
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-[calc(100vh-220px)]">
        {/* Flows */}
        <div className="lg:col-span-3 overflow-y-auto space-y-4 pr-2">
          {program.flows.map((flow, i) => (
            <FlowCard key={flow.id} flow={flow} index={i} />
          ))}
        </div>

        {/* Chat */}
        <div className="lg:col-span-2 rounded-xl border border-gray-700 bg-gray-900/50 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-700 bg-gray-800/50">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
              Refine via Chat
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Ask to add, remove, or modify flows and steps</p>
          </div>
          <ChatPanel
            messages={messages}
            onSend={handleSend}
            disabled={streaming}
            streaming={streaming}
            placeholder="e.g. Add a step about inviting team members..."
          />
        </div>
      </div>
    </main>
  );
}
