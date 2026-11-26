import { refreshBinds } from '../binds';
import { type MethodId, PayError, payApi, payErrorCode, type TrialRefusal } from '../pay-client';
import { trialStart } from '../star-offer';
import { isGranted, type TrialOutcome, trialRefusal } from '../star-trial';
import type { Phase } from './follow';
import { cardNative, nativeCode } from './native';
import { type FailReason, startRefusal } from './reasons';
import type { CardFields, FieldName } from './validate';

export type Stage =
  | { kind: 'starting' }
  | { kind: 'form'; invalid: FieldName[]; card: CardFields }
  | { kind: 'working'; phase: Phase; via3ds: boolean }
  | { kind: 'linked'; trial: TrialOutcome | null }
  | { kind: 'refused'; refusal: TrialRefusal }
  | { kind: 'failed'; reason: FailReason };

export interface Link {
  setStage: (stage: Stage) => void;
  session: { current: number | null };
  finished: { current: boolean };
}

function startFailure(error: unknown): FailReason {
  if (error instanceof PayError) return startRefusal(error.status, payErrorCode(error));
  const code = nativeCode(error);
  if (code === 'unsupported' || code === 'no_runner') return 'unavailable';
  return code === 'native' ? 'network' : 'bundle';
}

export function begin(method: MethodId, trial: boolean, link: Link, ready: () => void): () => void {
  const { setStage, session, finished } = link;
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
      ready();
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

export function fail(id: number, reason: FailReason, link: Link, cause: string = reason) {
  link.finished.current = true;
  link.setStage({ kind: 'failed', reason });
  leave(id, true, cause);
}

function leave(id: number | null, opened: boolean, cause?: string) {
  void cardNative.abort().catch(() => {});
  if (opened) void cardNative.close().catch(() => {});
  if (id !== null) void payApi.bindCancel(id, cause).catch(() => {});
}
