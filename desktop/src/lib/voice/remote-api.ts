import { api } from '../api';
import type {
  LinkCode,
  RemoteLink,
  RemoteReply,
  RemoteWait,
  SpeakerProvider,
} from './remote-types';

export const REMOTE_LINKS_KEY = ['voice', 'remote-links'];

const WAIT_TIMEOUT_MS = 35_000;
const QUICK_TIMEOUT_MS = 12_000;
const QUIET = { quiet: true, silentStatuses: [401, 403, 404, 409, 429, 503] };

function json(method: string, body: unknown): RequestInit {
  return { method, body: JSON.stringify(body) };
}

function waitQuery(since: number | null, device: string, active: number): string {
  const query = new URLSearchParams({ device, active: String(active) });
  if (since !== null) query.set('since', String(since));
  return query.toString();
}

export const remoteApi = {
  wait: (since: number | null, device: string, active: number) =>
    api<RemoteWait>(
      `/remote/wait?${waitQuery(since, device, active)}`,
      { ...QUIET, longPoll: true },
      WAIT_TIMEOUT_MS,
    ),
  reply: (reply: RemoteReply) =>
    api<void>('/remote/reply', { ...json('POST', reply), ...QUIET }, QUICK_TIMEOUT_MS),
  linkCode: (provider: SpeakerProvider) =>
    api<LinkCode>(
      '/remote/link-code',
      { ...json('POST', { provider }), ...QUIET },
      QUICK_TIMEOUT_MS,
    ),
  links: () => api<{ links: RemoteLink[] }>('/remote/links', QUIET, QUICK_TIMEOUT_MS),
  revoke: (id: string) =>
    api<void>(
      `/remote/links/${encodeURIComponent(id)}`,
      { method: 'DELETE', ...QUIET },
      QUICK_TIMEOUT_MS,
    ),
};
