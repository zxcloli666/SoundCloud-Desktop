import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { trackedInvoke as invoke } from '../../../lib/diagnostics';
import { Check, ClipboardCopy, FileText, FolderOpen } from '../../../lib/icons';
import { Skeleton } from '../../ui/Skeleton';
import { Card } from '../primitives';

const COPIED_RESET_MS = 1800;

export function DiagnosticsCard() {
  const { t } = useTranslation();
  const [logDir, setLogDir] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    invoke<string>('diagnostics_log_dir')
      .then(setLogDir)
      .catch(() => setLogDir(''));
  }, []);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), COPIED_RESET_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const openFolder = () => {
    invoke('diagnostics_open_log_dir').catch(() => toast.error(t('settings.logFolderFailed')));
  };

  const copyPath = () => {
    if (!logDir) return;
    navigator.clipboard
      .writeText(logDir)
      .then(() => {
        setCopied(true);
        toast.success(t('settings.logPathCopied'));
      })
      .catch(() => toast.error(t('common.error')));
  };

  return (
    <Card
      title={t('settings.diagnostics')}
      desc={t('settings.diagnosticsDesc')}
      icon={<FileText size={17} />}
    >
      <p className="text-[13px] text-white/60 font-medium mb-2">{t('settings.logFolder')}</p>
      <div className="flex items-center gap-2 rounded-2xl bg-black/20 border border-white/[0.06] px-3.5 py-2.5">
        {logDir === null ? (
          <Skeleton className="h-[16px] flex-1" />
        ) : (
          <code
            className="flex-1 min-w-0 truncate text-[12px] text-white/70 font-mono select-text"
            title={logDir}
          >
            {logDir || '—'}
          </code>
        )}
        <button
          type="button"
          onClick={copyPath}
          disabled={!logDir}
          aria-label={t('settings.copyLogPath')}
          title={t('settings.copyLogPath')}
          className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-white/50 hover:text-white/85 hover:bg-white/[0.08] transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {copied ? (
            <Check size={14} className="text-[var(--color-accent)]" />
          ) : (
            <ClipboardCopy size={14} />
          )}
        </button>
      </div>
      <div className="flex mt-3">
        <button
          type="button"
          onClick={openFolder}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-semibold bg-white/[0.06] text-white/75 hover:bg-white/[0.1] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-200 cursor-pointer"
        >
          <FolderOpen size={12} />
          {t('settings.openLogFolder')}
        </button>
      </div>
    </Card>
  );
}
