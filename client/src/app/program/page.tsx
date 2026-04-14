'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Rocket, MessageSquare, ExternalLink, FileCode2 } from 'lucide-react';
import FlowCard from '@/components/FlowCard';
import ChatPanel, { ChatMessage } from '@/components/ChatPanel';
import type { OnboardingProgram } from '@/hooks/useSSE';

export default function ProgramPage() {
  const [program, setProgram] = useState<OnboardingProgram | null>(null);
  const [published, setPublished] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [loading, setLoading] = useState(true);

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

      setMessages((prev) => [...prev, { role: 'user', content: message }]);
      setStreaming(true);
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
                    updated[updated.length - 1] = { ...last, content: last.content + data.content };
                  }
                  return updated;
                });
              } else if (data.type === 'updating') {
                // Show "updating flows..." while JSON generates
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last && last.role === 'assistant') {
                    updated[updated.length - 1] = { ...last, content: last.content + '\n\n_Updating flows..._' };
                  }
                  return updated;
                });
              } else if (data.type === 'program') {
                setProgram(data.program);
                // Remove the "updating" message
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last && last.role === 'assistant') {
                    updated[updated.length - 1] = { ...last, content: last.content.replace('\n\n_Updating flows..._', '') };
                  }
                  return updated;
                });
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
      <main className="min-h-screen p-6 md:p-10 max-w-6xl mx-auto flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <div className="w-5 h-5 border-2 border-gray-600 border-t-sherpa-500 rounded-full animate-spin" />
          <span className="text-sm">Loading program...</span>
        </div>
      </main>
    );
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
            <FileCode2 className="w-7 h-7 text-gray-500" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">No program yet</h2>
          <p className="text-gray-500 text-sm mb-8 leading-relaxed">
            Upload a repository first. Our AI will analyze it and generate the onboarding flows automatically.
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sherpa-500 to-sherpa-600
              hover:from-sherpa-400 hover:to-sherpa-500 px-6 py-2.5 text-sm font-semibold text-white
              transition-all duration-200 shadow-lg shadow-sherpa-500/20"
          >
            Go to Analyze
          </a>
        </motion.div>
      </main>
    );
  }

  const totalSteps = program.flows.reduce((s, f) => s + f.steps.length, 0);

  return (
    <main className="min-h-screen p-6 md:p-10 max-w-6xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between gap-4 mb-8"
      >
        <div>
          <h1 className="text-2xl font-bold text-white">{program.platformName}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {program.flows.length} flows &middot; {totalSteps} steps &middot; Onboarding Program
          </p>
        </div>
        <div className="flex items-center gap-3">
          {published && (
            <a
              href="/onboard"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1]
                border border-white/[0.08] px-4 py-2.5 text-sm font-medium text-gray-300
                hover:text-white transition-all duration-200"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open Onboarding
            </a>
          )}
          {!published ? (
            <button
              onClick={handlePublish}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600
                hover:from-green-400 hover:to-emerald-500 px-5 py-2.5 text-sm font-semibold text-white
                transition-all duration-200 shadow-lg shadow-green-500/20 hover:shadow-green-500/30"
            >
              <Rocket className="w-4 h-4" />
              Publish
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              Live
            </span>
          )}
        </div>
      </motion.div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-[calc(100vh-220px)]">
        {/* Flows */}
        <div className="lg:col-span-3 overflow-y-auto space-y-3 pr-2">
          {program.flows.map((flow, i) => (
            <FlowCard key={flow.id} flow={flow} index={i} />
          ))}
        </div>

        {/* Chat */}
        <div className="lg:col-span-2 rounded-2xl border border-surface-border bg-surface-elevated/60 overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-surface-border">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-sherpa-500" />
              <h2 className="text-sm font-semibold text-gray-200">Refine via Chat</h2>
            </div>
            <p className="text-xs text-gray-500 mt-1">Ask to add, remove, or modify flows and steps</p>
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
