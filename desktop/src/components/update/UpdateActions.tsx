import { useEffect, useState } from 'react';
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

  useEffect(() => {
    getUpdaterInfo()
      .then(setInfo)
      .catch(() => setInfo(null));
  }, []);

  const onProgress = (progress: Progress) => {
    if (progress.event === 'installing') {
      setPhase('installing');
      return;
    }
    setTotal(progress.data.total);
    if (progress.event === 'progress') setDownloaded(progress.data.downloaded);
  };

  const install = () => {
    setPhase('downloading');
    setDownloaded(0);
    setTotal(null);
    installUpdate(onProgress).catch((error) => {
      logError(`[Update] install failed: ${String(error)}`);
      setPhase('failed');
    });
  };

  if (phase === 'downloading' || phase === 'installing') {
    return (
      <InstallProgress downloaded={downloaded} total={total} installing={phase === 'installing'} />
    );
  }

  if (info === undefined) return null;

  if (!info?.selfUpdate || phase === 'failed') {
    return (
      <ManualUpdate
        release={release}
        info={info}
        failed={phase === 'failed'}
        onDismiss={onDismiss}
      />
    );
  }

  return (
    <div className="px-5 pb-5">
      <p className="mb-4 px-0.5 text-[11.5px] leading-relaxed text-white/40">
        {t(info.os === 'windows' ? 'update.autoHintWindows' : 'update.autoHint')}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onDismiss}
          className="flex-1 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] text-[13px] text-white/50 font-medium transition-colors cursor-pointer"
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
