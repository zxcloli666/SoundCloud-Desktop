import { useEffect } from 'react';
import type { Stage } from '../../../lib/boosty-card/use-card-link';
import type { SbpStage } from '../../../lib/boosty-sbp';
import type { TrialOutcome } from '../../../lib/star-trial';

const LINKED_HOLD_MS = 1200;

export type OnLinked = (trial: TrialOutcome | null) => void;

export function useLinkEnd(stage: Stage | SbpStage, onLinked: OnLinked) {
  useEffect(() => {
    if (stage.kind === 'refused') {
      onLinked({ kind: 'refused', refusal: stage.refusal });
      return;
    }
    if (stage.kind !== 'linked') return;
    const timer = setTimeout(() => onLinked(stage.trial), LINKED_HOLD_MS);
    return () => clearTimeout(timer);
  }, [stage, onLinked]);
}
