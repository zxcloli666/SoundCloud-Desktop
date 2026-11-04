import { inAppWindow } from './ipc';
import { type LabParams, paramsUrl, readParams } from './params';

const FILE = '/chat-lab-remote.json';
const POLL_MS = 700;

type Remote = { seq: number } & Partial<Record<Exclude<keyof LabParams, 'seq'>, string | null>>;

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
  let seen: number | null = Number(readParams().seq) || null;
  const follow = inAppWindow();
  const tick = async () => {
    const remote = await read();
    if (remote) {
      if ((seen !== null || follow) && remote.seq !== seen) {
        const { seq, ...rest } = remote;
        window.location.replace(paramsUrl({ ...rest, seq: String(seq) } as Partial<LabParams>));
        return;
      }
      seen = remote.seq;
    }
    setTimeout(tick, POLL_MS);
  };
  void tick();
}
