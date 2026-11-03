import * as Dialog from '@radix-ui/react-dialog';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { askRelogin } from '../../lib/auth-recovery';
import { AlertCircle, CircleCheck, Loader2, Lock, RotateCcw } from '../../lib/icons';
import type { UploadAction } from '../../lib/track-upload';
import { useAuthRecoveryStore } from '../../stores/auth-recovery';
import { useTrackUploadStore } from '../../stores/track-upload';

const GHOST_BUTTON =
  'px-4 py-2 rounded-xl text-[13px] font-medium text-ink-50 hover:text-ink-80 hover:bg-ink/[0.06] transition-all cursor-pointer';

const PRIMARY_LABEL: Record<UploadAction, string> = {
  signIn: 'sync.signIn',
  retry: 'common.retry',
  restart: 'upload.tryAgain',
};

function megabytes(bytes: number) {
  return (bytes / (1024 * 1024)).toFixed(1);
}

function ProgressBar({ ratio, pulsing }: { ratio: number; pulsing: boolean }) {
  return (
    <div className="h-2 rounded-full bg-ink/[0.06] overflow-hidden">
      <div
        className={`h-full rounded-full bg-accent transition-[width] duration-300 ease-out ${pulsing ? 'animate-pulse' : ''}`}
        style={{
          width: `${Math.max(2, Math.round(ratio * 100))}%`,
          boxShadow: '0 0 16px var(--color-accent-glow)',
        }}
      />
    </div>
  );
}

function InFlight() {
  const { t } = useTranslation();
  const { phase, title, sent, total, cancel } = useTrackUploadStore();
  const processing = phase === 'processing';
  const ratio = total > 0 ? sent / total : 0;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-full bg-accent/15 flex items-center justify-center text-accent shrink-0">
          <Loader2 size={18} className="animate-spin" />
        </span>
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold text-ink-90 truncate">{title}</p>
          <p className="text-[11.5px] text-ink-40">
            {processing ? t('upload.handingOff') : t('upload.sending')}
          </p>
        </div>
        <span className="ml-auto text-[13px] font-semibold tabular-nums text-ink-70">
          {Math.round(ratio * 100)}%
        </span>
      </div>
      <ProgressBar ratio={processing ? 1 : ratio} pulsing={processing} />
      <div className="flex items-center justify-between text-[11px] text-ink-35 tabular-nums">
        <span>{total > 0 ? `${megabytes(sent)} / ${megabytes(total)} MB` : ''}</span>
        <span>{t('upload.keepsRunning')}</span>
      </div>
      {!processing && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={cancel}
            className="px-4 py-2 rounded-xl text-[13px] font-medium text-ink-50 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
          >
            {t('upload.cancel')}
          </button>
        </div>
      )}
    </div>
  );
}

function Finished() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { title, trackUrn, reset, setDialogOpen } = useTrackUploadStore();
  return (
    <div className="flex flex-col items-center text-center gap-3 py-2">
      <span className="w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-400">
        <CircleCheck size={26} />
      </span>
      <p className="text-[15px] font-bold text-ink-90">{t('upload.done', { title })}</p>
      <p className="text-[12.5px] text-ink-45 leading-relaxed max-w-[340px]">
        {t('upload.processingHint')}
      </p>
      <div className="flex items-center gap-2.5 pt-2">
        <button
          type="button"
          onClick={reset}
          className="px-4 py-2 rounded-xl text-[13px] font-medium text-ink-55 hover:text-ink-85 hover:bg-ink/[0.06] transition-all cursor-pointer"
        >
          {t('upload.another')}
        </button>
        {trackUrn && (
          <button
            type="button"
            onClick={() => {
              setDialogOpen(false);
              reset();
              navigate(`/track/${encodeURIComponent(trackUrn)}`);
            }}
            className="px-4 py-2 rounded-xl text-[13px] font-semibold bg-accent text-accent-contrast hover:bg-accent-hover transition-all cursor-pointer"
          >
            {t('upload.openTrack')}
          </button>
        )}
      </div>
    </div>
  );
}

function Failed() {
  const { t } = useTranslation();
  const { error, reason, action, retryAfter, failedAt, reset, retry, setDialogOpen } =
    useTrackUploadStore();
  const recoveryPhase = useAuthRecoveryStore((s) => s.phase);
  const signedIn = useAuthRecoveryStore((s) => action === 'signIn' && s.signedInAt > failedAt);
  const primary = signedIn ? 'retry' : action;
  const minutes = Math.max(1, Math.ceil((retryAfter ?? 0) / 60));

  useEffect(() => {
    if (primary === 'signIn' && recoveryPhase === 'modal') setDialogOpen(false);
  }, [primary, recoveryPhase, setDialogOpen]);

  const runPrimary = () => {
    if (primary === 'signIn') {
      askRelogin('writes');
    } else if (primary === 'retry') {
      void retry();
    } else {
      reset();
    }
  };
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-red-500/[0.07] border border-red-500/15">
        <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
        <div className="space-y-1 min-w-0">
          <p className="text-[13px] text-ink-80 leading-relaxed">
            {t(signedIn ? 'upload.errors.signedIn' : (error ?? 'upload.errors.failed'), {
              minutes,
            })}
          </p>
          {reason && !signedIn && (
            <p className="text-[11.5px] text-ink-40 break-words">{reason}</p>
          )}
        </div>
      </div>
      <div className="flex items-center justify-end gap-2.5">
        <Dialog.Close className={GHOST_BUTTON}>{t('common.close')}</Dialog.Close>
        {primary === 'retry' && (
          <button type="button" onClick={reset} className={GHOST_BUTTON}>
            {t('upload.otherFile')}
          </button>
        )}
        <button
          type="button"
          onClick={runPrimary}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-semibold bg-accent text-accent-contrast hover:bg-accent-hover transition-all cursor-pointer"
        >
          {primary === 'signIn' && <Lock size={13} />}
          {primary === 'retry' && <RotateCcw size={13} />}
          {t(PRIMARY_LABEL[primary])}
        </button>
      </div>
    </div>
  );
}

export const UploadStatus = React.memo(function UploadStatus() {
  const phase = useTrackUploadStore((s) => s.phase);
  if (phase === 'done') return <Finished />;
  if (phase === 'failed') return <Failed />;
  return <InFlight />;
});
