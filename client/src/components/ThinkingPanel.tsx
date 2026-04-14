'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Brain } from 'lucide-react';

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
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-surface-elevated border border-indigo-500/15 overflow-hidden border-glow-indigo"
    >
      <div className="flex items-center gap-2.5 px-5 py-3 border-b border-indigo-500/15 bg-indigo-950/20">
        <Brain className="w-4 h-4 text-indigo-400" />
        <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">
          Extended Thinking
        </span>
        <span className="relative flex h-2 w-2 ml-auto">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-indigo-400" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-400" />
        </span>
      </div>
      <pre className="h-52 overflow-y-auto p-5 text-xs font-mono leading-6 text-indigo-200/70 whitespace-pre-wrap">
        {thinking}
        <span className="inline-block w-2 h-4 bg-indigo-400 ml-0.5 animate-pulse rounded-sm" />
        <div ref={bottomRef} />
      </pre>
    </motion.div>
  );
}
