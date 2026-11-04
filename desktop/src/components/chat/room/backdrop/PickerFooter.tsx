import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Sparkles, TriangleAlert, X } from '../../../../lib/icons';
import { StarCta } from '../../../star-moments/StarCta';
import { clock, useLeftMs } from './countdown';
import type { BackdropProblem } from './errors';

function Locked({ onStar }: { onStar: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-accent/25 bg-accent/[0.08] p-3 animate-[backdrop-in_0.35s_var(--ease-apple)_both] backdrop-motion">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
        <Sparkles size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-ink-90">{t('chat.backdrop.star.title')}</p>
        <p className="text-[11.5px] text-ink-50">{t('chat.backdrop.star.body')}</p>
      </div>
      <StarCta size="sm" onOpen={onStar} />
    </div>
  );
}

function Problem({
  problem,
  onRetry,
  onPhoto,
  onStorage,
  onDismiss,
}: {
  problem: BackdropProblem;
  onRetry: () => void;
  onPhoto: () => void;
  onStorage: () => void;
  onDismiss: (() => void) | null;
}) {
  const { t } = useTranslation();
  const left = useLeftMs(problem.fix === 'wait' ? problem.until : null);
  const action =
    problem.fix === 'retry' || (problem.fix === 'wait' && left === 0)
      ? { label: t('chat.backdrop.retry'), run: onRetry }
      : problem.fix === 'photo'
        ? { label: t('chat.backdrop.pickAgain'), run: onPhoto }
        : problem.fix === 'storage'
          ? { label: t('chat.backdrop.storage'), run: onStorage }
          : null;
  return (
    <div
      role="alert"
      className="flex items-center gap-2.5 rounded-2xl border border-bad/25 bg-bad/10 px-3 py-2.5 animate-[backdrop-in_0.3s_var(--ease-apple)_both] backdrop-motion"
    >
      <TriangleAlert size={15} className="shrink-0 text-bad" />
      <span className="min-w-0 flex-1 text-[12.5px] font-medium text-ink-85">
        {t(problem.key, { time: clock(left) })}
      </span>
      {problem.fix === 'wait' && left > 0 && (
        <span className="shrink-0 text-[12px] font-semibold tabular-nums text-ink-60">
          {clock(left)}
        </span>
      )}
      {action && (
        <button
          type="button"
          onClick={action.run}
          className="h-7 shrink-0 cursor-pointer rounded-full bg-ink/[0.08] px-3 text-[12px] font-semibold text-ink-85 transition-colors hover:bg-ink/[0.14]"
        >
          {action.label}
        </button>
      )}
      {onDismiss && (
        <button
          type="button"
          aria-label={t('chat.backdrop.dismiss')}
          title={t('chat.backdrop.dismiss')}
          onClick={onDismiss}
          className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-45 transition-colors hover:bg-ink/[0.08] hover:text-ink-85"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}

export const PickerFooter = memo(function PickerFooter({
  locked,
  linking,
  problem,
  onRetry,
  onPhoto,
  onStorage,
  onDismiss,
  onStar,
}: {
  locked: boolean;
  linking: boolean;
  problem: BackdropProblem | null;
  onRetry: () => void;
  onPhoto: () => void;
  onStorage: () => void;
  onDismiss: (() => void) | null;
  onStar: () => void;
}) {
  const { t } = useTranslation();
  if (locked) return <Locked onStar={onStar} />;
  if (problem)
    return (
      <Problem
        problem={problem}
        onRetry={onRetry}
        onPhoto={onPhoto}
        onStorage={onStorage}
        onDismiss={onDismiss}
      />
    );
  if (linking) {
    return (
      <div className="flex items-center gap-2 px-1 text-[12px] text-ink-50">
        <Loader2 size={13} className="animate-spin" />
        {t('chat.backdrop.linking')}
      </div>
    );
  }
  return null;
});
