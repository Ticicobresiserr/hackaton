'use client';

import { useState } from 'react';
import { AppStatus } from '@/hooks/useSSE';

interface Props {
  status: AppStatus;
}

export default function GitHubForm({ status }: Props) {
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const disabled = status !== 'idle' || loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    try {
      await fetch('/api/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), token: token.trim() || undefined }),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 h-full justify-center">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          GitHub Repository URL
        </label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://github.com/owner/repo"
          disabled={disabled}
          className="w-full rounded-lg bg-gray-800 border border-gray-600 px-3 py-2 text-sm text-gray-100
            placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500
            disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Personal Access Token
          <span className="ml-1 text-gray-500 font-normal">(optional, for private repos)</span>
        </label>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="ghp_..."
          disabled={disabled}
          className="w-full rounded-lg bg-gray-800 border border-gray-600 px-3 py-2 text-sm text-gray-100
            placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500
            disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      <button
        type="submit"
        disabled={disabled || !url.trim()}
        className="mt-1 w-full rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700
          disabled:cursor-not-allowed px-4 py-2 text-sm font-semibold text-white
          transition-colors duration-150"
      >
        {loading ? 'Cloning...' : 'Clone & Run'}
      </button>
    </form>
  );
}
