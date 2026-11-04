import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, RefreshCw } from '../../../../lib/icons';
import { StarAction, type StarState } from './StarAction';

export interface CoverError {
  code: string;
  until: number;
  attempt: number;
}

const LIMIT_WAIT_MS = 5_000;

export function coverError(
  code: string,
  retryMs: number | null,
  previous: CoverError | null,
): CoverError {
  const wait = retryMs ?? (code === 'request_limit' ? LIMIT_WAIT_MS : 0);
  return { code, until: wait > 0 ? Date.now() + wait : 0, attempt: (previous?.attempt ?? 0) + 1 };
}

function secondsLeft(until: number): number {
  return Math.max(0, Math.ceil((until - Date.now()) / 1000));
}

export function useCountdown(until: number): number {
  const [left, setLeft] = useState(() => secondsLeft(until));
  useEffect(() => {
    setLeft(secondsLeft(until));
    if (secondsLeft(until) <= 0) return;
    const timer = setInterval(() => {
      const next = secondsLeft(until);
      setLeft(next);
      if (next <= 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [until]);
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
      className="inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-ink/[0.08] px-3 text-[11.5px] font-semibold text-ink-80 tabular-nums transition-colors hover:bg-ink/[0.14] disabled:cursor-default disabled:opacity-50"
    >
      <RefreshCw size={11} />
      {label}
    </button>
  );
}

function issueTitle(code: string): string {
  if (code === 'room_star_required') return 'chat.room.perks.cover.needStar';
  if (code === 'invalid') return 'chat.room.perks.cover.invalid';
  if (code === 'request_limit') return 'chat.room.perks.cover.limited';
  return 'chat.room.perks.cover.failed';
}

export const CoverIssue = memo(function CoverIssue({
  error,
  wait,
  star,
  onRetry,
  onPickOther,
}: {
  error: CoverError;
  wait: number;
  star: StarState;
  onRetry: () => void;
  onPickOther: () => void;
}) {
  const { t } = useTranslation();
  const needsStar = error.code === 'room_star_required';
  const invalid = error.code === 'invalid';

  return (
    <div
      role="alert"
      className="flex items-center gap-2 rounded-[10px] bg-bad/[0.08] px-2.5 py-2 text-[11.5px] font-semibold text-bad"
    >
      <AlertCircle size={13} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate">{t(issueTitle(error.code))}</span>
      {needsStar && <StarAction state={star === 'star' ? 'soon' : star} />}
      {invalid && <Action label={t('chat.room.perks.cover.pickOther')} onClick={onPickOther} />}
      {!needsStar && !invalid && (
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
