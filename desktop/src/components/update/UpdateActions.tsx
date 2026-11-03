import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { logError } from '../../lib/diagnostics';
import { RotateCcw } from '../../lib/icons';
import type { GithubRelease } from '../../lib/update-check';
import {
  getUpdaterInfo,
  installUpdate,
  type InstallProgress as Progress,
  type UpdaterInfo,
} from '../../lib/updater';
import { InstallProgress } from './InstallProgress';
import { ManualUpdate } from './ManualUpdate';

type Phase = 'idle' | 'downloading' | 'installing' | 'failed';

const STALL_MS = 25_000;

export function UpdateActions({
  release,
  onDismiss,
}: {
  release: GithubRelease;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const [info, setInfo] = useState<UpdaterInfo | null | undefined>(undefined);
  const [phase, setPhase] = useState<Phase>('idle');
  const [downloaded, setDownloaded] = useState(0);
  const [total, setTotal] = useState<number | null>(null);
  const [stalled, setStalled] = useState(false);
  const lastProgressAt = useRef(0);

  useEffect(() => {
    getUpdaterInfo()
      .then(setInfo)
      .catch(() => setInfo(null));
  }, []);

  useEffect(() => {
    if (phase !== 'downloading') return;
    const timer = setInterval(() => {
      setStalled(Date.now() - lastProgressAt.current >= STALL_MS);
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  const onProgress = (progress: Progress) => {
    lastProgressAt.current = Date.now();
    if (progress.event === 'installing') {
      setPhase('installing');
      return;
    }
    setTotal(progress.data.total);
    setDownloaded(progress.event === 'progress' ? progress.data.downloaded : 0);
  };

  const install = () => {
    lastProgressAt.current = Date.now();
    setPhase('downloading');
    setStalled(false);
    setDownloaded(0);
    setTotal(null);
    installUpdate(onProgress).catch((error) => {
      logError(`[Update] install failed: ${String(error)}`);
      setPhase('failed');
    });
  };

  if (phase === 'downloading' || phase === 'installing') {
    return (
      <>
        <InstallProgress
          downloaded={downloaded}
          total={total}
          installing={phase === 'installing'}
        />
        {stalled && phase === 'downloading' && (
          <ManualUpdate
            release={release}
            info={info ?? null}
            notice="stalled"
            onDismiss={onDismiss}
          />
        )}
      </>
    );
  }

  if (info === undefined) return null;

  if (!info?.selfUpdate || phase === 'failed') {
    return (
      <ManualUpdate
        release={release}
        info={info}
        notice={phase === 'failed' ? 'failed' : null}
        onDismiss={onDismiss}
      />
    );
  }

  return (
    <div className="px-5 pb-5">
      <p className="mb-4 px-0.5 text-[11.5px] leading-relaxed text-ink-40">
        {t(info.os === 'windows' ? 'update.autoHintWindows' : 'update.autoHint')}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onDismiss}
          className="flex-1 py-2.5 rounded-xl bg-ink/[0.05] hover:bg-ink/[0.08] text-[13px] text-ink-50 font-medium transition-colors cursor-pointer"
        >
          {t('update.later')}
        </button>
        <button
          type="button"
          onClick={install}
          className="flex-[1.4] py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-[13px] text-accent-contrast font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-[0_0_20px_var(--color-accent-glow)]"
        >
          <RotateCcw size={13} />
          {t('update.installRestart')}
        </button>
      </div>
    </div>
  );
}
