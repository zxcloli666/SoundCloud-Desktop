import { useCallback, useEffect, useRef, useState } from 'react';
import { refreshBinds } from '../binds';
import {
  type BindStep,
  type MethodId,
  PayError,
  payApi,
  payErrorCode,
  type TrialRefusal,
} from '../pay-client';
import { trialStart } from '../star-offer';
import { isGranted, type TrialOutcome, trialOutcome, trialRefusal } from '../star-trial';
import { follow, type Phase } from './follow';
import { cardNative, nativeCode, onCardPhase } from './native';
import { type FailReason, verdictFailure } from './reasons';
import type { CardFields, FieldName } from './validate';

export type { FailReason } from './reasons';

export type Stage =
  | { kind: 'starting' }
  | { kind: 'form'; invalid: FieldName[] }
  | { kind: 'working'; phase: Phase; via3ds: boolean }
  | { kind: 'linked'; trial: TrialOutcome | null }
  | { kind: 'refused'; refusal: TrialRefusal }
  | { kind: 'failed'; reason: FailReason };

function startFailure(error: unknown): FailReason {
  if (error instanceof PayError) {
    if (error.status === 429) return 'busy';
    return error.status === 503 || error.status === 501 ? 'unavailable' : 'network';
  }
  const code = nativeCode(error);
  if (code === 'unsupported' || code === 'no_runner') return 'unavailable';
  return code === 'native' ? 'network' : 'bundle';
}

function begin(
  method: MethodId,
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
    .then((purpose) => payApi.bindStart(method, purpose))
    .then(async (start) => {
      if (isGranted(start)) {
        if (!live) return;
        finished.current = true;
        refreshBinds();
        return setStage({ kind: 'linked', trial: { kind: 'granted', grant: start.trial } });
      }
      id = start.session_id;
      if (!live) return leave(id, false);
      if (!start.runner) throw 'no_runner';
      await cardNative.open(start.runner.bundle, start.runner.params);
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
      if (id === null) return;
      finished.current = true;
      leave(id, opened);
    });
  return () => {
    live = false;
    if (!finished.current) leave(id, opened);
    session.current = null;
  };
}

export function useCardLink(method: MethodId, trial = false) {
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
    const toPhase = (phase: Phase) =>
      setStage((now) =>
        now.kind === 'working'
          ? { kind: 'working', phase, via3ds: now.via3ds || phase === 'confirm' }
          : now,
      );
    const stop = await onCardPhase(toPhase);
    try {
      const outcome = await cardNative.submit(card);
      if (!alive()) return;
      if (outcome.state === 'invalid') {
        return setStage({ kind: 'form', invalid: [outcome.field] });
      }
      if (outcome.state === 'failed') {
        return fail(id, verdictFailure(outcome.reason), setStage, finished);
      }
      let result: BindStep | FailReason;
      if (outcome.state === 'token') {
        let first: BindStep;
        try {
          first = await payApi.bindToken(id, outcome.token);
        } catch {
          return fail(id, 'network', setStage, finished);
        }
        result = await follow(id, first, null, alive, toPhase);
      } else {
        const page = outcome.state === 'page' ? outcome.page_url : null;
        result = await follow(id, null, page, alive, toPhase);
      }
      if (!alive()) return;
      if (typeof result === 'string') return fail(id, result, setStage, finished);
      finished.current = true;
      session.current = null;
      void cardNative.close().catch(() => {});
      refreshBinds();
      setStage({ kind: 'linked', trial: trialOutcome(result) });
    } catch {
      if (!alive()) return;
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
  if (id !== null) void payApi.bindCancel(id).catch(() => {});
}
