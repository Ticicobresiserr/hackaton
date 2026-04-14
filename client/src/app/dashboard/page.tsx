'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, CheckCircle2, TrendingUp, Activity } from 'lucide-react';

interface UserSession {
  id: string;
  userName: string;
  currentFlowIndex: number;
  currentStepIndex: number;
  completedFlows: string[];
  completedSteps: string[];
  startedAt: string;
  lastActiveAt: string;
}

export default function DashboardPage() {
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [program, setProgram] = useState<{ flows: { id: string; name: string; steps: { id: string }[] }[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/onboard/sessions').then((r) => r.json()),
      fetch('/api/program').then((r) => r.json()),
    ]).then(([sessData, progData]) => {
      setSessions(sessData.sessions || []);
      setProgram(progData.program);
      setLoading(false);
    }).catch(() => setLoading(false));

    const interval = setInterval(() => {
      fetch('/api/onboard/sessions')
        .then((r) => r.json())
        .then((data) => setSessions(data.sessions || []));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen p-6 md:p-10 max-w-6xl mx-auto flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <div className="w-5 h-5 border-2 border-gray-600 border-t-sherpa-500 rounded-full animate-spin" />
          <span className="text-sm">Loading dashboard...</span>
        </div>
      </main>
    );
  }

  const totalSteps = program ? program.flows.reduce((s, f) => s + f.steps.length, 0) : 0;
  const completedCount = sessions.filter((s) => program && s.currentFlowIndex >= program.flows.length).length;
  const avgProgress = sessions.length > 0
    ? Math.round(
        sessions.reduce(
          (sum, s) => sum + (totalSteps > 0 ? (s.completedSteps.length / totalSteps) * 100 : 0),
          0
        ) / sessions.length
      )
    : 0;

  function timeAgo(isoString: string) {
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  function getCurrentFlowName(session: UserSession) {
    if (!program) return '\u2014';
    if (session.currentFlowIndex >= program.flows.length) return 'Completed';
    return program.flows[session.currentFlowIndex]?.name || '\u2014';
  }

  const stats = [
    {
      label: 'Total Users',
      value: sessions.length,
      icon: Users,
      color: 'text-sherpa-400',
      bg: 'bg-sherpa-500/10',
      border: 'border-sherpa-500/15',
    },
    {
      label: 'Completed',
      value: completedCount,
      icon: CheckCircle2,
      color: 'text-green-400',
      bg: 'bg-green-500/10',
      border: 'border-green-500/15',
    },
    {
      label: 'Avg Progress',
      value: `${avgProgress}%`,
      icon: TrendingUp,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10',
      border: 'border-indigo-500/15',
    },
  ];

  return (
    <main className="min-h-screen p-6 md:p-10 max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold text-white mb-1">Onboarding Dashboard</h1>
        <p className="text-gray-500 text-sm mb-8">
          Track user progress through the onboarding program
        </p>
      </motion.div>

      {/* Stats */}
      {sessions.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className={`rounded-2xl border ${stat.border} bg-surface-elevated/60 p-5 group hover:bg-surface-elevated transition-all duration-300`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
              </div>
              <p className="text-3xl font-bold text-white">{stat.value}</p>
              <p className="text-xs text-gray-500 mt-1 font-medium uppercase tracking-wider">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      )}

      {sessions.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-surface-border bg-surface-elevated/60 p-12 text-center"
        >
          <Activity className="w-8 h-8 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No users have started onboarding yet</p>
          <p className="text-gray-600 text-sm mt-1">
            Share the onboarding page to get started
          </p>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-2xl border border-surface-border bg-surface-elevated/60 overflow-hidden"
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border">
                <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">User</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Progress</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Current Flow</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Last Active</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session, i) => {
                const pct = totalSteps > 0 ? Math.round((session.completedSteps.length / totalSteps) * 100) : 0;
                const isComplete = program ? session.currentFlowIndex >= program.flows.length : false;

                return (
                  <motion.tr
                    key={session.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 + i * 0.05 }}
                    className="border-b border-surface-border/50 last:border-b-0 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-surface-card border border-surface-border flex items-center justify-center">
                          <span className="text-xs font-semibold text-gray-400">
                            {session.userName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-gray-200 font-medium">{session.userName}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-28 bg-surface-card rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isComplete
                                ? 'bg-gradient-to-r from-green-500 to-emerald-400'
                                : 'bg-gradient-to-r from-sherpa-500 to-sherpa-400'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className={`text-xs font-semibold ${isComplete ? 'text-green-400' : 'text-gray-400'}`}>
                          {pct}%
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {isComplete ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-400 bg-green-500/10 border border-green-500/15 px-2.5 py-1 rounded-full">
                          <CheckCircle2 className="w-3 h-3" />
                          Completed
                        </span>
                      ) : (
                        <span className="text-sm text-gray-300">{getCurrentFlowName(session)}</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-gray-500 text-xs">{timeAgo(session.lastActiveAt)}</td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </motion.div>
      )}
    </main>
  );
}
