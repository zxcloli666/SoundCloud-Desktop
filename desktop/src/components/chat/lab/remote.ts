import { type LabParams, paramsUrl } from './params';

const FILE = '/chat-lab-remote.json';
const POLL_MS = 700;

type Remote = { seq: number } & Partial<Record<keyof LabParams, string | null>>;

async function read(): Promise<Remote | null> {
  try {
    const res = await fetch(`${FILE}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) return null;
    return (await res.json()) as Remote;
  } catch {
    return null;
  }
}

export function watchRemote() {
  let seen: number | null = null;
  const tick = async () => {
    const remote = await read();
    if (remote) {
      if (seen !== null && remote.seq !== seen) {
        const { seq: _seq, ...rest } = remote;
        window.location.replace(paramsUrl(rest as Partial<LabParams>));
        return;
      }
      seen = remote.seq;
    }
    setTimeout(tick, POLL_MS);
  };
  void tick();
}
