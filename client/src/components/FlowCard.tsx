'use client';

import { useState } from 'react';
import type { OnboardingFlow } from '@/hooks/useSSE';

interface Props {
  flow: OnboardingFlow;
  index: number;
}

export default function FlowCard({ flow, index }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900/50 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-5 py-4 flex items-start gap-4 hover:bg-gray-800/50 transition-colors"
      >
        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-white">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold">{flow.name}</h3>
          <p className="text-sm text-gray-400 mt-0.5">{flow.description}</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
            <span>{flow.steps.length} steps</span>
            <span>~{flow.estimatedMinutes} min</span>
          </div>
        </div>
        <span className="text-gray-500 flex-shrink-0 mt-1">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="border-t border-gray-700 px-5 py-3 space-y-3">
          {flow.steps.map((step, i) => (
            <div key={step.id} className="flex gap-3 text-sm">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs text-gray-300 mt-0.5">
                {i + 1}
              </span>
              <div>
                <p className="text-gray-200 font-medium">{step.title}</p>
                <p className="text-gray-400 mt-0.5">{step.instruction}</p>
                {step.page && (
                  <span className="inline-block mt-1 text-xs text-blue-400 bg-blue-950/50 px-2 py-0.5 rounded">
                    {step.page}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
