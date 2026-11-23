import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { setReporting } from '../../../lib/diag';
import { trackedInvoke as invoke } from '../../../lib/diagnostics';
import { Check, ClipboardCopy, FileText, FolderOpen } from '../../../lib/icons';
import { useSettingsStore } from '../../../stores/settings';
import { Skeleton } from '../../ui/Skeleton';
import { Block, Card, Row, Toggle } from '../primitives';

const COPIED_RESET_MS = 1800;

export function DiagnosticsCard() {
  const { t } = useTranslation();
  const [logDir, setLogDir] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const sendErrorReports = useSettingsStore((s) => s.sendErrorReports);
  const setSendErrorReports = useSettingsStore((s) => s.setSendErrorReports);

  const toggleReports = () => {
    setSendErrorReports(!sendErrorReports);
    setReporting(!sendErrorReports);
  };

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
      action={
        <button type="button" onClick={openFolder} className="set-btn">
          <FolderOpen size={13} />
          {t('settings.openLogFolder')}
        </button>
      }
    >
      <Block className="space-y-2">
        <p className="text-[12px] text-ink-50">{t('settings.logFolder')}</p>
        <div className="flex h-10 items-center gap-2 rounded-[10px] border border-[color:var(--set-line)] bg-[var(--set-well)] pr-1 pl-3">
          {logDir === null ? (
            <Skeleton className="h-[16px] flex-1" />
          ) : (
            <code
              className="min-w-0 flex-1 select-text truncate font-mono text-[12px] text-ink-75"
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
            className="set-btn w-8 px-0"
            data-tone="quiet"
          >
            {copied ? (
              <Check size={14} className="text-[var(--color-accent)]" />
            ) : (
              <ClipboardCopy size={14} />
            )}
          </button>
        </div>
      </Block>
      <Row title={t('diag.sendReports')} desc={t('diag.sendReportsDesc')}>
        <Toggle checked={sendErrorReports} onChange={toggleReports} label={t('diag.sendReports')} />
      </Row>
    </Card>
  );
}
