import { useCallback, useEffect, useRef, useState } from 'react';
import { refreshBinds } from '../boosty-binds';
import {
  type BoostyCardMethod,
  type BoostyStep,
  PayError,
  payApi,
  payErrorCode,
  type TrialRefusal,
} from '../pay-client';
import { trialStart } from '../star-offer';
import { isGranted, type TrialOutcome, trialOutcome, trialRefusal } from '../star-trial';
import { type CardPhase, cardNative, nativeCode, onCardPhase } from './native';
import { type FailReason, stepEnd, verdictFailure } from './reasons';
import { linkByToken } from './token-link';
import type { CardFields, FieldName } from './validate';

const LINK_POLL_MS = 2_000;
const LINK_WAIT_MS = 60_000;

export type { FailReason } from './reasons';

export type Stage =
  | { kind: 'starting' }
  | { kind: 'form'; invalid: FieldName[] }
  | { kind: 'working'; phase: CardPhase | 'linking'; via3ds: boolean }
  | { kind: 'linked'; trial: TrialOutcome | null }
  | { kind: 'refused'; refusal: TrialRefusal }
  | { kind: 'failed'; reason: FailReason };

const FIELD_OF_CODE: Record<string, FieldName> = {
  invalid_number: 'number',
  invalid_expiry: 'expiry',
  invalid_cvv: 'cvv',
};

function startFailure(error: unknown): FailReason {
  if (error instanceof PayError) {
    if (error.status === 429) return 'busy';
    return error.status === 503 || error.status === 501 ? 'unavailable' : 'network';
  }
  const code = nativeCode(error);
  if (code === 'unsupported') return 'unavailable';
  return code === 'native' ? 'network' : 'bundle';
}

async function waitBound(id: number, alive: () => boolean): Promise<BoostyStep | FailReason> {
  const until = Date.now() + LINK_WAIT_MS;
  while (alive() && Date.now() < until) {
    try {
      const step = await payApi.boostyStep(id);
      const end = stepEnd(step);
      if (end === 'bound') return step;
      if (end) return end;
    } catch (error) {
      if (error instanceof PayError && error.status === 409) return 'busy';
    }
    await new Promise((resolve) => setTimeout(resolve, LINK_POLL_MS));
  }
  return 'timeout';
}

function begin(
  method: BoostyCardMethod,
  trial: boolean,
  setStage: (stage: Stage) => void,
  session: { current: number | null },
  finished: { current: boolean },
): () => void {
  let live = true;
  let id: number | null = null;
  let opened = false;
  finished.current = false;
  setStage({ kind: 'starting' });
  (trial ? trialStart() : Promise.resolve(undefined))
    .then((purpose) => payApi.boostyStartCard(method, purpose))
    .then(async (start) => {
      if (isGranted(start)) {
        if (!live) return;
        finished.current = true;
        refreshBinds();
        return setStage({ kind: 'linked', trial: { kind: 'granted', grant: start.trial } });
      }
      id = start.session_id;
      if (!live) return leave(id, false);
      await cardNative.open(start);
      opened = true;
      if (!live) return;
      session.current = start.session_id;
      setStage({ kind: 'form', invalid: [] });
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
    if (!finished.current) leave(id, opened);
    session.current = null;
  };
}

export function useCardLink(method: BoostyCardMethod, trial = false) {
  const [stage, setStage] = useState<Stage>({ kind: 'starting' });
  const session = useRef<number | null>(null);
  const finished = useRef(false);
  const stop = useRef<(() => void) | null>(null);

  useEffect(() => {
    stop.current = begin(method, trial, setStage, session, finished);
    return () => stop.current?.();
  }, [method, trial]);

  const submit = useCallback(async (card: CardFields) => {
    const id = session.current;
    if (id === null) return;
    const alive = () => session.current === id;
    setStage({ kind: 'working', phase: 'sending', via3ds: false });
    const toPhase = (phase: CardPhase | 'linking') =>
      setStage((now) =>
        now.kind === 'working'
          ? { kind: 'working', phase, via3ds: now.via3ds || phase === 'confirm' }
          : now,
      );
    const stop = await onCardPhase(toPhase);
    try {
      const verdict = await cardNative.submit(card);
      if (!alive()) return;
      if (verdict.state === 'invalid') {
        return setStage({ kind: 'form', invalid: [verdict.field] });
      }
      if (verdict.state === 'failed' || verdict.state === 'timeout') {
        const reason = verdict.state === 'timeout' ? 'timeout' : verdictFailure(verdict.reason);
        return fail(id, reason, setStage, finished);
      }
      let result: BoostyStep | FailReason;
      if (verdict.state === 'tokenized') {
        result = await linkByToken(id, verdict.token, alive, toPhase);
      } else {
        toPhase('linking');
        result = await waitBound(id, alive);
      }
      if (!alive()) return;
      if (typeof result === 'string') return fail(id, result, setStage, finished);
      finished.current = true;
      session.current = null;
      void cardNative.close().catch(() => {});
      refreshBinds();
      setStage({ kind: 'linked', trial: trialOutcome(result) });
    } catch (error) {
      if (!alive()) return;
      const field = FIELD_OF_CODE[nativeCode(error)];
      if (field) return setStage({ kind: 'form', invalid: [field] });
      fail(id, 'network', setStage, finished);
    } finally {
      stop();
    }
  }, []);

  const retry = useCallback(() => {
    stop.current?.();
    stop.current = begin(method, trial, setStage, session, finished);
  }, [method, trial]);
  return { stage, submit, retry };
}

function fail(
  id: number,
  reason: FailReason,
  setStage: (stage: Stage) => void,
  finished: { current: boolean },
) {
  finished.current = true;
  setStage({ kind: 'failed', reason });
  leave(id, true);
}

function leave(id: number | null, opened: boolean) {
  void cardNative.abort().catch(() => {});
  if (opened) void cardNative.close().catch(() => {});
  if (id !== null) void payApi.boostyCancel(id).catch(() => {});
}
