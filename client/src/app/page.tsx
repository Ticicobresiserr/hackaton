'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { GitBranch, Upload, ArrowRight, Sparkles, Code2, Zap, CheckCircle2 } from 'lucide-react';
import { useSSE } from '@/hooks/useSSE';
import ThinkingPanel from '@/components/ThinkingPanel';
import AuroraBackground from '@/components/ui/aurora-background';

const FEATURES = [
  { icon: Code2, title: 'Reads your code', desc: 'Every file, route, and form field' },
  { icon: Zap, title: 'Zero setup', desc: 'No manual configuration ever' },
  { icon: Sparkles, title: 'AI-powered', desc: 'Claude Opus 4.6 analysis' },
];

export default function Home() {
  const { status, message, portUrl, logs, thinking, program } = useSSE();
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [userTriggered, setUserTriggered] = useState(false);

  const busy = status !== 'idle' && status !== 'error';
  // Only show "program ready" if the user triggered analysis in THIS session
  const showReady = program && userTriggered;

  async function handleGitHub(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || busy) return;
    setSubmitting(true);
    setUserTriggered(true);
    try {
      await fetch('/api/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFileUpload(f: File) {
    if (!f.name.endsWith('.zip')) return;
    setFile(f);
    setSubmitting(true);
    const formData = new FormData();
    formData.append('file', f);
    try {
      await fetch('/api/upload', { method: 'POST', body: formData });
    } finally {
      setSubmitting(false);
    }
  }

  const isAnalyzing = status === 'analyzing' || (thinking && !showReady);
  const isWorking = busy && !isAnalyzing;

  return (
    <AuroraBackground className="min-h-[calc(100vh-56px)]">
      <main className="min-h-[calc(100vh-56px)]">
        {/* Hero */}
        <AnimatePresence mode="wait">
          {!busy && !showReady && (
            <motion.div
              key="hero"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
            >
              <section className="pt-24 pb-8 px-6 text-center max-w-3xl mx-auto">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-sherpa-500/20 bg-sherpa-500/5 mb-8"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-sherpa-400" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-sherpa-500" />
                  </span>
                  <span className="text-xs font-medium text-sherpa-400">Powered by Claude Opus 4.6</span>
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-5xl md:text-6xl font-extrabold text-white tracking-tight leading-[1.1]"
                >
                  Turn any codebase into an{' '}
                  <span className="text-gradient-sherpa">intelligent onboarding agent</span>
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-lg text-gray-400 mt-6 max-w-xl mx-auto leading-relaxed"
                >
                  Upload your repo. Our AI reads every file, detects the critical user flows,
                  and creates a step-by-step onboarding program — in minutes, not months.
                </motion.p>

                {/* Feature badges */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="flex items-center justify-center gap-6 mt-8"
                >
                  {FEATURES.map(({ icon: Icon, title, desc }) => (
                    <div key={title} className="flex items-center gap-2 text-left">
                      <div className="w-8 h-8 rounded-lg bg-sherpa-500/10 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4 text-sherpa-400" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-300">{title}</p>
                        <p className="text-[11px] text-gray-500">{desc}</p>
                      </div>
                    </div>
                  ))}
                </motion.div>
              </section>

              {/* Upload section */}
              <motion.section
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="max-w-xl mx-auto px-6 pb-20"
              >
                {/* GitHub URL input */}
                <form onSubmit={handleGitHub} className="mb-5">
                  <label className="block text-sm font-medium text-gray-400 mb-2.5">
                    Paste a GitHub repository URL
                  </label>
                  <div className="flex gap-3">
                    <div className="relative flex-1 group">
                      <GitBranch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 transition-colors group-focus-within:text-sherpa-500" />
                      <input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://github.com/your-org/your-app"
                        disabled={busy}
                        className="w-full rounded-xl bg-surface-elevated border border-surface-border pl-10 pr-4 py-3 text-sm text-gray-100
                          placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-sherpa-500/50 focus:border-sherpa-500/50
                          disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={busy || !url.trim()}
                      className="rounded-xl bg-gradient-to-r from-sherpa-500 to-sherpa-600 hover:from-sherpa-400 hover:to-sherpa-500
                        disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed
                        px-6 py-3 text-sm font-semibold text-white transition-all duration-200
                        shadow-lg shadow-sherpa-500/20 hover:shadow-sherpa-500/30 disabled:shadow-none
                        flex items-center gap-2"
                    >
                      Analyze
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </form>

                {/* Divider */}
                <div className="flex items-center gap-4 my-6">
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-surface-border to-transparent" />
                  <span className="text-xs text-gray-600 uppercase tracking-widest font-medium">or upload a zip</span>
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-surface-border to-transparent" />
                </div>

                {/* ZIP upload - drop zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const f = e.dataTransfer.files[0];
                    if (f) handleFileUpload(f);
                  }}
                  onClick={() => {
                    if (busy) return;
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.zip';
                    input.onchange = (e) => {
                      const f = (e.target as HTMLInputElement).files?.[0];
                      if (f) handleFileUpload(f);
                    };
                    input.click();
                  }}
                  className={`group relative rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition-all duration-300 ${
                    busy
                      ? 'border-gray-800/50 opacity-50 cursor-not-allowed'
                      : dragOver
                        ? 'border-sherpa-500 bg-sherpa-500/5 scale-[1.01]'
                        : 'border-surface-border hover:border-sherpa-500/40 hover:bg-sherpa-500/[0.03]'
                  }`}
                >
                  <Upload className={`w-8 h-8 mx-auto mb-3 transition-all duration-300 ${
                    dragOver ? 'text-sherpa-400 scale-110' : 'text-gray-600 group-hover:text-gray-400'
                  }`} />
                  <p className="text-sm text-gray-400 font-medium">
                    {file ? file.name : 'Drop a ZIP file here or click to browse'}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    Supports any web application codebase
                  </p>
                </div>
              </motion.section>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Progress */}
        <AnimatePresence>
          {isWorking && !showReady && (
            <motion.section
              key="progress"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-xl mx-auto px-6 pt-20 pb-8"
            >
              <div className="rounded-2xl border border-surface-border bg-surface-elevated/80 p-8 text-center border-glow-sherpa">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-sherpa-400" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-sherpa-500" />
                  </span>
                  <p className="text-white font-semibold">{message}</p>
                </div>
                <p className="text-sm text-gray-500">
                  Cloning, installing, and starting your app...
                </p>
                <div className="mt-6 w-full h-1 bg-surface-border rounded-full overflow-hidden">
                  <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-sherpa-500 to-sherpa-400 animate-shimmer" />
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Thinking */}
        <AnimatePresence>
          {isAnalyzing && (
            <motion.section
              key="thinking"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-3xl mx-auto px-6 pt-16 pb-8"
            >
              <div className="rounded-2xl border border-indigo-500/20 bg-surface-elevated/80 p-6 text-center mb-5 border-glow-indigo">
                <div className="flex items-center justify-center gap-3">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-indigo-400" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500" />
                  </span>
                  <p className="text-white font-semibold">AI is analyzing your codebase...</p>
                </div>
                <p className="text-sm text-gray-500 mt-1.5">
                  Claude Opus 4.6 is reading every file, identifying critical user flows
                </p>
              </div>
              <ThinkingPanel thinking={thinking} />
            </motion.section>
          )}
        </AnimatePresence>

        {/* Program ready */}
        <AnimatePresence>
          {showReady && (
            <motion.section
              key="done"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', damping: 20, stiffness: 200 }}
              className="max-w-xl mx-auto px-6 pt-24 pb-16 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', damping: 12 }}
                className="w-20 h-20 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/10 flex items-center justify-center mx-auto mb-8 border border-green-500/20"
              >
                <CheckCircle2 className="w-10 h-10 text-green-400" />
              </motion.div>
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-3xl font-bold text-white mb-3"
              >
                Onboarding program ready
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-gray-400 mb-2"
              >
                {program.platformName} — {program.platformDescription}
              </motion.p>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.45 }}
                className="text-sm text-gray-500 mb-10"
              >
                {program.flows.length} flows &middot; {program.flows.reduce((s: number, f) => s + f.steps.length, 0)} steps detected automatically
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Link
                  href="/program"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sherpa-500 to-sherpa-600
                    hover:from-sherpa-400 hover:to-sherpa-500 px-8 py-3.5 text-sm font-semibold text-white
                    transition-all duration-200 shadow-lg shadow-sherpa-500/20 hover:shadow-sherpa-500/30"
                >
                  Review & Customize
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </motion.div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </AuroraBackground>
  );
}
