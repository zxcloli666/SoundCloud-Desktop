import { QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { changeAppLanguage } from '../../../i18n';
import { queryClient } from '../../../lib/query-client';
import { initVoice } from '../../../lib/voice';
import { ThemeProvider } from '../../ThemeProvider';
import { installLabPort } from './lab-port';
import { VoiceLab } from './VoiceLab';

export async function mountVoiceLab() {
  installLabPort();
  initVoice();
  await changeAppLanguage(new URLSearchParams(window.location.search).get('lang') ?? 'ru');
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[{ pathname: '/settings', state: { category: 'voice' } }]}>
          <ThemeProvider>
            <VoiceLab />
          </ThemeProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </React.StrictMode>,
  );
}
