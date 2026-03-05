import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { setCacheServerPort } from './lib/constants';
import './i18n';
import './lib/audio';
import './lib/discord';
import './lib/tray';
import './index.css';

if (import.meta.env.DEV) {
  const script = document.createElement('script');
  script.src = 'https://unpkg.com/react-scan/dist/auto.global.js';
  script.crossOrigin = 'anonymous';
  document.head.appendChild(script);
}

invoke<number>('get_cache_server_port')
  .then((port) => {
    setCacheServerPort(port);
    console.log(`[CacheServer] Port received: ${port}`);
  })
  .catch((e) => console.warn('[CacheServer] Failed to get port:', e));

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
