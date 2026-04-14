'use client';

import { useEffect, useReducer, useRef } from 'react';

export type AppStatus = 'idle' | 'downloading' | 'setting-up' | 'running' | 'error';

export interface LogEntry {
  line: string;
  stream: 'stdout' | 'stderr';
}

export interface AppState {
  status: AppStatus;
  message: string;
  portUrl: string | null;
  logs: LogEntry[];
}

type Action =
  | { type: 'STATUS'; payload: { state: AppStatus; message: string } }
  | { type: 'PORT'; payload: { port: number; url: string } }
  | { type: 'LOG'; payload: LogEntry }
  | { type: 'STOPPED' };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'STATUS':
      return { ...state, status: action.payload.state, message: action.payload.message };
    case 'PORT':
      return { ...state, portUrl: action.payload.url };
    case 'LOG':
      return { ...state, logs: [...state.logs.slice(-500), action.payload] }; // cap at 500 lines
    case 'STOPPED':
      return { ...state, portUrl: null };
    default:
      return state;
  }
}

const INITIAL_STATE: AppState = {
  status: 'idle',
  message: 'Ready',
  portUrl: null,
  logs: [],
};

export function useSSE(): AppState {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource('/api/events');
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

    return () => {
      es.close();
    };
  }, []);

  return state;
}
