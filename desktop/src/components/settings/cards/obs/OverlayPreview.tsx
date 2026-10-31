import { useTranslation } from 'react-i18next';
import { usePlayerStore } from '../../../../stores/player';

const CHECKER =
  'conic-gradient(rgb(var(--ink) / 0.035) 25%, transparent 0 50%, rgb(var(--ink) / 0.035) 0 75%, transparent 0) 0 0 / 14px 14px';

export function OverlayPreview({ url }: { url: string }) {
  const { t } = useTranslation();
  const hasTrack = usePlayerStore((s) => !!s.currentTrack);

  return (
    <div
      data-scheme="dark"
      className="relative h-[156px] overflow-hidden rounded-xl border border-ink/[0.06]"
      style={{ background: `${CHECKER}, rgba(0,0,0,0.35)` }}
    >
      <iframe
        key={url}
        src={url}
        title="overlay"
        className="pointer-events-none absolute inset-0 size-full border-0"
        style={{ colorScheme: 'normal' }}
      />
      {!hasTrack && (
        <p className="absolute inset-0 flex items-center justify-center text-[12px] text-ink-30">
          {t('settings.obsPreviewEmpty')}
        </p>
      )}
      <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1.5 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-70">
        <span className="size-1.5 animate-pulse rounded-full bg-[#ff3b30] shadow-[0_0_6px_#ff3b30]" />
        {t('settings.obsPreviewLive')}
      </span>
    </div>
  );
}
