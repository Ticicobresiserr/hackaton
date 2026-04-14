'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Clock, Footprints } from 'lucide-react';
import type { OnboardingFlow } from '@/hooks/useSSE';

interface Props {
  flow: OnboardingFlow;
  index: number;
}

export default function FlowCard({ flow, index }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="group rounded-2xl border border-surface-border bg-surface-elevated/60 overflow-hidden
        hover:border-sherpa-500/20 transition-all duration-300"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-5 py-4 flex items-start gap-4 transition-colors"
      >
        <span className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-sherpa-500 to-sherpa-600
          flex items-center justify-center text-sm font-bold text-white shadow-lg shadow-sherpa-500/15 mt-0.5">
          {index + 1}
        </span>

        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold text-[15px] group-hover:text-sherpa-300 transition-colors">
            {flow.name}
          </h3>
          <p className="text-sm text-gray-500 mt-1 leading-relaxed">{flow.description}</p>
          <div className="flex items-center gap-4 mt-2.5">
            <span className="flex items-center gap-1.5 text-xs text-gray-600">
              <Footprints className="w-3 h-3" />
              {flow.steps.length} steps
            </span>
            <span className="flex items-center gap-1.5 text-xs text-gray-600">
              <Clock className="w-3 h-3" />
              ~{flow.estimatedMinutes} min
            </span>
          </div>
        </div>

        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex-shrink-0 mt-1 text-gray-500"
        >
          <ChevronDown className="w-5 h-5" />
        </motion.div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="border-t border-surface-border px-5 py-4 space-y-3">
              {flow.steps.map((step, i) => (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex gap-3 text-sm"
                >
                  <div className="flex flex-col items-center">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-surface-card border border-surface-border
                      flex items-center justify-center text-[11px] font-semibold text-gray-400">
                      {i + 1}
                    </span>
                    {i < flow.steps.length - 1 && (
                      <div className="w-px flex-1 bg-surface-border mt-1" />
                    )}
                  </div>
                  <div className="pb-3">
                    <p className="text-gray-200 font-medium">{step.title}</p>
                    <p className="text-gray-500 mt-0.5 leading-relaxed">{step.instruction}</p>
                    {step.page && (
                      <span className="inline-flex items-center mt-1.5 text-[11px] text-sherpa-400 bg-sherpa-500/10 px-2 py-0.5 rounded-md font-medium">
                        {step.page}
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
