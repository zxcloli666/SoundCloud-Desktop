import { useCallback, useEffect, useRef, useState } from 'react';
import { refreshBinds } from './boosty-binds';
import {
  type BoostyQr,
  type BoostyStep,
  PayError,
  payApi,
  payErrorCode,
  type TrialRefusal,
} from './pay-client';
import { trialStart } from './star-offer';
import { isGranted, type TrialOutcome, trialOutcome, trialRefusal } from './star-trial';

const POLL_MS = 3_000;
const ERRORS_IN_A_ROW = 5;

export type SbpFail = 'exists' | 'qr' | 'ambiguous' | 'other' | 'limit' | 'unavailable' | 'network';

const FAIL_OF_REASON: Record<string, SbpFail> = {
  already_exists: 'exists',
  no_qr: 'qr',
  channel: 'qr',
  ambiguous: 'ambiguous',
};

export type SbpStage =
  | { kind: 'starting' }
  | { kind: 'waiting'; qr: BoostyQr | null; expiresAt: number }
  | { kind: 'linked'; trial: TrialOutcome | null }
  | { kind: 'refused'; refusal: TrialRefusal }
  | { kind: 'expired' }
  | { kind: 'failed'; reason: SbpFail };

type SetStage = (next: SbpStage | ((now: SbpStage) => SbpStage)) => void;

function startFailure(error: unknown): SbpFail {
  if (!(error instanceof PayError)) return 'network';
  if (error.status === 429) return 'limit';
  return error.status === 503 || error.status === 501 ? 'unavailable' : 'network';
}

function settled(step: BoostyStep): SbpStage | null {
  if (step.status === 'bound') return { kind: 'linked', trial: trialOutcome(step) };
  if (step.status === 'expired') return { kind: 'expired' };
  if (step.status === 'failed') {
    return { kind: 'failed', reason: FAIL_OF_REASON[step.reason ?? ''] ?? 'other' };
  }
  return null;
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function watch(
  id: number,
  alive: () => boolean,
  setStage: SetStage,
): Promise<SbpStage | null> {
  let errors = 0;
  while (alive()) {
    await pause(POLL_MS);
    if (!alive()) break;
    try {
      const step = await payApi.boostyStep(id);
      errors = 0;
      const end = settled(step);
      if (end) return end;
      const qr = step.qr;
      if (qr) setStage((now) => (now.kind === 'waiting' && !now.qr ? { ...now, qr } : now));
    } catch {
      errors += 1;
      if (errors >= ERRORS_IN_A_ROW) return { kind: 'failed', reason: 'network' };
    }
  }
  return null;
}

function begin(setStage: SetStage, trial: boolean, before?: () => Promise<unknown>): () => void {
  let live = true;
  let id: number | null = null;
  let linked = false;
  const alive = () => live;
  setStage({ kind: 'starting' });
  (before ? before() : Promise.resolve())
    .then(() => (trial ? trialStart() : undefined))
    .then((purpose) => payApi.boostyStartSbp(purpose))
    .then(async (started) => {
      if (isGranted(started)) {
        if (!live) return;
        linked = true;
        refreshBinds();
        return setStage({ kind: 'linked', trial: { kind: 'granted', grant: started.trial } });
      }
      id = started.session_id;
      if (!live) return cancel(id);
      setStage({ kind: 'waiting', qr: started.qr ?? null, expiresAt: started.expires_at });
      const end = await watch(started.session_id, alive, setStage);
      if (!live || !end) return;
      linked = end.kind === 'linked';
      if (linked) refreshBinds();
      setStage(end);
    })
    .catch((error) => {
      if (!live) return;
      const refusal = trialRefusal(payErrorCode(error));
      setStage(
        refusal ? { kind: 'refused', refusal } : { kind: 'failed', reason: startFailure(error) },
      );
    });
  return () => {
    live = false;
    if (id !== null && !linked) cancel(id);
  };
}

function cancel(id: number) {
  void payApi.boostyCancel(id).catch(() => {});
}

export function useSbpLink(trial = false) {
  const [stage, setStage] = useState<SbpStage>({ kind: 'starting' });
  const stop = useRef<(() => void) | null>(null);

  useEffect(() => {
    stop.current = begin(setStage, trial);
    return () => stop.current?.();
  }, [trial]);

  const restart = useCallback(() => {
    stop.current?.();
    stop.current = begin(setStage, trial);
  }, [trial]);

  const relink = useCallback(() => {
    stop.current?.();
    stop.current = begin(setStage, trial, async () => {
      await payApi.boostyRemove('sbp');
      refreshBinds();
    });
  }, [trial]);

  return { stage, restart, relink };
}
