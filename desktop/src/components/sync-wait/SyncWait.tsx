import { memo } from 'react';
import { Loader2 } from '../../lib/icons';
import { usePremium } from '../../lib/premium-cache';
import type { WaitKind } from '../../lib/sync-wait';
import { PriorityLane } from './PriorityLane';
import { SHAPE_OF, type WaitScope } from './scope';
import { useLongWait } from './useLongWait';
import { WaitCard } from './WaitCard';
import { WaitSkeleton } from './WaitSkeleton';

export const SyncWait = memo(function SyncWait({
  kind,
  scope,
  since,
  note,
}: {
  kind: WaitKind;
  scope: WaitScope;
  since: number;
  note: string;
}) {
  const premium = usePremium();
  const { long, from } = useLongWait(kind, since);
  const shape = SHAPE_OF[scope];

  if (!long) {
    return (
      <div
        data-ui="sync-wait"
        data-stage="calm"
        data-kind={kind}
        className="flex flex-col items-center gap-8"
      >
        <WaitLine note={note} />
        <WaitSkeleton shape={shape} />
      </div>
    );
  }

  if (premium) {
    return (
      <div
        data-ui="sync-wait"
        data-stage="priority"
        data-kind={kind}
        className="flex flex-col items-center gap-4"
      >
        <WaitLine note={note} />
        <PriorityLane shape={shape} />
      </div>
    );
  }

  return <WaitCard kind={kind} scope={scope} since={from} note={note} />;
});

function WaitLine({ note }: { note: string }) {
  return (
    <div className="flex items-center justify-center gap-2 text-[13px] text-ink-30">
      <Loader2 size={14} className="animate-spin" />
      {note}
    </div>
  );
}
