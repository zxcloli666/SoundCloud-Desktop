import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageCircle } from '../../../lib/chat/icons';
import type { ConversationKind } from '../../../lib/chat/types';
import { Ban, Bookmark, Globe, RotateCcw } from '../../../lib/icons';
import { Skeleton } from '../../ui/Skeleton';

const SHAPES = [
  { mine: false, width: 'w-[46%]', height: 'h-9' },
  { mine: false, width: 'w-[62%]', height: 'h-14' },
  { mine: true, width: 'w-[40%]', height: 'h-9' },
  { mine: false, width: 'w-[34%]', height: 'h-9' },
  { mine: true, width: 'w-[56%]', height: 'h-16' },
];

export const ThreadSkeleton = memo(function ThreadSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-[58px] shrink-0 items-center gap-2.5 border-b border-ink/[0.05] px-3.5">
        <Skeleton rounded="full" className="size-9" />
        <Skeleton className="h-3.5 w-36" />
      </div>
      <div className="mx-auto flex w-full max-w-[780px] flex-1 flex-col justify-end gap-2 px-3 pb-4">
        {SHAPES.map((shape, index) => (
          <div key={index} className={`flex ${shape.mine ? 'justify-end' : ''}`}>
            <Skeleton rounded="lg" className={`${shape.width} ${shape.height}`} />
          </div>
        ))}
      </div>
    </div>
  );
});

export const ThreadFailed = memo(function ThreadFailed({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="text-[13px] text-ink-50">{t('chat.thread.loadFailed')}</span>
      <button
        type="button"
        onClick={onRetry}
        className="flex h-9 cursor-pointer items-center gap-2 rounded-full bg-ink/[0.07] px-4 text-[12.5px] font-semibold text-ink-80 transition-colors duration-150 hover:bg-ink/[0.12]"
      >
        <RotateCcw size={14} />
        {t('chat.thread.retry')}
      </button>
    </div>
  );
});

const EMPTY_KEYS: Partial<Record<ConversationKind, string>> = {
  self: 'chat.thread.empty.saved',
  public: 'chat.public.empty',
};

export const ThreadEmpty = memo(function ThreadEmpty({ kind }: { kind: ConversationKind }) {
  const { t } = useTranslation();
  const Icon = kind === 'self' ? Bookmark : kind === 'public' ? Globe : MessageCircle;
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <span
        className="flex size-14 items-center justify-center rounded-[20px]"
        style={{ background: 'var(--color-accent-glow)', color: 'var(--color-accent-hover)' }}
      >
        <Icon size={24} />
      </span>
      <span className="max-w-[260px] text-[13px] leading-snug text-ink-50">
        {t(EMPTY_KEYS[kind] ?? 'chat.thread.empty.chat')}
      </span>
    </div>
  );
});

export const ThreadGone = memo(function ThreadGone() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-ink-45">
      <Ban size={22} />
      <span className="text-[13px]">{t('chat.thread.notMember')}</span>
    </div>
  );
});
