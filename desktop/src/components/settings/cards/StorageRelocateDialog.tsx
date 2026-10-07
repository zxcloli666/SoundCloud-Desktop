import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { getCacheSize, getLikedCacheSize } from '../../../lib/cache';
import { formatBytes } from '../../../lib/formatters';
import { ArrowRight, FolderInput, HardDrive, Loader2 } from '../../../lib/icons';
import {
  relocateErrorKey,
  relocateStorage,
  restartApp,
  useRelocateProgress,
} from '../../../lib/storage-location';
import { Modal, ModalContent, ModalDescription, ModalTitle } from '../../ui/Modal';
import { Skeleton } from '../../ui/Skeleton';

export interface RelocateTarget {
  picked: string | null;
  display: string;
}

type Phase = 'confirm' | 'moving' | 'restarting';

const PLAIN_TILE = {
  background: 'rgba(255,255,255,0.03)',
  border: '0.5px solid rgba(255,255,255,0.08)',
};

const ACCENT_TILE = {
  background: 'linear-gradient(135deg, var(--color-accent-glow), rgba(255,255,255,0.02))',
  border: '0.5px solid var(--color-accent-glow)',
};

const ICON_BADGE = {
  background: 'linear-gradient(135deg, var(--color-accent-glow), rgba(255,255,255,0.04))',
  border: '0.5px solid var(--color-accent-glow)',
  boxShadow: '0 0 18px var(--color-accent-glow), inset 0 1px 0 rgba(255,255,255,0.18)',
};

function PathTile({ label, path, accent }: { label: string; path: string; accent?: boolean }) {
  return (
    <div className="min-w-0 flex-1 rounded-2xl px-4 py-3" style={accent ? ACCENT_TILE : PLAIN_TILE}>
      <p className="text-[10.5px] uppercase tracking-[0.12em] text-white/35 font-semibold">
        {label}
      </p>
      <p className="mt-1 text-[12px] text-white/80 font-mono truncate" title={path} dir="rtl">
        <bdi>{path}</bdi>
      </p>
    </div>
  );
}

function MoveProgress() {
  const { t } = useTranslation();
  const progress = useRelocateProgress(true);
  const pct =
    progress && progress.totalBytes > 0
      ? Math.min(100, Math.round((progress.bytes / progress.totalBytes) * 100))
      : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[12px] text-white/60 tabular-nums">
        <span className="flex items-center gap-2">
          <Loader2 size={12} className="animate-spin" />
          {progress
            ? t('settings.storageMoveFiles', { done: progress.files, total: progress.totalFiles })
            : t('settings.storageMovePreparing')}
        </span>
        {progress && (
          <span>
            {formatBytes(progress.bytes)} / {formatBytes(progress.totalBytes)}
          </span>
        )}
      </div>
      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className="h-full bg-[var(--color-accent)] transition-[width] duration-300 shadow-[0_0_12px_var(--color-accent-glow)]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[11.5px] text-white/35">{t('settings.storageMoveKeepOpen')}</p>
    </div>
  );
}

export function StorageRelocateDialog({
  from,
  target,
  onClose,
}: {
  from: string;
  target: RelocateTarget | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>('confirm');
  const [cacheSize, setCacheSize] = useState<number | null>(null);
  const open = target !== null;

  useEffect(() => {
    if (!open) return;
    setPhase('confirm');
    setCacheSize(null);
    void Promise.all([getCacheSize(), getLikedCacheSize()])
      .then(([audio, liked]) => setCacheSize(audio + liked))
      .catch(() => setCacheSize(0));
  }, [open]);

  const run = async (moveFiles: boolean) => {
    if (!target) return;
    setPhase(moveFiles ? 'moving' : 'restarting');
    try {
      await relocateStorage(target.picked, moveFiles);
      setPhase('restarting');
      await restartApp();
    } catch (error) {
      toast.error(t(relocateErrorKey(error)));
      setPhase('confirm');
    }
  };

  const busy = phase !== 'confirm';

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
    >
      <ModalContent size="md" showClose={!busy}>
        <div className="px-7 pt-7 pb-6 space-y-5">
          <div className="flex items-center gap-3 pr-8">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 text-[var(--color-accent)]"
              style={ICON_BADGE}
            >
              <HardDrive size={18} />
            </div>
            <div className="min-w-0">
              <ModalTitle>{t('settings.storageMoveTitle')}</ModalTitle>
              <ModalDescription>{t('settings.storageMoveDesc')}</ModalDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <PathTile label={t('settings.storageFrom')} path={from} />
            <ArrowRight size={16} className="shrink-0 text-white/30" />
            <PathTile label={t('settings.storageTo')} path={target?.display ?? ''} accent />
          </div>

          {phase === 'moving' ? (
            <MoveProgress />
          ) : phase === 'restarting' ? (
            <div className="flex items-center gap-2 text-[12.5px] text-white/60">
              <Loader2 size={13} className="animate-spin" />
              {t('settings.storageRestarting')}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-2xl px-4 py-3 bg-white/[0.03] border border-white/[0.06]">
                <span className="text-[12.5px] text-white/55">{t('settings.storageMoveSize')}</span>
                {cacheSize === null ? (
                  <Skeleton className="w-16 h-[16px]" />
                ) : (
                  <span className="text-[14px] font-bold text-white/90 tabular-nums">
                    {formatBytes(cacheSize)}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => void run(true)}
                  className="w-full py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-[13px] text-accent-contrast font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-[0_0_20px_var(--color-accent-glow)]"
                >
                  <FolderInput size={14} />
                  {t('settings.storageMoveAndRestart')}
                </button>
                <button
                  type="button"
                  onClick={() => void run(false)}
                  className="w-full py-2.5 rounded-xl text-[12.5px] font-semibold bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white/80 border border-white/[0.06] transition-all duration-200 cursor-pointer"
                >
                  {t('settings.storageStartEmpty')}
                </button>
                <p className="text-[11px] text-white/30 text-center leading-snug">
                  {t('settings.storageOldRemoved')}
                </p>
              </div>
            </>
          )}
        </div>
      </ModalContent>
    </Modal>
  );
}
