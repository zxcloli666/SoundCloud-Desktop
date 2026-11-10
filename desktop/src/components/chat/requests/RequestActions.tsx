import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Flag } from '../../../lib/chat/icons';
import type { ConversationSummary, UserRef } from '../../../lib/chat/types';
import { Ban, Check, X } from '../../../lib/icons';
import { useRequestActions } from './useRequestActions';

interface RequestActionsProps {
  conversation: ConversationSummary;
  from: UserRef | null;
  wide: boolean;
}

const ROUND =
  'flex shrink-0 cursor-pointer items-center justify-center rounded-full transition-all duration-200 active:scale-[0.94]';

export const RequestActions = memo(function RequestActions({
  conversation,
  from,
  wide,
}: RequestActionsProps) {
  const { t } = useTranslation();
  const actions = useRequestActions();
  const direct = conversation.kind === 'direct';
  const stop = (run: () => void) => (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    run();
  };

  return (
    <div className="flex items-center gap-1.5">
      {wide && direct && from && (
        <button
          type="button"
          title={t('chat.list.requests.report')}
          aria-label={t('chat.list.requests.report')}
          onClick={stop(() => actions.report(conversation, from))}
          className={`${ROUND} size-8 text-ink-40 hover:bg-ink/[0.07] hover:text-ink-80`}
        >
          <Flag size={14} />
        </button>
      )}
      {wide && from && (
        <button
          type="button"
          title={t('chat.list.requests.block')}
          aria-label={t('chat.list.requests.block')}
          onClick={stop(() => void actions.block(conversation, from))}
          className={`${ROUND} size-8 text-rose-300/70 hover:bg-rose-500/15 hover:text-rose-200`}
        >
          <Ban size={14} />
        </button>
      )}
      <button
        type="button"
        title={t('chat.list.requests.decline')}
        aria-label={t('chat.list.requests.decline')}
        onClick={stop(() => void actions.decline(conversation))}
        className={`${ROUND} size-8 border border-ink/[0.08] bg-ink/[0.05] text-ink-60 hover:bg-ink/[0.1] hover:text-ink`}
      >
        <X size={14} />
      </button>
      <button
        type="button"
        onClick={stop(() => void actions.accept(conversation))}
        className={`${ROUND} h-8 gap-1.5 px-3 text-[12px] font-semibold`}
        style={{
          color: 'var(--color-accent-contrast)',
          background: 'linear-gradient(160deg, var(--color-accent-hover), var(--color-accent))',
          boxShadow: '0 4px 14px var(--color-accent-glow)',
        }}
      >
        <Check size={13} strokeWidth={2.6} />
        {t('chat.list.requests.accept')}
      </button>
    </div>
  );
});
