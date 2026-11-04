import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, RefreshCw } from '../../../../lib/icons';
import { StarCta } from '../../../star-moments/StarCta';

export interface CoverError {
  code: string;
  retryMs: number | null;
}

const DEFAULT_WAIT_MS = 5_000;

function useWait(error: CoverError): number {
  const [until] = useState(() =>
    error.code === 'request_limit' ? Date.now() + (error.retryMs ?? DEFAULT_WAIT_MS) : 0,
  );
  const [left, setLeft] = useState(() => Math.max(0, Math.ceil((until - Date.now()) / 1000)));
  useEffect(() => {
    if (left <= 0) return;
    const timer = setTimeout(
      () => setLeft(Math.max(0, Math.ceil((until - Date.now()) / 1000))),
      1000,
    );
    return () => clearTimeout(timer);
  }, [left, until]);
  return left;
}

function Action({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-ink/[0.08] px-3 text-[11.5px] font-semibold text-ink-80 transition-colors hover:bg-ink/[0.14] disabled:cursor-default disabled:opacity-50 tabular-nums"
    >
      <RefreshCw size={11} />
      {label}
    </button>
  );
}

export const CoverIssue = memo(function CoverIssue({
  error,
  onRetry,
  onPickOther,
}: {
  error: CoverError;
  onRetry: () => void;
  onPickOther: () => void;
}) {
  const { t } = useTranslation();
  const wait = useWait(error);
  const star = error.code === 'room_star_required';
  const invalid = error.code === 'invalid';
  const limited = error.code === 'request_limit';
  const title = star
    ? t('chat.room.perks.cover.needStar')
    : invalid
      ? t('chat.room.perks.cover.invalid')
      : limited
        ? t('chat.room.perks.cover.limited')
        : t('chat.room.perks.cover.failed');

  return (
    <div
      role="alert"
      className="flex items-center gap-2 rounded-[10px] bg-bad/[0.08] px-2.5 py-2 text-[11.5px] font-semibold text-bad"
    >
      <AlertCircle size={13} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate">{title}</span>
      {star && <StarCta size="sm" />}
      {invalid && <Action label={t('chat.room.perks.cover.pickOther')} onClick={onPickOther} />}
      {!star && !invalid && (
        <Action
          label={
            wait > 0
              ? t('chat.room.perks.cover.wait', { value: wait })
              : t('chat.room.perks.cover.retry')
          }
          disabled={wait > 0}
          onClick={onRetry}
        />
      )}
    </div>
  );
});
