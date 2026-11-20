const MAX_TICK_GAP_MS = 1000;
const SEEK_SLACK_SEC = 0.3;

type Entry = { id: Promise<string | null>; ms: number; sent: number };

export function createListenedMeter(send: (id: string, ms: number) => void) {
  let entry: Entry | null = null;
  let carried: { id: string; ms: number } | null = null;
  let lastPos = 0;
  let lastAt = 0;

  function report(from: Entry) {
    const ms = Math.round(from.ms);
    if (ms <= from.sent) return;
    from.sent = ms;
    void from.id.then((id) => {
      if (!id) return;
      carried = { id, ms };
      send(id, ms);
    });
  }

  function begin(id: Promise<string | null>) {
    flush();
    const next: Entry = { id, ms: 0, sent: 0 };
    entry = next;
    void id.then((value) => {
      if (entry === next && value && carried?.id === value) {
        next.ms += carried.ms;
        next.sent = carried.ms;
      }
    });
  }

  function tick(positionSec: number, atMs: number, rate: number, playing: boolean) {
    const gapMs = atMs - lastAt;
    const advance = positionSec - lastPos;
    lastPos = positionSec;
    lastAt = atMs;
    if (!entry || !playing || gapMs <= 0 || gapMs > MAX_TICK_GAP_MS) return;
    if (advance <= 0 || advance > (gapMs / 1000) * Math.max(rate, 1) + SEEK_SLACK_SEC) return;
    entry.ms += gapMs;
  }

  function snapshot() {
    if (entry) report(entry);
  }

  function flush() {
    if (!entry) return;
    const done = entry;
    entry = null;
    report(done);
  }

  return { begin, tick, snapshot, flush };
}
