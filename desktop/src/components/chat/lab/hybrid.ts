type Options = { headers: Record<string, string> };
type Answer = { answer: unknown } | null;
export type IpcRoute = (cmd: string, args: unknown, options: Options) => Promise<Answer>;

const IPC_URL = /^(?:ipc:\/\/localhost|https?:\/\/ipc\.localhost)\/([^?#]+)/;

function commandOf(input: RequestInfo | URL): string | null {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const match = IPC_URL.exec(url);
  return match ? decodeURIComponent(match[1]) : null;
}

function argsOf(body: BodyInit | null | undefined, headers: Headers): unknown {
  if (body == null) return {};
  if ((headers.get('content-type') ?? '').startsWith('application/json')) {
    return typeof body === 'string' ? JSON.parse(body) : {};
  }
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  if (ArrayBuffer.isView(body))
    return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
  return body;
}

function reply(ok: boolean, value: unknown): Response {
  if (ok && (value instanceof ArrayBuffer || ArrayBuffer.isView(value))) {
    return new Response(value as BodyInit, {
      headers: { 'Content-Type': 'application/octet-stream', 'Tauri-Response': 'ok' },
    });
  }
  const body = value instanceof Error ? value.message : value;
  return new Response(JSON.stringify(body ?? null), {
    headers: { 'Content-Type': 'application/json', 'Tauri-Response': ok ? 'ok' : 'error' },
  });
}

export function routeIpcFetch(route: IpcRoute) {
  const real = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const cmd = commandOf(input);
    if (!cmd) return real(input, init);
    const headers = new Headers(init?.headers);
    const options = { headers: Object.fromEntries(headers.entries()) };
    try {
      const handled = await route(cmd, argsOf(init?.body, headers), options);
      return handled ? reply(true, handled.answer) : real(input, init);
    } catch (error) {
      return reply(false, error);
    }
  };
}
