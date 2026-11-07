import { type KeyboardEvent, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { ink } from '../../../lib/chat/tone';
import type { ConversationSummary, ConvId } from '../../../lib/chat/types';
import { usePerfMode } from '../../../lib/perf';
import { selectPublic, useChatListStore } from '../../../stores/chat/list';
import { rowTime } from '../list/row-time';
import { PublicMark } from './PublicMark';
import { StaffMark } from './StaffMark';

export const PublicOnline = memo(function PublicOnline({
  count,
  className = '',
}: {
  count: number;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <span className={`flex shrink-0 items-center gap-1.5 tabular-nums ${className}`}>
      <span aria-hidden className="size-1.5 rounded-full bg-ok" />
      {t('chat.public.online', { count })}
    </span>
  );
});

function PingPill() {
  const { t } = useTranslation();
  const glow = usePerfMode().glow;
  return (
    <span
      title={t('chat.public.pinged')}
      className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold leading-none"
      style={{
        background: 'var(--color-accent)',
        color: 'var(--color-accent-contrast)',
        boxShadow: glow ? '0 0 12px var(--color-accent-glow)' : undefined,
      }}
    >
      @
    </span>
  );
}

function Preview({ conversation }: { conversation: ConversationSummary }) {
  const { t } = useTranslation();
  const preview = conversation.preview;
  if (!preview) return <span className="truncate text-ink-40">{t('chat.public.tagline')}</span>;
  if (preview.kind === 'image') {
    return <span className="truncate text-ink-45">{t('chat.list.preview.image')}</span>;
  }
  return <span className="truncate text-ink-45">{preview.text}</span>;
}

export const PublicRow = memo(function PublicRow({
  selected,
  onOpen,
}: {
  selected: boolean;
  onOpen: (conversationId: ConvId) => void;
}) {
  const { t, i18n } = useTranslation();
  const conversation = useChatListStore(selectPublic);
  if (!conversation) return null;
  const fresh = conversation.pinged;
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen(conversation.id);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      data-ui="chat-row"
      data-kind="public"
      aria-current={selected ? 'true' : undefined}
      aria-label={t('chat.public.title')}
      onClick={() => onOpen(conversation.id)}
      onKeyDown={onKeyDown}
      className="group relative mx-2 mb-1 flex h-[60px] cursor-pointer items-center gap-3 rounded-2xl border px-2.5 outline-none transition-colors duration-200 focus-visible:ring-1 focus-visible:ring-ink/20 hover:bg-ink/[0.05]"
      style={{
        borderColor: selected ? 'var(--color-accent)' : 'var(--color-accent-glow)',
        background: `linear-gradient(90deg, var(--color-accent-glow), transparent 72%), ${ink(selected ? 5 : 0)}`,
      }}
    >
      <PublicMark size={44} live={selected} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className={`truncate text-[13.5px] tracking-tight ${
              fresh ? 'font-bold text-ink' : 'font-semibold text-ink-90'
            }`}
          >
            {t('chat.public.title')}
          </span>
          <StaffMark role={conversation.role} size={12} />
          <span className="ml-auto shrink-0 pl-2 text-[11px] tabular-nums text-ink-35">
            {conversation.lastAt > 0 ? rowTime(conversation.lastAt, Date.now(), i18n.language) : ''}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[12.5px]">
          <PublicOnline count={conversation.memberCount} className="text-ink-60" />
          <span className="min-w-0 flex-1 truncate">
            <Preview conversation={conversation} />
          </span>
          {fresh && (
            <span className="ml-auto shrink-0">
              <PingPill />
            </span>
          )}
        </div>
      </div>
    </div>
  );
});
