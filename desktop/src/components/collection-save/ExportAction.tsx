import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ExportFormat } from '../../lib/cache';
import type { ExportJob } from '../../lib/collection-export';
import { FolderInput } from '../../lib/icons';
import { ActionTile } from './ActionTile';
import { ProgressCard } from './ProgressCard';

const FORMATS: ExportFormat[] = ['m4a', 'mp3'];

const FormatSwitch = React.memo(function FormatSwitch({
  format,
  mp3Supported,
  onFormat,
}: {
  format: ExportFormat;
  mp3Supported: boolean;
  onFormat: (format: ExportFormat) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2 px-1">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white/30">
        {t('collectionSave.format')}
      </span>
      <div className="ml-auto flex gap-0.5 rounded-[10px] border border-white/[0.07] bg-white/[0.02] p-[3px]">
        {FORMATS.map((value) => {
          const disabled = value === 'mp3' && !mp3Supported;
          const active = format === value;
          return (
            <button
              key={value}
              type="button"
              disabled={disabled}
              onClick={() => onFormat(value)}
              title={
                disabled
                  ? t('collectionSave.mp3Unavailable')
                  : t(`collectionSave.formatHint_${value}`)
              }
              className={`cursor-pointer rounded-[7px] px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                active
                  ? 'bg-white/[0.09] text-white/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                  : 'text-white/45 hover:text-white/80'
              }`}
            >
              {value}
            </button>
          );
        })}
      </div>
    </div>
  );
});

function progressLabel(job: ExportJob, t: (key: string) => string): string {
  if (job.cancelling) return t('collectionSave.exportStopping');
  if (job.status === 'preparing') return t('collectionSave.cachePreparing');
  return t('collectionSave.exportProgress');
}

export const ExportAction = React.memo(function ExportAction({
  job,
  busy,
  format,
  mp3Supported,
  onFormat,
  onStart,
  onCancel,
}: {
  job: ExportJob | null;
  busy: boolean;
  format: ExportFormat;
  mp3Supported: boolean;
  onFormat: (format: ExportFormat) => void;
  onStart: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();

  if (job) {
    return (
      <ProgressCard
        label={progressLabel(job, t)}
        counts={job.status === 'running' ? job : null}
        onCancel={job.cancelling ? undefined : onCancel}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <ActionTile
        icon={<FolderInput size={16} />}
        title={t('collectionSave.exportTitle')}
        subtitle={t('collectionSave.exportSub', { format: format.toUpperCase() })}
        footnote={t(`collectionSave.formatHint_${format}`)}
        hint={busy ? t('collectionSave.busyHint') : undefined}
        disabled={busy}
        onClick={onStart}
      />
      <FormatSwitch format={format} mp3Supported={mp3Supported} onFormat={onFormat} />
    </div>
  );
});
