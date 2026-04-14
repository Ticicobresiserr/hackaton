'use client';

import { useRef, useState } from 'react';
import { AppStatus } from '@/hooks/useSSE';

interface Props {
  status: AppStatus;
}

export default function DropZone({ status }: Props) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const disabled = status !== 'idle' || uploading;

  async function uploadFile(file: File) {
    if (!file.name.endsWith('.zip')) {
      alert('Please upload a .zip file');
      return;
    }
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      await fetch('/api/upload', { method: 'POST', body: formData });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        if (disabled) return;
        const file = e.dataTransfer.files[0];
        if (file) uploadFile(file);
      }}
      className={`
        relative flex flex-col items-center justify-center gap-3
        rounded-xl border-2 border-dashed p-10 cursor-pointer
        transition-all duration-200 select-none
        ${isDragOver && !disabled
          ? 'border-blue-400 bg-blue-950/40'
          : disabled
            ? 'border-gray-700 bg-gray-900/30 opacity-60 cursor-not-allowed'
            : 'border-gray-600 bg-gray-900/30 hover:border-gray-400 hover:bg-gray-900/50'
        }
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) uploadFile(file);
          e.target.value = '';
        }}
      />

      <div className="text-4xl">📦</div>
      <div className="text-center">
        <p className="font-semibold text-gray-200">
          {uploading ? 'Uploading...' : 'Drop a ZIP file here'}
        </p>
        <p className="text-sm text-gray-500 mt-1">or click to browse</p>
      </div>
      {!disabled && (
        <span className="text-xs text-gray-600">Max 200 MB · .zip only</span>
      )}
    </div>
  );
}
