import { trackedInvoke as invoke } from '../diagnostics';
import type { Tier } from '../edge/config';

export type NetErrorKind = 'timeout' | 'dns' | 'connect' | 'tls' | 'reset' | 'body' | 'other';

export class NetError extends Error {
  constructor(
    readonly kind: NetErrorKind,
    detail: string,
  ) {
    super(`net: ${kind}: ${detail}`);
    this.name = 'NetError';
  }
}

export interface NetRoute {
  tier: Tier;
  origin: string;
  attempt: number;
}

export interface NetInit extends RequestInit {
  timeoutMs?: number;
  route?: NetRoute;
}

interface Answer {
  status: number;
  statusText: string;
  headers: [string, string][];
  url: string;
  stalled?: boolean;
}

interface Failure {
  error: { kind: NetErrorKind | 'aborted'; message: string };
}

export type FrameHead = Answer | Failure;

const DEFAULT_TIMEOUT_MS = 60_000;
const WARN_SLACK_MS = 5_000;
const NULL_BODY_STATUS = new Set([101, 103, 204, 205, 304]);
const ID_SPACE = 0x7fff_ffff;

let nextId = Math.floor(Math.random() * ID_SPACE);

function takeId(): number {
  nextId = (nextId + 1) % ID_SPACE;
  return nextId;
}

function abortError(): DOMException {
  return new DOMException('Aborted', 'AbortError');
}

function bytesOf(raw: unknown): Uint8Array {
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
  if (ArrayBuffer.isView(raw)) return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
  if (Array.isArray(raw)) return Uint8Array.from(raw as number[]);
  throw new NetError('other', 'unexpected response from the app');
}

export function decodeFrame(raw: unknown): { head: FrameHead; body: Uint8Array } {
  const bytes = bytesOf(raw);
  if (bytes.byteLength < 4) throw new NetError('other', 'truncated response from the app');
  const size = new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0);
  const head = JSON.parse(new TextDecoder().decode(bytes.subarray(4, 4 + size))) as FrameHead;
  return { head, body: bytes.subarray(4 + size) };
}

async function bodyText(body: BodyInit | null | undefined): Promise<string | null> {
  if (body == null) return null;
  if (typeof body === 'string') return body;
  return new Response(body).text();
}

function cancellable<T>(pending: Promise<T>, id: number, signal?: AbortSignal | null): Promise<T> {
  if (!signal) return pending;
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      void invoke('net_fetch_cancel', { id }).catch(() => undefined);
      reject(abortError());
    };
    signal.addEventListener('abort', onAbort, { once: true });
    pending.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
}

export async function netRequest(
  url: string,
  init: NetInit = {},
): Promise<{ res: Response; bytes: number; stalled: boolean }> {
  if (init.signal?.aborted) throw abortError();
  const id = takeId();
  const request = {
    id,
    url,
    method: (init.method ?? 'GET').toUpperCase(),
    headers: [...new Headers(init.headers).entries()],
    body: await bodyText(init.body),
    timeoutMs: init.timeoutMs ?? null,
    route: init.route ?? null,
  };
  if (init.signal?.aborted) throw abortError();
  const warnMs = (init.timeoutMs ?? DEFAULT_TIMEOUT_MS) + WARN_SLACK_MS;
  const pending = invoke<unknown>('net_fetch', { request }, warnMs).catch((error: unknown) => {
    throw new NetError('other', error instanceof Error ? error.message : String(error));
  });
  const { head, body } = decodeFrame(await cancellable(pending, id, init.signal));
  if ('error' in head) {
    if (head.error.kind === 'aborted') throw abortError();
    throw new NetError(head.error.kind, head.error.message);
  }
  const empty = NULL_BODY_STATUS.has(head.status) || body.byteLength === 0;
  const res = new Response(empty ? null : (body as Uint8Array<ArrayBuffer>), {
    status: head.status,
    statusText: head.statusText,
    headers: head.headers,
  });
  return { res, bytes: body.byteLength, stalled: head.stalled === true };
}

export async function netFetch(url: string, init?: NetInit): Promise<Response> {
  return (await netRequest(url, init)).res;
}
