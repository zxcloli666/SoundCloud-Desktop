import { api } from '../api';
import type {
  LinkCode,
  RemoteLink,
  RemoteReply,
  RemoteWait,
  SpeakerProvider,
} from './remote-types';

const WAIT_TIMEOUT_MS = 35_000;
const QUICK_TIMEOUT_MS = 12_000;
const QUIET = { quiet: true, silentStatuses: [401, 403, 404, 409, 429, 503] };

function json(method: string, body: unknown): RequestInit {
  return { method, body: JSON.stringify(body) };
}

export const remoteApi = {
  wait: (since: string) =>
    api<RemoteWait>(
      `/remote/wait?since=${encodeURIComponent(since)}`,
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
  links: () => api<{ collection: RemoteLink[] }>('/remote/links', QUIET, QUICK_TIMEOUT_MS),
  revoke: (id: string) =>
    api<void>(
      `/remote/links/${encodeURIComponent(id)}`,
      { method: 'DELETE', ...QUIET },
      QUICK_TIMEOUT_MS,
    ),
};
