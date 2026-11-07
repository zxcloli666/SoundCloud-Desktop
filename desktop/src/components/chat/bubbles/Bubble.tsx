import { type CSSProperties, memo, useMemo } from 'react';
import { receivedEmbed } from '../../../lib/chat/embed-snapshot';
import { Lock, Reply } from '../../../lib/chat/icons';
import { senderColor, type Tick } from '../../../lib/chat/render';
import type { Message } from '../../../lib/chat/types';
import { Ban, Sparkles } from '../../../lib/icons';
import { useChatThreadStore } from '../../../stores/chat/thread';
import { CheckedEmbedCard } from '../embeds/EmbedCard';
import { MediaBubble, useHasMedia } from '../media/MediaBubble';
import { openPublicUserMenu } from '../public/user-menu';
import { useThread } from '../thread/context';
import { isPublicStaff } from '../thread/permissions';
import { BubbleMeta } from './BubbleMeta';
import { MessageText } from './MessageText';
import { ReplyQuote } from './ReplyQuote';

const BIG = 18;
const SMALL = 6;
const TAIL = 4;

function corners(mine: boolean, first: boolean, last: boolean): string {
  const top = first ? BIG : SMALL;
  const bottom = last ? TAIL : SMALL;
  return mine ? `${BIG}px ${top}px ${bottom}px ${BIG}px` : `${top}px ${BIG}px ${BIG}px ${bottom}px`;
}

const THEIRS: CSSProperties = {
  background: 'var(--color-bg-glass-hover)',
  border: '1px solid var(--color-border-glass)',
};

const MINE: CSSProperties = {
  background: 'var(--color-chat-tint)',
  border: '1px solid var(--color-chat-tint)',
};

const FAILED: CSSProperties = {
  background: 'color-mix(in srgb, var(--color-rose-500) 8%, transparent)',
  border: '1px solid color-mix(in srgb, var(--color-rose-400) 35%, transparent)',
};

const TOMBSTONE_ICONS = { deleted: Ban, locked: Lock, unknown: Sparkles } as const;

type TombstoneKind = keyof typeof TOMBSTONE_ICONS;

function Tombstone({
  message,
  radius,
  kind = message.body.type as TombstoneKind,
}: {
  message: Message;
  radius: string;
  kind?: TombstoneKind;
}) {
  const { t } = useThread();
  const Icon = TOMBSTONE_ICONS[kind];
  return (
    <div
      data-ui="chat-bubble"
      data-mine={message.mine ? '' : undefined}
      data-kind={kind}
      className="flex items-center gap-1.5 border border-dashed border-ink/[0.09] px-3 py-[7px] text-[12.5px] italic text-ink-40"
      style={{ borderRadius: radius }}
    >
      <Icon size={12} className="shrink-0 not-italic" />
      <span>{t(`chat.thread.bubble.${kind}`)}</span>
      <BubbleMeta message={message} tick={null} floating={false} />
    </div>
  );
}

function Forwarded({ forwarded }: { forwarded: NonNullable<Message['forwardedFrom']> }) {
  const { t } = useThread();
  return (
    <div
      className="mb-0.5 flex min-w-0 items-center gap-1 text-[11px] font-medium"
      style={{ color: senderColor(forwarded.userId) }}
    >
      <Reply size={11} className="shrink-0 -scale-x-100" />
      <span className="truncate">
        {t('chat.thread.bubble.forwarded', { name: forwarded.name })}
      </span>
    </div>
  );
}

export interface BubbleProps {
  message: Message;
  replied: Message | null;
  tick: Tick | null;
  first: boolean;
  last: boolean;
  flash: boolean;
}

export const Bubble = memo(function Bubble({
  message,
  replied,
  tick,
  first,
  last,
  flash,
}: BubbleProps) {
  const { nameOf, conversation, people, me, t } = useThread();
  const media = useHasMedia(message);
  const radius = corners(message.mine, first, last);
  const embeds = useMemo(
    () => message.embeds.flatMap((embed) => receivedEmbed(embed) ?? []),
    [message.embeds],
  );
  const { body } = message;
  if (body.type !== 'text') return <Tombstone message={message} radius={radius} />;

  const hasText = body.text.length > 0;
  if (!hasText && !media && embeds.length === 0) {
    return <Tombstone message={message} radius={radius} kind="unknown" />;
  }
  const metaInText = hasText && embeds.length === 0;
  const solo = media && !hasText && embeds.length === 0;
  const tone = tick === 'failed' ? FAILED : message.mine ? MINE : THEIRS;
  const showName = first && !message.mine && conversation.kind !== 'direct';
  const moderated = showName && isPublicStaff(conversation) && message.sender !== me;
  const openSender = (event: React.MouseEvent) => {
    event.stopPropagation();
    const user = people.get(message.sender) ?? {
      id: message.sender,
      name: nameOf(message.sender),
      avatarUrl: null,
      permalink: null,
    };
    const staff = useChatThreadStore.getState().threads[conversation.id]?.members ?? [];
    openPublicUserMenu(event, user, conversation, me, staff, t);
  };

  return (
    <div
      data-ui="chat-bubble"
      data-mine={message.mine ? '' : undefined}
      data-failed={tick === 'failed' ? '' : undefined}
      className={`chat-thread-motion relative min-w-0 max-w-full px-3 py-[7px] text-[13.5px] leading-[1.45] text-ink-90 ${media ? 'w-min' : ''}`}
      style={{
        ...tone,
        borderRadius: radius,
        animation: flash ? 'chat-thread-flash 1.4s ease-out' : undefined,
      }}
    >
      {showName && moderated && (
        <button
          type="button"
          data-ui="chat-sender"
          onClick={openSender}
          className="mb-0.5 block max-w-full cursor-pointer truncate text-left text-[12px] font-semibold hover:underline"
          style={{ color: senderColor(message.sender) }}
        >
          {nameOf(message.sender)}
        </button>
      )}
      {showName && !moderated && (
        <div
          className="mb-0.5 truncate text-[12px] font-semibold"
          style={{ color: senderColor(message.sender) }}
        >
          {nameOf(message.sender)}
        </div>
      )}
      {message.forwardedFrom && <Forwarded forwarded={message.forwardedFrom} />}
      {message.replyTo !== null && <ReplyQuote seq={message.replyTo} message={replied} />}
      {media && <MediaBubble message={message} tick={tick} solo={solo} />}
      {hasText && (
        <div className="selectable flow-root whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
          <MessageText rich={body} />
          {metaInText && <BubbleMeta message={message} tick={tick} floating />}
        </div>
      )}
      {embeds.length > 0 && (
        <div className={`flex w-[360px] max-w-full flex-col gap-1.5 ${hasText ? 'mt-1.5' : ''}`}>
          {embeds.map((embed, index) => (
            <CheckedEmbedCard key={`${embed.urn}:${index}`} embed={embed} mine={message.mine} />
          ))}
        </div>
      )}
      {!metaInText && !solo && (
        <div className="mt-1 flex justify-end">
          <BubbleMeta message={message} tick={tick} floating={false} />
        </div>
      )}
    </div>
  );
});
