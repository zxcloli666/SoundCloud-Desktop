import { memo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Hourglass } from '../../../lib/chat/icons';
import {
  ImageIcon,
  Loader2,
  Lock as LockIcon,
  Sparkles,
  TriangleAlert,
  X,
} from '../../../lib/icons';
import { StarCta } from '../../star-moments/StarCta';
import { clock, useLeftMs } from './countdown';
import type { BackdropProblem } from './errors';
import type { BackdropScene } from './target';

export type Lock = 'star' | 'role' | 'pending';

const FOCUS = 'outline-none focus-visible:ring-2 focus-visible:ring-accent/60';

function Closed({ lock, scene }: { lock: 'role' | 'pending'; scene: BackdropScene }) {
  const { t } = useTranslation();
  const Icon = lock === 'pending' ? Hourglass : LockIcon;
  return (
    <div
      role="status"
      data-ui="chat-backdrop-locked"
      className="backdrop-motion flex items-center gap-3 rounded-2xl border border-ink/[0.08] bg-ink/[0.04] p-3 animate-[backdrop-in_0.35s_var(--ease-apple)_both]"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-ink/[0.07] text-ink-60">
        <Icon size={16} />
      </span>
      <p className="min-w-0 flex-1 text-[13px] font-semibold text-ink-85">
        {t(lock === 'pending' ? 'chat.backdrop.locked.pending' : `chat.backdrop.locked.${scene}`)}
      </p>
    </div>
  );
}

function Locked({ scene, onStar }: { scene: BackdropScene; onStar: () => void }) {
  const { t } = useTranslation();
  const area = scene === 'room' ? 'room' : scene === 'public' ? 'public' : 'chat';
  return (
    <div className="backdrop-motion flex items-center gap-3 rounded-2xl border border-accent/25 bg-accent/[0.08] p-3 animate-[backdrop-in_0.35s_var(--ease-apple)_both]">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
        <Sparkles size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-ink-90">
          {t(`chat.backdrop.star.${area}.title`)}
        </p>
        <p className="text-[11.5px] text-ink-50">{t(`chat.backdrop.star.${area}.body`)}</p>
      </div>
      <StarCta size="sm" onOpen={onStar} />
    </div>
  );
}

function DropButton({ label, onDrop }: { label: string; onDrop: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onDrop}
      className={`flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-45 transition-colors hover:bg-ink/[0.08] hover:text-ink-85 ${FOCUS}`}
    >
      <X size={13} />
    </button>
  );
}

function Bar({ tone, children }: { tone: 'bad' | 'calm'; children: ReactNode }) {
  return (
    <div
      role={tone === 'bad' ? 'alert' : 'status'}
      className={`backdrop-motion flex items-center gap-2.5 rounded-2xl border px-3 py-2.5 animate-[backdrop-in_0.3s_var(--ease-apple)_both] ${
        tone === 'bad' ? 'border-bad/25 bg-bad/10' : 'border-ink/[0.08] bg-ink/[0.04]'
      }`}
    >
      {children}
    </div>
  );
}

function Uploading({ percent, onDrop }: { percent: number; onDrop: (() => void) | null }) {
  const { t } = useTranslation();
  return (
    <Bar tone="calm">
      <ImageIcon size={15} className="shrink-0 text-accent" />
      <span className="min-w-0 flex-1 text-[12.5px] font-medium tabular-nums text-ink-85">
        {t('chat.backdrop.chip', { percent })}
      </span>
      {onDrop && <DropButton label={t('chat.backdrop.cancelUpload')} onDrop={onDrop} />}
    </Bar>
  );
}

function Problem({
  problem,
  onRetry,
  onPhoto,
  onStored,
  onStorage,
  onDrop,
}: {
  problem: BackdropProblem;
  onRetry: () => void;
  onPhoto: () => void;
  onStored: () => void;
  onStorage: () => void;
  onDrop: (() => void) | null;
}) {
  const { t } = useTranslation();
  const left = useLeftMs(problem.fix === 'wait' ? problem.until : null);
  const action =
    problem.fix === 'retry' || (problem.fix === 'wait' && left === 0)
      ? { label: t('chat.backdrop.retry'), run: onRetry }
      : problem.fix === 'photo'
        ? { label: t('chat.backdrop.pickAgain'), run: onPhoto }
        : problem.fix === 'stored'
          ? { label: t('chat.backdrop.pickStored'), run: onStored }
          : problem.fix === 'storage'
            ? { label: t('chat.backdrop.storage'), run: onStorage }
            : null;
  return (
    <Bar tone="bad">
      <TriangleAlert size={15} className="shrink-0 text-bad" />
      <span className="min-w-0 flex-1 text-[12.5px] font-medium text-ink-85">
        {t(problem.key, { time: clock(left) })}
      </span>
      {problem.fix === 'wait' && left > 0 && !problem.timeInText && (
        <span className="shrink-0 text-[12px] font-semibold tabular-nums text-ink-60">
          {clock(left)}
        </span>
      )}
      {problem.fix === 'star' && <StarCta size="sm" />}
      {action && (
        <button
          type="button"
          onClick={action.run}
          className={`h-7 shrink-0 cursor-pointer rounded-full bg-ink/[0.08] px-3 text-[12px] font-semibold text-ink-85 transition-colors hover:bg-ink/[0.14] ${FOCUS}`}
        >
          {action.label}
        </button>
      )}
      {onDrop && <DropButton label={t('chat.backdrop.dismiss')} onDrop={onDrop} />}
    </Bar>
  );
}

export const PickerFooter = memo(function PickerFooter({
  lock,
  scene,
  waiting,
  problem,
  uploading,
  onRetry,
  onPhoto,
  onStored,
  onStorage,
  onDrop,
  onStar,
}: {
  lock: Lock | null;
  scene: BackdropScene;
  waiting: boolean;
  problem: BackdropProblem | null;
  uploading: number | null;
  onRetry: () => void;
  onPhoto: () => void;
  onStored: () => void;
  onStorage: () => void;
  onDrop: (() => void) | null;
  onStar: () => void;
}) {
  const { t } = useTranslation();
  if (lock === 'role' || lock === 'pending') return <Closed lock={lock} scene={scene} />;
  if (problem?.fix === 'wait') {
    return (
      <Problem
        problem={problem}
        onRetry={onRetry}
        onPhoto={onPhoto}
        onStored={onStored}
        onStorage={onStorage}
        onDrop={onDrop}
      />
    );
  }
  if (lock === 'star') return <Locked scene={scene} onStar={onStar} />;
  if (problem) {
    return (
      <Problem
        problem={problem}
        onRetry={onRetry}
        onPhoto={onPhoto}
        onStored={onStored}
        onStorage={onStorage}
        onDrop={onDrop}
      />
    );
  }
  if (uploading !== null) return <Uploading percent={uploading} onDrop={onDrop} />;
  if (waiting) {
    return (
      <div role="status" className="flex items-center gap-2 px-1 text-[12px] text-ink-50">
        <Loader2 size={13} className="animate-spin" />
        {t('chat.backdrop.linking')}
      </div>
    );
  }
  return null;
});
