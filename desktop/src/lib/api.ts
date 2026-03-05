import { fetch } from '@tauri-apps/plugin-http';
import { toast } from 'sonner';
import { API_BASE } from './constants.ts';

let sessionId: string | null = null;

export function setSessionId(id: string | null) {
  sessionId = id;
}

export function getSessionId() {
  return sessionId;
}

export async function api<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (sessionId) {
    headers.set('x-session-id', sessionId);
  }
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.text();
    const err = new ApiError(res.status, body);
    if (res.status >= 500) {
      toast.error(`Server error (${res.status})`);
    } else if (res.status === 401) {
      toast.error('Session expired');
    } else if (res.status >= 400) {
      try {
        const parsed = JSON.parse(body);
        toast.error(parsed.message || parsed.error || `Error ${res.status}`);
      } catch {
        toast.error(`Error ${res.status}`);
      }
    }
    throw err;
  }

  const contentType = res.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return res.json();
  }
  return res.text() as T;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`API ${status}: ${body}`);
    this.name = 'ApiError';
  }
}

export function streamUrl(trackUrn: string, format = 'http_mp3_128') {
  return `${API_BASE}/tracks/${encodeURIComponent(trackUrn)}/stream?format=${format}${sessionId ? `&session_id=${sessionId}` : ''}`;
}
