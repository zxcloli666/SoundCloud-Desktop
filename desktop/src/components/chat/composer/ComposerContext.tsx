import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Reply } from '../../../lib/chat/icons';
import { messageSnippet, senderColor } from '../../../lib/chat/render';
import type { Message } from '../../../lib/chat/types';
import { Pencil, X } from '../../../lib/icons';
import { useThread } from '../thread/context';

export const ComposerContext = memo(function ComposerContext({
  mode,
  message,
  onCancel,
}: {
  mode: 'reply' | 'edit';
  message: Message;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const { nameOf, jumpTo } = useThread();
  const color = mode === 'edit' ? 'var(--color-accent-hover)' : senderColor(message.sender);
  const Icon = mode === 'edit' ? Pencil : Reply;

  return (
    <div
      className="chat-thread-motion mx-1 mb-1.5 flex items-center gap-2.5 rounded-2xl bg-ink/[0.04] py-1.5 pr-1.5 pl-3"
      style={{ animation: 'chat-thread-rise 140ms ease-out' }}
    >
      <Icon size={15} className="shrink-0" style={{ color }} />
      <button
        type="button"
        onClick={() => message.seq !== null && jumpTo(message.seq)}
        className="min-w-0 flex-1 cursor-pointer border-l-2 pl-2.5 text-left"
        style={{ borderColor: color }}
      >
        <span className="block truncate text-[11.5px] font-semibold" style={{ color }}>
          {mode === 'edit' ? t('chat.thread.composer.editing') : nameOf(message.sender)}
        </span>
        <span className="block truncate text-[12px] text-ink-55">{messageSnippet(message, t)}</span>
      </button>
      <button
        type="button"
        aria-label={t('chat.thread.composer.cancel')}
        onClick={onCancel}
        className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-45 transition-colors duration-150 hover:bg-ink/[0.08] hover:text-ink"
      >
        <X size={15} />
      </button>
    </div>
  );
});
