import { memo } from 'react';
import { messageSnippet, senderColor } from '../../../lib/chat/render';
import { ink } from '../../../lib/chat/tone';
import type { Message, Seq } from '../../../lib/chat/types';
import { useThread } from '../thread/context';

export const ReplyQuote = memo(function ReplyQuote({
  seq,
  message,
}: {
  seq: Seq;
  message: Message | null;
}) {
  const { t, nameOf, jumpTo } = useThread();
  const color = message ? senderColor(message.sender) : ink(35);

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        jumpTo(seq);
      }}
      className="mb-1 flex w-full min-w-0 cursor-pointer items-stretch gap-2 rounded-[10px] bg-shade-20 py-1 pr-2.5 pl-1 text-left transition-colors duration-150 hover:bg-shade-30"
    >
      <span aria-hidden className="w-[3px] shrink-0 rounded-full" style={{ background: color }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11.5px] font-semibold" style={{ color }}>
          {message ? nameOf(message.sender) : t('chat.thread.reply.missing')}
        </span>
        {message && (
          <span className="block truncate text-[12px] leading-snug text-ink-55">
            {messageSnippet(message, t)}
          </span>
        )}
      </span>
    </button>
  );
});
