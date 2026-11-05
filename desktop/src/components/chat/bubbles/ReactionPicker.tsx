import * as Popover from '@radix-ui/react-popover';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { surface } from '../../../lib/chat/tone';
import type { ConvId, Message } from '../../../lib/chat/types';
import { usePerfMode } from '../../../lib/perf';
import { useChatThreadStore } from '../../../stores/chat/thread';
import { emojiKeys, firstEmoji } from '../composer/emoji-keys';
import { useThreadDialogs } from '../thread/dialogs';
import { toastError } from '../thread/errors';

const PALETTE = ['❤️', '🔥', '😂', '👍', '😮', '😢', '🎧'];

function latest(message: Message): Message {
  const thread = useChatThreadStore.getState().threads[message.conversationId];
  return thread?.messages.find((item) => item.clientId === message.clientId) ?? message;
}

export const ReactionPicker = memo(function ReactionPicker({
  conversationId,
}: {
  conversationId: ConvId;
}) {
  const { t, i18n } = useTranslation();
  const blur = usePerfMode().blur(24);
  const picker = useThreadDialogs((state) =>
    state.picker?.message.conversationId === conversationId ? state.picker : null,
  );
  const close = useThreadDialogs((state) => state.closePicker);
  const x = picker?.x ?? 0;
  const y = picker?.y ?? 0;
  const anchor = useMemo(
    () => ({
      current: { getBoundingClientRect: () => DOMRect.fromRect({ x, y, width: 0, height: 0 }) },
    }),
    [x, y],
  );

  const pick = (emoji: string) => {
    if (!picker) return;
    const message = latest(picker.message);
    close();
    void useChatThreadStore
      .getState()
      .react(message, emoji)
      .catch((error) => toastError(error, t, i18n.language));
  };

  return (
    <Popover.Root open={picker !== null} onOpenChange={(open) => !open && close()}>
      <Popover.Anchor virtualRef={anchor} />
      <Popover.Portal>
        {picker && (
          <Popover.Content
            side="bottom"
            align="start"
            sideOffset={6}
            collisionPadding={10}
            onCloseAutoFocus={(event) => event.preventDefault()}
            className="z-[300] flex items-center gap-0.5 rounded-full border border-ink/[0.09] p-1 outline-none"
            style={{
              background: blur > 0 ? surface(8, 88) : surface(9),
              backdropFilter: blur > 0 ? `blur(${blur}px) saturate(1.6)` : undefined,
              WebkitBackdropFilter: blur > 0 ? `blur(${blur}px) saturate(1.6)` : undefined,
              boxShadow: '0 14px 40px rgba(0,0,0,0.5)',
            }}
          >
            {PALETTE.map((emoji) => {
              const mine = picker.message.reactions.some(
                (group) => group.emoji === emoji && group.mine,
              );
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => pick(emoji)}
                  className={`flex size-8 cursor-pointer items-center justify-center rounded-full text-[18px] leading-none transition-transform duration-150 hover:scale-110 hover:bg-ink/[0.08] ${
                    mine ? 'bg-ink/[0.1]' : ''
                  }`}
                >
                  {emoji}
                </button>
              );
            })}
            <input
              aria-label={t('chat.thread.actions.otherEmoji')}
              title={t('chat.thread.composer.emojiHint', { keys: emojiKeys().join(' ') })}
              placeholder="+"
              onInput={(event) => {
                const emoji = firstEmoji(event.currentTarget.value);
                event.currentTarget.value = '';
                if (emoji) pick(emoji);
              }}
              className="size-8 rounded-full bg-ink/[0.06] text-center text-[16px] text-ink-70 outline-none placeholder:text-ink-45 focus:bg-ink/[0.1]"
            />
          </Popover.Content>
        )}
      </Popover.Portal>
    </Popover.Root>
  );
});
