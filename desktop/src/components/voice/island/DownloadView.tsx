import { useTranslation } from 'react-i18next';
import { HardDrive } from '../../../lib/icons';
import type { ModelSummary } from '../../../lib/voice/runtime';
import { percent, useFormatBytes } from '../format';
import { useOpenVoiceSettings } from '../nav';

export function DownloadView({ summary }: { summary: ModelSummary }) {
  const { t } = useTranslation();
  const open = useOpenVoiceSettings();
  const bytes = useFormatBytes();
  const pct = percent(summary.done, summary.total);
  return (
    <button
      type="button"
      onClick={open}
      aria-label={t('voice.hud.openModels')}
      className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left focus-visible:outline-none"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
        <HardDrive size={15} />
      </span>
      <span className="min-w-0 flex-1 space-y-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-[12px] font-semibold text-ink-85">
            {t('voice.hud.downloading')}
          </span>
          <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-60">{pct}%</span>
        </span>
        <span className="relative block h-1.5 overflow-hidden rounded-full bg-ink/[0.08]">
          <span
            className="absolute inset-y-0 left-0 w-full origin-left rounded-full bg-accent transition-transform duration-500 ease-out"
            style={{ transform: `scaleX(${pct / 100})` }}
          />
        </span>
        <span className="block font-mono text-[10.5px] tabular-nums text-ink-40">
          {bytes(summary.done)} / {bytes(summary.total)}
        </span>
      </span>
    </button>
  );
}
