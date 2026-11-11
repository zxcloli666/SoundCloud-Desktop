import type { CallResult, ChatBody, ChatEvent, ChatRequest, Ran, ToolMark, TurnEnd } from './types';

export const MAX_ROUNDS = 3;
const LAST_EVENT_GRACE_MS = 300;

export interface TurnInput {
  id: string;
  speak: boolean;
  rounds: number;
  signal: AbortSignal;
  body(results: CallResult[]): ChatBody;
  send(request: ChatRequest, onEvent: (event: ChatEvent) => void): Promise<void>;
  act(name: string, args: unknown): Promise<Ran>;
  onSay(delta: string): void;
  onMark(mark: ToolMark): void;
}

type RoundEnd = { kind: 'done' } | { kind: 'cancelled' } | { kind: 'error'; code: string };

interface Round {
  end: RoundEnd | null;
  ran: Ran[];
  acting: Promise<void>;
}

export function failureCode(err: unknown): string {
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === 'string' && code ? code : 'failed';
}

function aborted(signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) =>
    signal.addEventListener('abort', () => resolve(), { once: true }),
  );
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function playRound(
  t: TurnInput,
  results: CallResult[],
  hear: (delta: string) => void,
): Promise<Round> {
  const round: Round = { end: null, ran: [], acting: Promise.resolve() };
  let settle = () => {};
  const ended = new Promise<void>((resolve) => {
    settle = resolve;
  });
  const finish = (end: RoundEnd) => {
    round.end ??= end;
    settle();
  };
  const cancelled = () => round.end?.kind === 'cancelled';
  const act = async (name: string, args: unknown) => {
    if (cancelled()) return;
    const ran = await t.act(name, args);
    if (cancelled()) return;
    round.ran.push(ran);
    t.onMark(ran.mark);
  };
  const onEvent = (event: ChatEvent) => {
    if (round.end) return;
    if (event.kind === 'say') hear(event.text);
    else if (event.kind === 'action')
      round.acting = round.acting.then(() => act(event.name, event.args));
    else finish(event);
  };
  const closed = t.send({ id: t.id, speak: t.speak, body: t.body([...results]) }, onEvent).then(
    () => (round.end ? undefined : Promise.race([ended, pause(LAST_EVENT_GRACE_MS)])),
    (err) => finish({ kind: 'error', code: failureCode(err) }),
  );
  const stream = closed.then(() => finish({ kind: 'error', code: 'failed' }));
  await Promise.race([stream, aborted(t.signal)]);
  if (t.signal.aborted) finish({ kind: 'cancelled' });
  if (!cancelled()) await round.acting;
  return round;
}

export async function runTurn(t: TurnInput): Promise<TurnEnd> {
  const marks: ToolMark[] = [];
  const results: CallResult[] = [];
  let say = '';
  let gap = false;
  const hear = (delta: string) => {
    const piece = gap && say && !/\s$/.test(say) ? ` ${delta}` : delta;
    gap = false;
    say += piece;
    t.onSay(piece);
  };

  for (let n = 1; ; n++) {
    const round = await playRound(t, results, hear);
    marks.push(...round.ran.map((r) => r.mark));
    if (round.end?.kind === 'cancelled') return { status: 'cancelled', say, marks };
    if (round.end?.kind === 'error') return { status: 'failed', code: round.end.code, say, marks };
    results.push(...round.ran.map(({ name, args, result }) => ({ name, args, result })));
    if (n >= t.rounds || !round.ran.some((r) => r.returns)) return { status: 'ok', say, marks };
    gap = true;
  }
}
