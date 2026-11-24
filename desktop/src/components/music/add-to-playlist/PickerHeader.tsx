import { useTranslation } from 'react-i18next';
import { art } from '../../../lib/formatters';
import { ListMusic } from '../../../lib/icons';
import { usePerfMode } from '../../../lib/perf';
import { useTrackDisplay } from '../../../lib/track-display';
import type { Track } from '../../../stores/player';
import { ModalDescription, ModalTitle } from '../../ui/Modal';

const FADE = 'linear-gradient(#000 10%, transparent)';

export function PickerHeader({ track }: { track: Track }) {
  const { t } = useTranslation();
  const perf = usePerfMode();
  const display = useTrackDisplay(track);
  const cover = art(track.artwork_url, 't200x200');
  const blur = perf.blur(44);

  return (
    <header className="relative px-5 pb-4 pt-5">
      {cover && blur > 0 && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-10 h-56 overflow-hidden opacity-45"
          style={{ maskImage: FADE, WebkitMaskImage: FADE }}
        >
          <img
            src={cover}
            alt=""
            className="h-full w-full scale-125 object-cover saturate-150"
            style={{ filter: `blur(${blur}px)` }}
          />
        </div>
      )}
      <div className="relative flex items-center gap-4 pr-9">
        <div className="flex size-[72px] shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-ink/[0.06] shadow-lg ring-1 ring-ink/[0.1]">
          {cover ? (
            <img src={cover} alt="" className="h-full w-full object-cover" decoding="async" />
          ) : (
            <ListMusic size={24} className="text-ink-30" />
          )}
        </div>
        <div className="min-w-0">
          <ModalDescription className="mb-1 text-[11.5px] font-semibold text-ink-55">
            {t('playlist.addToPlaylist')}
          </ModalDescription>
          <ModalTitle className="truncate text-[17px] font-bold leading-tight tracking-tight text-ink-95">
            {display.title}
          </ModalTitle>
          <p className="mt-0.5 truncate text-[12.5px] text-ink-60">{display.artistLine}</p>
        </div>
      </div>
    </header>
  );
}
