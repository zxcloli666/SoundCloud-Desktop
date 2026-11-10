import { type KeyboardEvent, memo, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil } from '../../../lib/icons';
import { renameRoom } from '../../../lib/together/room-actions';
import { cleanTitle, memberName, roomTitle, TITLE_MAX } from '../../../lib/together/room-rules';
import type { RoomView } from '../../../lib/together/types';

const TITLE_CLASS = 'truncate text-[15px] font-bold leading-tight tracking-tight';
const PENDING_MS = 5_000;

function TitleEditor({
  initial,
  onClose,
}: {
  initial: string;
  onClose: (saved: string | null) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(initial);
  const closed = useRef(false);

  const close = (keep: boolean) => {
    if (closed.current) return;
    closed.current = true;
    const next = cleanTitle(draft);
    onClose(keep && next !== cleanTitle(initial) ? next : null);
  };

  const keys = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' && event.key !== 'Escape') return;
    event.stopPropagation();
    close(event.key === 'Enter');
  };

  return (
    <input
      autoFocus
      value={draft}
      maxLength={TITLE_MAX * 2}
      placeholder={t('chat.room.titlePlaceholder')}
      aria-label={t('chat.room.rename')}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={keys}
      onBlur={() => close(true)}
      onFocus={(event) => event.target.select()}
      className={`${TITLE_CLASS} -mx-1.5 w-full min-w-0 rounded-lg bg-ink/[0.08] px-1.5 py-0.5 text-ink outline-none ring-1 ring-[var(--color-accent)] placeholder:text-ink-30`}
    />
  );
}

export const RoomTitle = memo(function RoomTitle({
  room,
  editable,
}: {
  room: RoomView;
  editable: boolean;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const title = roomTitle(room);

  useEffect(() => {
    if (pending === null) return;
    if ((title ?? '') === pending) {
      setPending(null);
      return;
    }
    const timer = setTimeout(() => setPending(null), PENDING_MS);
    return () => clearTimeout(timer);
  }, [title, pending]);

  const save = (next: string | null) => {
    setEditing(false);
    if (next === null) return;
    setPending(next);
    void renameRoom(next).then((ok) => ok || setPending(null));
  };

  const current = pending === null ? title : pending || null;
  const shown = current ?? t('chat.room.untitled', { name: memberName(room, room.hostId) ?? '' });

  if (editing) return <TitleEditor initial={current ?? ''} onClose={save} />;
  if (!editable) {
    return <p className={`${TITLE_CLASS} min-w-0 text-ink-92`}>{shown}</p>;
  }
  return (
    <button
      type="button"
      title={t('chat.room.rename')}
      onClick={() => setEditing(true)}
      className="group -mx-1.5 flex min-w-0 max-w-full cursor-text items-center gap-1.5 rounded-lg px-1.5 py-0.5 text-left transition-colors hover:bg-ink/[0.06]"
    >
      <span className={`${TITLE_CLASS} ${current ? 'text-ink-92' : 'text-ink-55'}`}>{shown}</span>
      <Pencil
        size={12}
        className="shrink-0 text-ink-30 transition-colors group-hover:text-ink-70"
      />
    </button>
  );
});
