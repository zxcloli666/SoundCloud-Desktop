import { memo, type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Hourglass } from '../../../lib/chat/icons';
import type { ChatError } from '../../../lib/chat/types';
import { Images, RefreshCw, WifiOff } from '../../../lib/icons';
import { Skeleton } from '../../ui/Skeleton';
import { errorText, isRateLimit } from './error-text';
import { Panel } from './Panel';

export function GridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div
      data-ui="chat-storage-grid-skeleton"
      className="grid gap-2.5"
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(132px, 1fr))' }}
    >
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} rounded="lg" className="aspect-square w-full" />
      ))}
    </div>
  );
}

export function StorageSkeleton() {
  return (
    <div
      data-ui="chat-storage-skeleton"
      className="grid gap-5 @min-[900px]:grid-cols-[320px_minmax(0,1fr)]"
    >
      <div className="flex flex-col gap-4">
        <Panel className="p-5">
          <div className="flex items-center gap-5">
            <Skeleton rounded="full" className="size-[124px] shrink-0" />
            <div className="flex flex-1 flex-col gap-2.5">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-8 w-full" />
            </div>
          </div>
        </Panel>
        <Panel className="flex flex-col gap-3 p-4">
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex items-center gap-3">
              <Skeleton rounded="full" className="size-8 shrink-0" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-1.5 w-full" />
              </div>
            </div>
          ))}
        </Panel>
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton rounded="lg" className="h-11 w-full" />
        <GridSkeleton />
      </div>
    </div>
  );
}

function useCooldown(error: ChatError | null): number {
  const retryMs = isRateLimit(error) ? (error?.retryMs ?? 0) : 0;
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    setUntil(retryMs > 0 ? Date.now() + retryMs : 0);
  }, [retryMs]);
  useEffect(() => {
    if (until <= Date.now()) return;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [until]);
  return Math.max(0, Math.ceil((until - now) / 1000));
}

export const StorageNote = memo(function StorageNote({
  icon,
  title,
  line,
  action,
  ui,
}: {
  icon: ReactNode;
  title: string;
  line?: string;
  action?: ReactNode;
  ui: string;
}) {
  return (
    <div data-ui={ui} className="flex flex-col items-center gap-3 px-4 py-14 text-center">
      <div className="flex size-14 items-center justify-center rounded-[1.25rem] border border-ink/[0.07] bg-ink/[0.04] text-ink-45">
        {icon}
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-[14px] font-semibold text-ink-85">{title}</p>
        {line && <p className="max-w-[320px] text-[12.5px] leading-snug text-ink-50">{line}</p>}
      </div>
      {action}
    </div>
  );
});

export const StorageError = memo(function StorageError({
  error,
  onRetry,
}: {
  error: ChatError | null;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const wait = useCooldown(error);
  const limited = isRateLimit(error);
  return (
    <StorageNote
      ui="chat-storage-error"
      icon={limited ? <Hourglass size={22} /> : <WifiOff size={22} />}
      title={limited ? t('chat.storage.errors.limitedTitle') : t('chat.storage.errors.title')}
      line={errorText(error, t)}
      action={
        <button
          type="button"
          disabled={wait > 0}
          onClick={onRetry}
          className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-ink/[0.07] px-3.5 py-2 text-[12.5px] font-semibold text-ink-80 outline-none transition-colors hover:bg-ink/[0.11] focus-visible:ring-2 focus-visible:ring-accent/60 disabled:cursor-default disabled:opacity-50"
        >
          <RefreshCw size={12} />
          {wait > 0 ? t('chat.storage.retryIn', { count: wait }) : t('chat.storage.retry')}
        </button>
      }
    />
  );
});

export const GridEmpty = memo(function GridEmpty({ filtered }: { filtered: boolean }) {
  const { t } = useTranslation();
  return (
    <StorageNote
      ui="chat-storage-empty"
      icon={<Images size={22} />}
      title={filtered ? t('chat.storage.empty.chatTitle') : t('chat.storage.empty.title')}
      line={filtered ? undefined : t('chat.storage.empty.line')}
    />
  );
});
