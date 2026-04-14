'use client';

import { useEffect, useReducer, useRef } from 'react';

export type AppStatus = 'idle' | 'downloading' | 'setting-up' | 'running' | 'error' | 'analyzing';

export interface LogEntry {
  line: string;
  stream: 'stdout' | 'stderr';
}

export interface OnboardingStep {
  id: string;
  title: string;
  instruction: string;
  explanation: string;
  page: string;
  order: number;
}

export interface OnboardingFlow {
  id: string;
  name: string;
  description: string;
  estimatedMinutes: number;
  order: number;
  steps: OnboardingStep[];
}

export interface OnboardingProgram {
  platformName: string;
  platformDescription: string;
  flows: OnboardingFlow[];
  generatedAt: string;
}

export interface AppState {
  status: AppStatus;
  message: string;
  portUrl: string | null;
  logs: LogEntry[];
  thinking: string;
  program: OnboardingProgram | null;
}

type Action =
  | { type: 'STATUS'; payload: { state: AppStatus; message: string } }
  | { type: 'PORT'; payload: { port: number; url: string } }
  | { type: 'LOG'; payload: LogEntry }
  | { type: 'STOPPED' }
  | { type: 'THINKING'; payload: { text: string } }
  | { type: 'PROGRAM'; payload: { program: OnboardingProgram } };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'STATUS':
      return { ...state, status: action.payload.state as AppStatus, message: action.payload.message };
    case 'PORT':
      return { ...state, portUrl: action.payload.url };
    case 'LOG':
      return { ...state, logs: [...state.logs.slice(-500), action.payload] };
    case 'STOPPED':
      return { ...state, portUrl: null };
    case 'THINKING':
      return { ...state, thinking: state.thinking + action.payload.text };
    case 'PROGRAM':
      return { ...state, program: action.payload.program };
    default:
      return state;
  }
}

const INITIAL_STATE: AppState = {
  status: 'idle',
  message: 'Ready',
  portUrl: null,
  logs: [],
  thinking: '',
  program: null,
};

// Connect directly to backend to avoid Next.js proxy buffering SSE
const SSE_URL =
  typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:3001/api/events'
    : '/api/events';

export function useSSE(): AppState {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(SSE_URL);
    esRef.current = es;

    es.addEventListener('status', (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      dispatch({ type: 'STATUS', payload: data });
    });

    es.addEventListener('port', (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      dispatch({ type: 'PORT', payload: data });
    });

    es.addEventListener('log', (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      dispatch({ type: 'LOG', payload: data });
    });

    es.addEventListener('stopped', () => {
      dispatch({ type: 'STOPPED' });
    });

    es.addEventListener('thinking', (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      dispatch({ type: 'THINKING', payload: data });
    });

    es.addEventListener('program', (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      dispatch({ type: 'PROGRAM', payload: data });
    });

    return () => {
      es.close();
    };
  }, []);

  return state;
}
