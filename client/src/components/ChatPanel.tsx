'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, Bot } from 'lucide-react';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  messages: ChatMessage[];
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  streaming?: boolean;
}

export default function ChatPanel({ messages, onSend, disabled, placeholder, streaming }: Props) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || disabled) return;
    onSend(input.trim());
    setInput('');
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12 opacity-60">
            <Bot className="w-8 h-8 text-gray-600 mb-3" />
            <p className="text-sm text-gray-500">Start the conversation</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="flex-shrink-0 w-6 h-6 rounded-lg bg-sherpa-500/10 flex items-center justify-center mr-2 mt-1">
                <Bot className="w-3.5 h-3.5 text-sherpa-400" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-gradient-to-r from-sherpa-500 to-sherpa-600 text-white rounded-br-md'
                  : 'bg-surface-card text-gray-200 border border-surface-border rounded-bl-md'
              }`}
            >
              {msg.content}
              {streaming && i === messages.length - 1 && msg.role === 'assistant' && (
                <span className="inline-flex gap-0.5 ml-1.5 -mb-0.5">
                  <span className="typing-dot w-1.5 h-1.5 rounded-full bg-sherpa-400" />
                  <span className="typing-dot w-1.5 h-1.5 rounded-full bg-sherpa-400" />
                  <span className="typing-dot w-1.5 h-1.5 rounded-full bg-sherpa-400" />
                </span>
              )}
            </div>
          </motion.div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-surface-border p-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={disabled}
          placeholder={placeholder || 'Type a message...'}
          className="flex-1 rounded-xl bg-surface-card border border-surface-border px-4 py-2.5 text-sm text-gray-100
            placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-sherpa-500/40 focus:border-sherpa-500/30
            disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
        />
        <button
          type="submit"
          disabled={disabled || !input.trim()}
          className="rounded-xl bg-gradient-to-r from-sherpa-500 to-sherpa-600 hover:from-sherpa-400 hover:to-sherpa-500
            disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed
            px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200
            shadow-md shadow-sherpa-500/15 disabled:shadow-none"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
