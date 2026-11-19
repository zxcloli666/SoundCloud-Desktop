import { useTranslation } from 'react-i18next';
import { art } from '../../lib/formatters';
import { Loader2, Waves } from '../../lib/icons';
import type { Track } from '../../stores/player';

const FAN = 5;
const TILT = [-9, -4.5, 0, 4.5, 9];

export function SearchWaveTail({
  found,
  busy,
  onContinue,
}: {
  found: Track[];
  busy: boolean;
  onContinue: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      data-ui="search-wave-tail"
      className="flex h-full w-full flex-col items-center justify-center gap-9 px-6 pb-14"
    >
      <div className="flex items-end pl-8">
        {found.slice(0, FAN).map((track, i) => (
          <TailCover key={track.urn} track={track} tilt={TILT[i] ?? 0} />
        ))}
      </div>
      <button
        type="button"
        data-no-drag
        onClick={onContinue}
        disabled={busy}
        className="flex h-12 cursor-pointer items-center gap-2.5 rounded-full bg-accent px-6 text-[14px] font-semibold text-accent-contrast shadow-[0_6px_24px_var(--color-accent-glow),inset_0_1px_0_rgba(255,255,255,0.25)] transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-default disabled:hover:translate-y-0"
      >
        {busy ? <Loader2 size={17} className="animate-spin" /> : <Waves size={17} />}
        {t('search.view.continueWave')}
      </button>
    </div>
  );
}

function TailCover({ track, tilt }: { track: Track; tilt: number }) {
  const cover = art(track.artwork_url, 't300x300');
  return (
    <span
      className="-ml-8 size-[min(22vh,132px)] shrink-0 overflow-hidden rounded-2xl ring-1 ring-ink/[0.1] shadow-[0_18px_44px_rgb(var(--shade)/calc(0.5*var(--shade-alpha)))]"
      style={{ transform: `rotate(${tilt}deg)` }}
    >
      {cover ? (
        <img src={cover} alt="" draggable={false} className="size-full object-cover" />
      ) : (
        <span className="block size-full bg-ink/[0.06]" />
      )}
    </span>
  );
}
