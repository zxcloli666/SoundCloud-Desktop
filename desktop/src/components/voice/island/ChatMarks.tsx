import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useChatLive } from '../../../lib/voice/chat/live';
import type { ToolMark } from '../../../lib/voice/chat/types';
import { Undo2 } from '../icons';
import { markIcon } from '../intentIcon';
import { markLabel } from '../markLabel';
import { useUndoable } from './useUndoable';

const LABELLED = 2;

export function MarkChip({ mark, labelled }: { mark: ToolMark; labelled: boolean }) {
  const { t } = useTranslation();
  const label = markLabel(mark, t);
  return (
    <span
      title={label}
      role="img"
      aria-label={label}
      data-ok={mark.ok}
      className={`inline-flex h-[22px] min-w-[22px] items-center justify-center gap-1 rounded-full px-1.5 text-[10.5px] font-semibold motion-reduce:animate-none ${
        mark.ok ? 'bg-accent/[0.14] text-accent' : 'bg-bad/10 text-bad'
      }`}
      style={{ animation: 'vx-pop 360ms var(--ease-apple) both' }}
    >
      {markIcon(mark, 12)}
      {labelled && mark.text && <span className="max-w-[150px] truncate">{mark.text}</span>}
    </span>
  );
}

function UndoMark({ onUndo }: { onUndo: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onUndo}
      className="inline-flex h-[22px] cursor-pointer items-center gap-1 rounded-full border border-ink/[0.1] bg-ink/[0.06] px-2 text-[10.5px] font-semibold text-ink-75 transition-colors duration-200 hover:bg-ink/[0.11] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
    >
      <Undo2 size={10} />
      {t('voice.hud.undo')}
    </button>
  );
}

export const ChatMarks = memo(function ChatMarks({
  undo,
  onUndo,
}: {
  undo: string | null;
  onUndo: () => void;
}) {
  const marks = useChatLive((s) => s.marks);
  const undoable = useUndoable(undo ?? '', undo !== null);
  if (marks.length === 0) return null;
  return (
    <span data-ui="voice-marks" className="mt-1.5 flex flex-wrap items-center gap-1">
      {marks.map((mark, i) => (
        <MarkChip key={i} mark={mark} labelled={marks.length <= LABELLED} />
      ))}
      {undoable && <UndoMark onUndo={onUndo} />}
    </span>
  );
});
