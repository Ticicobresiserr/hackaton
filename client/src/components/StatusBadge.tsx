'use client';

import { AppStatus } from '@/hooks/useSSE';

const STATUS_CONFIG: Record<AppStatus, { label: string; bg: string; dot: string }> = {
  idle: { label: 'Idle', bg: 'bg-gray-700', dot: 'bg-gray-400' },
  downloading: { label: 'Downloading', bg: 'bg-blue-900', dot: 'bg-blue-400' },
  'setting-up': { label: 'Setting up', bg: 'bg-yellow-900', dot: 'bg-yellow-400' },
  running: { label: 'Running', bg: 'bg-green-900', dot: 'bg-green-400' },
  error: { label: 'Error', bg: 'bg-red-900', dot: 'bg-red-400' },
};

interface Props {
  status: AppStatus;
  message: string;
}

export default function StatusBadge({ status, message }: Props) {
  const config = STATUS_CONFIG[status];
  const isActive = status !== 'idle' && status !== 'error';

  return (
    <div className="flex items-center gap-3">
      <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${config.bg}`}>
        <span className="relative flex h-2 w-2">
          {isActive && (
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${config.dot}`} />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dot}`} />
        </span>
        {config.label}
      </span>
      <span className="text-sm text-gray-400 truncate max-w-md">{message}</span>
    </div>
  );
}
