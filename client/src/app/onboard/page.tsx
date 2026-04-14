'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Code2, ExternalLink, Mountain, CheckCircle2, Copy, Footprints, Clock } from 'lucide-react';
import type { OnboardingProgram } from '@/hooks/useSSE';
import { useSSE } from '@/hooks/useSSE';

export default function OnboardPage() {
  const { portUrl } = useSSE();
  const [program, setProgram] = useState<OnboardingProgram | null>(null);
  const [published, setPublished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

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

  const embedCode = `<script src="${typeof window !== 'undefined' ? window.location.origin.replace(':3000', ':3001') : 'https://your-sherpa-server.com'}/widget/sherpa-widget.js"></script>`;

  function handleCopy() {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <div className="w-5 h-5 border-2 border-gray-600 border-t-sherpa-500 rounded-full animate-spin" />
          <span className="text-sm">Loading...</span>
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
            <Mountain className="w-7 h-7 text-gray-500" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">No onboarding program yet</h2>
          <p className="text-gray-500 text-sm leading-relaxed">
            Upload and analyze a repo first, then publish the program.
          </p>
        </motion.div>
      </main>
    );
  }

  const totalSteps = program.flows.reduce((s, f) => s + f.steps.length, 0);

  return (
    <main className="min-h-screen p-6 md:p-10 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-white mb-1">Onboarding Deployment</h1>
        <p className="text-gray-500 text-sm mb-8">Embed the Sherpa widget on your platform</p>
      </motion.div>

      {/* Status */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className={`rounded-2xl border p-6 mb-6 ${
          published
            ? 'border-green-500/20 bg-green-500/5'
            : 'border-yellow-500/20 bg-yellow-500/5'
        }`}
      >
        <div className="flex items-center gap-3">
          {published ? (
            <CheckCircle2 className="w-5 h-5 text-green-400" />
          ) : (
            <Mountain className="w-5 h-5 text-yellow-400" />
          )}
          <div>
            <p className="text-white font-semibold">
              {published ? 'Program is live' : 'Program not published yet'}
            </p>
            <p className="text-sm text-gray-400 mt-0.5">
              {published
                ? `${program.platformName} — ${program.flows.length} flows, ${totalSteps} steps`
                : 'Go to the Program tab to publish your onboarding flows.'}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Embed Code */}
      {published && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-surface-border bg-surface-elevated/60 p-6 mb-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <Code2 className="w-4 h-4 text-sherpa-400" />
            <h2 className="text-sm font-semibold text-white">Embed Code</h2>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Add this single line before {'</body>'} in your HTML to enable the Sherpa onboarding widget:
          </p>
          <div className="relative">
            <pre className="bg-surface-card border border-surface-border rounded-xl p-4 text-xs text-sherpa-400 font-mono overflow-x-auto">
              {embedCode}
            </pre>
            <button
              onClick={handleCopy}
              className="absolute top-3 right-3 rounded-lg bg-surface-border/50 hover:bg-surface-border px-2.5 py-1.5 text-xs text-gray-400 hover:text-white transition-all flex items-center gap-1.5"
            >
              <Copy className="w-3 h-3" />
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </motion.div>
      )}

      {/* Try it */}
      {published && portUrl && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl border border-surface-border bg-surface-elevated/60 p-6 mb-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white mb-1">Try it live</h2>
              <p className="text-xs text-gray-500">
                The demo app is running with the Sherpa widget embedded. Open it to test the onboarding experience.
              </p>
            </div>
            <a
              href={portUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sherpa-500 to-sherpa-600
                hover:from-sherpa-400 hover:to-sherpa-500 px-5 py-2.5 text-sm font-semibold text-white
                transition-all duration-200 shadow-lg shadow-sherpa-500/20 flex-shrink-0"
            >
              <ExternalLink className="w-4 h-4" />
              Open Demo App
            </a>
          </div>
        </motion.div>
      )}

      {/* Published Flows Summary */}
      {published && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl border border-surface-border bg-surface-elevated/60 overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-surface-border">
            <h2 className="text-sm font-semibold text-white">Published Flows</h2>
          </div>
          <div className="divide-y divide-surface-border/50">
            {program.flows.map((flow, i) => (
              <div key={flow.id} className="px-6 py-4 flex items-center gap-4">
                <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-sherpa-500 to-sherpa-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium">{flow.name}</p>
                  <p className="text-xs text-gray-500 truncate">{flow.description}</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-600 flex-shrink-0">
                  <span className="flex items-center gap-1">
                    <Footprints className="w-3 h-3" />
                    {flow.steps.length}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    ~{flow.estimatedMinutes}m
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </main>
  );
}
