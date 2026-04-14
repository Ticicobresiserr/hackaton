'use client';

import { AppStatus } from '@/hooks/useSSE';

interface Props {
  status: AppStatus;
  portUrl: string | null;
}

export default function ActionBar({ status, portUrl }: Props) {
  const isRunning = status === 'running';

  async function stop() {
    await fetch('/api/control/stop', { method: 'POST' });
  }

  async function restart() {
    await fetch('/api/control/restart', { method: 'POST' });
  }

  if (!isRunning && !portUrl) return null;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {portUrl && (
        <a
          href={portUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-green-600 hover:bg-green-500
            px-4 py-2 text-sm font-semibold text-white transition-colors duration-150"
        >
          <span>↗</span>
          Open in new tab
          <span className="text-green-200 font-normal text-xs">{portUrl}</span>
        </a>
      )}
      {isRunning && (
        <>
          <button
            onClick={restart}
            className="rounded-lg border border-gray-600 hover:border-gray-400 px-4 py-2
              text-sm font-medium text-gray-300 hover:text-white transition-colors duration-150"
          >
            Restart
          </button>
          <button
            onClick={stop}
            className="rounded-lg bg-red-900 hover:bg-red-700 px-4 py-2
              text-sm font-medium text-red-200 transition-colors duration-150"
          >
            Stop
          </button>
        </>
      )}
    </div>
  );
}
