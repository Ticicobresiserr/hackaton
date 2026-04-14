'use client';

import { useEffect, useRef } from 'react';
import { LogEntry } from '@/hooks/useSSE';

interface Props {
  logs: LogEntry[];
}

export default function LogPanel({ logs }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="rounded-xl bg-gray-900 border border-gray-700 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-gray-800">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Output</span>
        <span className="text-xs text-gray-600">{logs.length} lines</span>
      </div>
      <pre className="h-64 overflow-y-auto p-4 text-xs font-mono leading-5">
        {logs.length === 0 ? (
          <span className="text-gray-600">No output yet...</span>
        ) : (
          logs.map((entry, i) => (
            <span
              key={i}
              className={entry.stream === 'stderr' ? 'text-orange-400' : 'text-gray-300'}
            >
              {entry.line}
            </span>
          ))
        )}
        <div ref={bottomRef} />
      </pre>
    </div>
  );
}
