import { QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { changeAppLanguage } from '../../../i18n';
import { queryClient } from '../../../lib/query-client';
import { initVoice } from '../../../lib/voice';
import { syncRemote } from '../../../lib/voice/remote';
import { remoteApi } from '../../../lib/voice/remote-api';
import type { RemoteCommand, SpeakerProvider } from '../../../lib/voice/remote-types';
import { ThemeProvider } from '../../ThemeProvider';
import { labLinks } from './fixtures';
import { installLabPort } from './lab-port';
import { VoiceLab } from './VoiceLab';

function wait<T>(ms: number, value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function installLabRemote() {
  let links = labLinks(Date.now());
  let asking: RemoteCommand | null = null;
  let seq = 0;
  const asked = new Map<string, SpeakerProvider>();
  remoteApi.links = () => wait(250, { links });
  remoteApi.linkCode = (provider) => {
    setTimeout(() => {
      const now = Date.now();
      asking = {
        id: `confirm-${now}`,
        seq: ++seq,
        source: provider,
        text: '',
        createdAt: now,
        expiresAt: now + 60_000,
        kind: 'link_confirm',
        provider,
        hint: '47',
      };
      asked.set(asking.id, provider);
    }, 6000);
    return wait(500, { code: '482915', expiresAt: Date.now() + 600_000 });
  };
  remoteApi.revoke = (id) => {
    links = links.filter((l) => l.id !== id);
    return wait(400, undefined);
  };
  remoteApi.wait = async () => {
    for (let i = 0; i < 40 && !asking; i++) await wait(500, null);
    const commands = asking ? [asking] : [];
    asking = null;
    return { commands, cursor: seq, activeDevice: null };
  };
  remoteApi.reply = (reply) => {
    const provider = asked.get(reply.id);
    if (provider && reply.ok) {
      const now = Date.now();
      links = [...links, { id: `link-${now}`, provider, createdAt: now, lastUsedAt: null }];
    }
    return wait(50, undefined);
  };
}

export async function mountVoiceLab() {
  installLabRemote();
  installLabPort();
  initVoice();
  syncRemote(true);
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
