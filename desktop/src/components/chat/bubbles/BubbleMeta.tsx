import { memo } from 'react';
import type { Tick } from '../../../lib/chat/render';
import { clockTime, fullTime } from '../../../lib/chat/time';
import type { Message } from '../../../lib/chat/types';
import { Pencil } from '../../../lib/icons';
import { useThread } from '../thread/context';
import { ExpiryBadge } from './ExpiryBadge';
import { Ticks } from './Ticks';

export const BubbleMeta = memo(function BubbleMeta({
  message,
  tick,
  floating,
}: {
  message: Message;
  tick: Tick | null;
  floating: boolean;
}) {
  const { t, language } = useThread();
  return (
    <span
      title={fullTime(message.ts, language)}
      className={`pointer-events-auto inline-flex select-none items-center gap-1 text-[10.5px] leading-none tabular-nums ${
        message.mine ? 'text-ink-55' : 'text-ink-38'
      } ${floating ? 'relative top-[6px] float-right ml-2.5' : ''}`}
    >
      {message.editedAt !== null && (
        <Pencil
          size={9}
          aria-label={t('chat.thread.bubble.edited')}
          className="shrink-0 opacity-80"
        />
      )}
      {message.expiresAt !== null && (
        <ExpiryBadge sentAt={message.ts} expiresAt={message.expiresAt} />
      )}
      <span>{clockTime(message.ts, language)}</span>
      {tick && <Ticks tick={tick} />}
    </span>
  );
});
