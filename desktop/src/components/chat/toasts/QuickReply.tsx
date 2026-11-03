import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { chatBridge } from '../../../lib/chat/bridge';
import { Send } from '../../../lib/chat/icons';
import type { ConvId } from '../../../lib/chat/types';
import { roomLinkBlock } from '../../../lib/together/room-chat';
import { linkBlockKey } from '../../../lib/together/room-rules';
import { listErrorKey } from '../shell/errors';

const TEXT_MAX = 4096;

interface QuickReplyProps {
  conversationId: ConvId;
  onSent: () => void;
  onCancel: () => void;
}

export const QuickReply = memo(function QuickReply({
  conversationId,
  onSent,
  onCancel,
}: QuickReplyProps) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    const body = text.trim();
    if (!body || busy) return;
    const block = roomLinkBlock(conversationId, body);
    if (block) {
      setError(t(linkBlockKey(block)));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await chatBridge.send({
        conversationId,
        clientId: null,
        text: { text: body, spans: [] },
        replyTo: null,
        embeds: [],
        forward: null,
      });
      onSent();
    } catch (failure) {
      setError(t(listErrorKey(failure)));
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 rounded-xl border border-ink/[0.08] bg-black/25 pr-1 pl-3 focus-within:border-ink/[0.18]">
        <input
          autoFocus
          value={text}
          maxLength={TEXT_MAX}
          disabled={busy}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
            if (event.key === 'Escape') onCancel();
          }}
          placeholder={t('chat.notify.replyPlaceholder')}
          className="h-9 min-w-0 flex-1 bg-transparent text-[13px] text-ink-90 outline-none placeholder:text-ink-30"
        />
        <button
          type="button"
          disabled={!text.trim() || busy}
          onClick={() => void send()}
          aria-label={t('chat.notify.send')}
          className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[var(--color-accent-contrast)] transition-opacity disabled:cursor-default disabled:opacity-35"
          style={{ background: 'var(--color-accent)' }}
        >
          <Send size={13} />
        </button>
      </div>
      {error && <p className="px-1 text-[11.5px] text-rose-300/90">{error}</p>}
    </div>
  );
});
