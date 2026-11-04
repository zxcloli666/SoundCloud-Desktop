import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pin } from '../../../lib/chat/icons';
import { messageSnippet } from '../../../lib/chat/render';
import { ink } from '../../../lib/chat/tone';
import type { Seq } from '../../../lib/chat/types';
import { X } from '../../../lib/icons';
import { useChatThreadStore } from '../../../stores/chat/thread';
import { findBySeq } from '../../../stores/chat/thread-messages';
import { useThread } from './context';
import { toastError } from './errors';
import { canPin } from './permissions';

const NO_PINS: Seq[] = [];
const SEGMENTS_MAX = 4;

export const PinnedBar = memo(function PinnedBar() {
  const { t, i18n } = useTranslation();
  const { conversation, moderator, jumpTo } = useThread();
  const pins = useChatThreadStore((state) => state.threads[conversation.id]?.pins ?? NO_PINS);
  const [index, setIndex] = useState(pins.length - 1);

  useEffect(() => setIndex(pins.length - 1), [pins.length]);

  const at = Math.min(Math.max(index, 0), pins.length - 1);
  const seq = pins[at];
  const message = useChatThreadStore((state) =>
    seq === undefined ? null : findBySeq(state.threads[conversation.id]?.messages ?? [], seq),
  );
  if (seq === undefined) return null;

  const open = () => {
    jumpTo(seq);
    setIndex(at === 0 ? pins.length - 1 : at - 1);
  };
  const unpin = () => {
    if (!message) return;
    void useChatThreadStore
      .getState()
      .pin(message, false)
      .catch((error) => toastError(error, t, i18n.language));
  };
  const segments = Math.min(pins.length, SEGMENTS_MAX);
  const active = Math.max(0, segments - 1 - (pins.length - 1 - at));

  return (
    <div className="relative z-10 flex h-11 shrink-0 items-center gap-2.5 border-b border-ink/[0.05] bg-ink/[0.02] pr-1.5 pl-3">
      {segments > 1 && (
        <span aria-hidden className="flex h-7 w-[3px] shrink-0 flex-col gap-[2px]">
          {Array.from({ length: segments }, (_, i) => (
            <i
              key={i}
              className="block flex-1 rounded-full"
              style={{
                background: i === active ? 'var(--color-accent)' : ink(16),
              }}
            />
          ))}
        </span>
      )}
      <Pin size={14} className="shrink-0" style={{ color: 'var(--color-accent-hover)' }} />
      <button type="button" onClick={open} className="min-w-0 flex-1 cursor-pointer text-left">
        <span
          className="block text-[11px] font-semibold"
          style={{ color: 'var(--color-accent-hover)' }}
        >
          {pins.length > 1
            ? t('chat.thread.pinned.many', { index: at + 1, total: pins.length })
            : t('chat.thread.pinned.one')}
        </span>
        <span className="block truncate text-[12.5px] text-ink-65">
          {message ? messageSnippet(message, t) : t('chat.thread.pinned.unloaded')}
        </span>
      </button>
      {message && canPin(conversation, moderator) && (
        <button
          type="button"
          aria-label={t('chat.thread.actions.unpin')}
          onClick={unpin}
          className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-40 transition-colors duration-150 hover:bg-ink/[0.08] hover:text-ink"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
});
