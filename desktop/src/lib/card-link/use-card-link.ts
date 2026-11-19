import { useCallback, useEffect, useRef, useState } from 'react';
import { refreshBinds } from '../binds';
import { type BindStep, type MethodId, payApi } from '../pay-client';
import { trialOutcome } from '../star-trial';
import { follow, type Phase } from './follow';
import { cardNative, onCardPhase } from './native';
import { type FailReason, verdictFailure } from './reasons';
import { begin, fail, type Link, type Stage } from './session';
import { type CardFields, digitsOf, EMPTY_CARD } from './validate';

export type { FailReason } from './reasons';
export type { Stage } from './session';

export type Retry = 'same' | 'edit' | 'fresh';

export function useCardLink(method: MethodId, trial = false) {
  const [stage, setStage] = useState<Stage>({ kind: 'starting' });
  const [held, setHeld] = useState<string | null>(null);
  const session = useRef<number | null>(null);
  const finished = useRef(false);
  const stop = useRef<(() => void) | null>(null);
  const card = useRef<CardFields | null>(null);
  const resend = useRef(false);
  const link = useRef<Link>({ setStage, session, finished }).current;

  const hold = useCallback((next: CardFields | null) => {
    card.current = next;
    setHeld(next ? digitsOf(next.number).slice(-4) : null);
  }, []);

  const submit = useCallback(
    async (fields: CardFields) => {
      const id = session.current;
      if (id === null) return;
      hold(fields);
      const alive = () => session.current === id;
      setStage({ kind: 'working', phase: 'sending', via3ds: false });
      const toPhase = (phase: Phase) =>
        setStage((now) =>
          now.kind === 'working'
            ? { kind: 'working', phase, via3ds: now.via3ds || phase === 'confirm' }
            : now,
        );
      const unlisten = await onCardPhase(toPhase);
      try {
        const outcome = await cardNative.submit(fields);
        if (!alive()) return;
        if (outcome.state === 'invalid') {
          return setStage({ kind: 'form', invalid: [outcome.field], card: fields });
        }
        if (outcome.state === 'failed') {
          return fail(id, verdictFailure(outcome.reason), link);
        }
        let result: BindStep | FailReason;
        if (outcome.state === 'token') {
          let first: BindStep;
          try {
            first = await payApi.bindToken(id, outcome.token);
          } catch {
            return fail(id, 'network', link);
          }
          result = await follow(id, first, null, alive, toPhase);
        } else {
          const page = outcome.state === 'page' ? outcome.page_url : null;
          result = await follow(id, null, page, alive, toPhase);
        }
        if (!alive()) return;
        if (typeof result === 'string') return fail(id, result, link);
        finished.current = true;
        session.current = null;
        hold(null);
        void cardNative.close().catch(() => {});
        refreshBinds();
        setStage({ kind: 'linked', trial: trialOutcome(result) });
      } catch {
        if (!alive()) return;
        fail(id, 'network', link);
      } finally {
        unlisten();
      }
    },
    [hold, link],
  );

  const restart = useCallback(() => {
    stop.current?.();
    stop.current = begin(method, trial, link, () => {
      const again = resend.current ? card.current : null;
      resend.current = false;
      if (again) return void submit(again);
      setStage({ kind: 'form', invalid: [], card: card.current ?? EMPTY_CARD });
    });
  }, [method, trial, link, submit]);

  useEffect(() => {
    restart();
    return () => {
      stop.current?.();
      card.current = null;
    };
  }, [restart]);

  const retry = useCallback(
    (how: Retry) => {
      if (how === 'fresh') hold(null);
      resend.current = how === 'same' && card.current !== null;
      restart();
    },
    [hold, restart],
  );

  return { stage, held, submit, retry };
}
