import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { changeAppLanguage } from '../../../i18n';
import { initVoice } from '../../../lib/voice';
import { syncRemote } from '../../../lib/voice/remote';
import { remoteApi } from '../../../lib/voice/remote-api';
import { ThemeProvider } from '../../ThemeProvider';
import { labLinks } from './fixtures';
import { installLabPort } from './lab-port';
import { VoiceLab } from './VoiceLab';

const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function wait<T>(ms: number, value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function installLabRemote() {
  let links = labLinks(Date.now());
  remoteApi.links = () => wait(250, { collection: links });
  remoteApi.linkCode = (provider) => {
    setTimeout(() => {
      links = [
        ...links,
        {
          id: `link-${Date.now()}`,
          provider,
          created_at: new Date().toISOString(),
          last_used_at: null,
        },
      ];
    }, 9000);
    return wait(500, { code: '482915', expires_at: new Date(Date.now() + 600_000).toISOString() });
  };
  remoteApi.revoke = (id) => {
    links = links.filter((l) => l.id !== id);
    return wait(400, undefined);
  };
  remoteApi.wait = () => wait(20_000, { commands: [], cursor: String(Date.now()) });
  remoteApi.reply = () => wait(50, undefined);
}

export async function mountVoiceLab() {
  installLabRemote();
  installLabPort();
  initVoice();
  syncRemote(true);
  await changeAppLanguage(new URLSearchParams(window.location.search).get('lang') ?? 'ru');
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <QueryClientProvider client={query}>
        <MemoryRouter initialEntries={[{ pathname: '/settings', state: { category: 'voice' } }]}>
          <ThemeProvider>
            <VoiceLab />
          </ThemeProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </React.StrictMode>,
  );
}
