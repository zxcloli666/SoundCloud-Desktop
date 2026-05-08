import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/shallow';
import { isYmImportBusy, useYmImportStore } from '../../stores/ym-import';

export default function YMImportFloatingStatus() {
  const { t } = useTranslation();
  const { phase, saving, progress } = useYmImportStore(
    useShallow((state) => ({
      phase: state.phase,
      saving: state.saving,
      progress: state.progress,
    })),
  );

  if (!isYmImportBusy({ phase, saving }) || !progress) {
    return null;
  }

  const pct =
    progress.total > 0 ? Math.max(0, Math.min(100, (progress.current / progress.total) * 100)) : 0;
  const glowLeft = pct <= 0 ? '0px' : pct >= 100 ? 'calc(100% - 14px)' : `calc(${pct}% - 7px)`;

  return (
    <div className="pointer-events-none fixed top-5 right-5 z-[70] animate-fade-in-up">
      <div className="liquid-panel relative min-w-[220px] overflow-hidden rounded-[24px] px-4 py-3">
        <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.18),rgba(255,255,255,0.05)_34%,rgba(255,255,255,0.02)_68%,rgba(255,255,255,0.08)_100%)]" />
        <div className="absolute inset-x-6 top-0 h-px bg-white/25" />
        <div className="absolute -left-8 top-0 h-full w-16 rotate-12 bg-white/[0.1] blur-2xl" />
        <div className="absolute -right-8 bottom-0 h-10 w-20 rounded-full bg-accent/20 blur-2xl" />
        <div className="relative space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">
              {t('settings.importYandex')}
            </p>
            <p className="font-mono text-[11px] text-white/82">
              {progress.current}/{progress.total}
            </p>
          </div>
          <div className="relative h-2.5 overflow-hidden rounded-full bg-white/[0.08] ring-1 ring-white/[0.06]">
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.1),rgba(255,255,255,0.02))]" />
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,var(--color-accent-hover),var(--color-accent)_58%,rgba(255,255,255,0.92))] shadow-[0_0_12px_color-mix(in_srgb,var(--color-accent-glow)_100%,transparent),0_0_28px_color-mix(in_srgb,var(--color-accent-glow)_100%,transparent)] transition-[width] duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
            <div
              className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border border-white/45 bg-white shadow-[0_0_10px_rgba(255,255,255,0.85),0_0_18px_color-mix(in_srgb,var(--color-accent-glow)_100%,transparent)] transition-[left] duration-500 ease-out"
              style={{ left: glowLeft }}
            />
          </div>
          <p className="text-[10px] text-white/42">{t('ym.backgroundHint')}</p>
        </div>
      </div>
    </div>
  );
}
