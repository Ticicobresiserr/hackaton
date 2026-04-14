'use client';

import { useEffect, useRef } from 'react';

interface Props {
  thinking: string;
}

export default function ThinkingPanel({ thinking }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thinking]);

  if (!thinking) return null;

  return (
    <div className="rounded-xl bg-gray-900 border border-purple-800/50 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-purple-800/50 bg-purple-950/30">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-purple-400" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-400" />
        </span>
        <span className="text-xs font-semibold text-purple-300 uppercase tracking-wider">
          Opus 4.6 Extended Thinking
        </span>
      </div>
      <pre className="h-48 overflow-y-auto p-4 text-xs font-mono leading-5 text-purple-200/80 whitespace-pre-wrap">
        {thinking}
        <span className="inline-block w-2 h-4 bg-purple-400 ml-0.5 animate-pulse" />
        <div ref={bottomRef} />
      </pre>
    </div>
  );
}
