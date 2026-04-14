'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSSE } from '@/hooks/useSSE';
import ThinkingPanel from '@/components/ThinkingPanel';

export default function Home() {
  const { status, message, portUrl, logs, thinking, program } = useSSE();
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const busy = status !== 'idle' && status !== 'error';

  async function handleGitHub(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || busy) return;
    setSubmitting(true);
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

  const isAnalyzing = status === 'analyzing' || (thinking && !program);
  const isWorking = busy && !isAnalyzing;

  return (
    <main className="min-h-screen">
      {/* Hero */}
      {!busy && !program && (
        <section className="pt-20 pb-16 px-6 text-center max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight leading-tight">
            Turn any codebase into an
            <span className="text-blue-400"> intelligent onboarding agent</span>
          </h1>
          <p className="text-lg text-gray-400 mt-4 max-w-xl mx-auto">
            Upload your repo. Our AI reads every file, detects the critical user flows,
            and creates a step-by-step onboarding program — in minutes, not months.
          </p>
        </section>
      )}

      {/* Upload section */}
      {!program && (
        <section className="max-w-2xl mx-auto px-6 pb-12">
          {/* GitHub URL */}
          <form onSubmit={handleGitHub} className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Paste your GitHub repository URL
            </label>
            <div className="flex gap-3">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://github.com/your-org/your-app"
                disabled={busy}
                className="flex-1 rounded-xl bg-gray-900 border border-gray-700 px-4 py-3 text-sm text-gray-100
                  placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                  disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                type="submit"
                disabled={busy || !url.trim()}
                className="rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700
                  disabled:cursor-not-allowed px-6 py-3 text-sm font-semibold text-white
                  transition-colors duration-150 whitespace-nowrap"
              >
                {submitting ? 'Starting...' : 'Analyze'}
              </button>
            </div>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-gray-800" />
            <span className="text-xs text-gray-600 uppercase tracking-wider">or upload a ZIP</span>
            <div className="flex-1 h-px bg-gray-800" />
          </div>

          {/* ZIP upload */}
          <div
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
            className={`rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all
              ${busy
                ? 'border-gray-800 opacity-50 cursor-not-allowed'
                : 'border-gray-700 hover:border-blue-500 hover:bg-blue-950/10'
              }`}
          >
            <p className="text-gray-400 text-sm">
              {file ? file.name : 'Drop a ZIP file here or click to browse'}
            </p>
          </div>
        </section>
      )}

      {/* Progress section */}
      {isWorking && !program && (
        <section className="max-w-2xl mx-auto px-6 pb-8">
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 text-center">
            <div className="flex items-center justify-center gap-3 mb-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-blue-400" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-400" />
              </span>
              <p className="text-white font-medium">{message}</p>
            </div>
            <p className="text-sm text-gray-500">This may take a minute. We&apos;re cloning, installing, and starting your app.</p>
          </div>
        </section>
      )}

      {/* Thinking panel */}
      {isAnalyzing && (
        <section className="max-w-3xl mx-auto px-6 pb-8">
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 text-center mb-4">
            <div className="flex items-center justify-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-purple-400" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-400" />
              </span>
              <p className="text-white font-medium">AI is analyzing your codebase...</p>
            </div>
            <p className="text-sm text-gray-500 mt-1">Claude Opus 4.6 is reading every file, identifying critical user flows.</p>
          </div>
          <ThinkingPanel thinking={thinking} />
        </section>
      )}

      {/* Program ready */}
      {program && (
        <section className="max-w-2xl mx-auto px-6 pt-16 pb-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-green-600/20 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Onboarding program ready for &quot;{program.platformName}&quot;
          </h2>
          <p className="text-gray-400 mb-2">{program.platformDescription}</p>
          <p className="text-sm text-gray-500 mb-8">
            {program.flows.length} flows, {program.flows.reduce((s, f) => s + f.steps.length, 0)} steps detected automatically
          </p>
          <Link
            href="/program"
            className="inline-block rounded-xl bg-blue-600 hover:bg-blue-500 px-8 py-3 text-sm font-semibold text-white transition-colors"
          >
            Review & Customize
          </Link>
        </section>
      )}
    </main>
  );
}
