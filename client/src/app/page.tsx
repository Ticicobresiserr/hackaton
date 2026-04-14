'use client';

import { useSSE } from '@/hooks/useSSE';
import StatusBadge from '@/components/StatusBadge';
import DropZone from '@/components/DropZone';
import GitHubForm from '@/components/GitHubForm';
import LogPanel from '@/components/LogPanel';
import ActionBar from '@/components/ActionBar';

export default function Home() {
  const { status, message, portUrl, logs } = useSSE();

  return (
    <main className="min-h-screen p-6 md:p-10 max-w-5xl mx-auto">
      {/* Header */}
      <header className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Repo Runner</h1>
          <p className="text-sm text-gray-400 mt-1">
            Drop a ZIP or paste a GitHub URL — the AI agent will figure out how to run it
          </p>
        </div>
        <StatusBadge status={status} message={message} />
      </header>

      {/* Input panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="rounded-xl border border-gray-700 bg-gray-900/50 p-6">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
            Upload ZIP
          </h2>
          <DropZone status={status} />
        </div>

        <div className="rounded-xl border border-gray-700 bg-gray-900/50 p-6">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
            GitHub Repository
          </h2>
          <GitHubForm status={status} />
        </div>
      </div>

      {/* Action bar */}
      <div className="mb-4">
        <ActionBar status={status} portUrl={portUrl} />
      </div>

      {/* Log panel */}
      <LogPanel logs={logs} />
    </main>
  );
}
