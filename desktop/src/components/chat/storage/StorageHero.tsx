import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock } from '../../../lib/icons';
import { StarCta } from '../../star-moments/StarCta';
import { useFormatSize } from './bytes';
import { Panel } from './Panel';
import { QuotaRing } from './QuotaRing';
import { quotaFull, quotaShare } from './ring-tone';
import { useStorageStore } from './storage-store';

function Fact({ label, value, tone }: { label: string; value: string; tone?: 'bad' }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[11px] font-medium text-ink-45">{label}</span>
      <span
        className={`truncate text-[14px] font-semibold tabular-nums ${tone === 'bad' ? 'text-bad' : 'text-ink-85'}`}
      >
        {value}
      </span>
    </div>
  );
}

function LapsedNote() {
  const { t } = useTranslation();
  return (
    <div
      data-ui="chat-storage-lapsed"
      className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-accent/25 px-3.5 py-2.5"
      style={{ background: 'linear-gradient(120deg, var(--color-accent-glow), transparent 75%)' }}
    >
      <Lock size={14} className="shrink-0 text-ink-70" />
      <span className="min-w-0 flex-1 text-[12.5px] font-medium text-ink-80">
        {t('chat.storage.lapsed')}
      </span>
      <StarCta size="sm" />
    </div>
  );
}

export const StorageHero = memo(function StorageHero({ lapsed }: { lapsed: boolean }) {
  const { t } = useTranslation();
  const format = useFormatSize();
  const meter = useStorageStore((state) => state.meter);
  const usage = useStorageStore((state) => state.usage);
  if (!meter || !usage) return null;
  const full = quotaFull(meter.used, meter.quota);
  const free = Math.max(0, meter.quota - meter.used);

  return (
    <Panel ui="chat-storage-hero" className="p-5">
      <div className="flex items-center gap-5">
        <QuotaRing used={meter.used} quota={meter.quota} size={124} />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex min-w-0 flex-col">
            <span className="text-[22px] font-bold leading-tight tracking-tight tabular-nums text-ink-92">
              {Math.round(quotaShare(meter.used, meter.quota) * 100)}%
            </span>
            <span className={`text-[12px] font-medium ${full ? 'text-bad' : 'text-ink-50'}`}>
              {full ? t('chat.storage.full') : t('chat.storage.freeLeft', { size: format(free) })}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Fact label={t('chat.storage.facts.files')} value={String(usage.files)} />
            <Fact
              label={t('chat.storage.facts.uploading')}
              value={usage.reserved > 0 ? format(usage.reserved) : '—'}
            />
          </div>
        </div>
      </div>
      {lapsed && <LapsedNote />}
    </Panel>
  );
});
