'use client';

import { useEffect, useState } from 'react';

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

    // Poll every 5 seconds
    const interval = setInterval(() => {
      fetch('/api/onboard/sessions')
        .then((r) => r.json())
        .then((data) => setSessions(data.sessions || []));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen p-6 md:p-10 max-w-6xl mx-auto">
        <p className="text-gray-400">Loading dashboard...</p>
      </main>
    );
  }

  const totalSteps = program ? program.flows.reduce((s, f) => s + f.steps.length, 0) : 0;

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
    if (!program) return '—';
    if (session.currentFlowIndex >= program.flows.length) return 'Completed!';
    return program.flows[session.currentFlowIndex]?.name || '—';
  }

  return (
    <main className="min-h-screen p-6 md:p-10 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-2">Onboarding Dashboard</h1>
      <p className="text-gray-400 text-sm mb-6">
        Track user progress through the onboarding program
      </p>

      {sessions.length === 0 ? (
        <div className="rounded-xl border border-gray-700 bg-gray-900/50 p-8 text-center">
          <p className="text-gray-500">No users have started onboarding yet.</p>
          <p className="text-gray-600 text-sm mt-1">
            Share the onboarding page to get started.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-700 bg-gray-900/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 bg-gray-800/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Progress</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Current Flow</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Last Active</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => {
                const pct = totalSteps > 0 ? Math.round((session.completedSteps.length / totalSteps) * 100) : 0;
                const isComplete = program ? session.currentFlowIndex >= program.flows.length : false;

                return (
                  <tr key={session.id} className="border-b border-gray-800 last:border-b-0">
                    <td className="px-4 py-3 text-gray-200 font-medium">{session.userName}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-24 bg-gray-800 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${isComplete ? 'bg-green-500' : 'bg-blue-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className={`text-xs ${isComplete ? 'text-green-400' : 'text-gray-400'}`}>
                          {pct}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm ${isComplete ? 'text-green-400 font-medium' : 'text-gray-300'}`}>
                        {getCurrentFlowName(session)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{timeAgo(session.lastActiveAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary stats */}
      {sessions.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="rounded-xl border border-gray-700 bg-gray-900/50 p-4 text-center">
            <p className="text-2xl font-bold text-white">{sessions.length}</p>
            <p className="text-xs text-gray-500 mt-1">Total Users</p>
          </div>
          <div className="rounded-xl border border-gray-700 bg-gray-900/50 p-4 text-center">
            <p className="text-2xl font-bold text-green-400">
              {sessions.filter((s) => program && s.currentFlowIndex >= program.flows.length).length}
            </p>
            <p className="text-xs text-gray-500 mt-1">Completed</p>
          </div>
          <div className="rounded-xl border border-gray-700 bg-gray-900/50 p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">
              {sessions.length > 0
                ? Math.round(
                    sessions.reduce(
                      (sum, s) => sum + (totalSteps > 0 ? (s.completedSteps.length / totalSteps) * 100 : 0),
                      0
                    ) / sessions.length
                  )
                : 0}%
            </p>
            <p className="text-xs text-gray-500 mt-1">Avg Progress</p>
          </div>
        </div>
      )}
    </main>
  );
}
