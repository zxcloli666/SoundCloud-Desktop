import {memo} from 'react';
import {useTranslation} from 'react-i18next';
import {parseCssColor, type Rgb, rgbaCss, rgbCss} from '../../lib/genre-aura';
import {AudioLines} from '../../lib/icons';
import {usePerfMode} from '../../lib/perf';
import type {GenreShare} from '../search/utils';

/** The signature: your top genres as a row of luminous light-columns. Height is
 *  how much of your collection that genre owns, colour is the genre itself. Also a
 *  switcher — tap a column to retint the whole library to that genre and filter to
 *  it; tap it again to clear. */
export const SoundprintBars = memo(function SoundprintBars({
                                                               spectrum,
                                                               selected,
                                                               onSelect,
                                                           }: {
    spectrum: GenreShare[];
    selected: string | null;
    onSelect: (genre: string | null) => void;
}) {
    const {t} = useTranslation();
    const perf = usePerfMode();
    if (spectrum.length === 0) return null;
    const max = spectrum[0].share || 1;
    const hasSel = selected != null;

    return (
        <div data-ui="soundprint">
            <div className="flex items-center gap-2 mb-3">
                <AudioLines size={13} style={{color: spectrum[0].color}}/>
                <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-ink-45">
          {t('library.soundprint')}
        </span>
            </div>
            <div className="flex items-end gap-2 h-[88px]">
                {spectrum.map((g, i) => {
                    const rgb: Rgb = parseCssColor(g.color) ?? [255, 255, 255];
                    const h = 32 + (g.share / max) * 68;
                    const isSel = selected === g.genre;
                    const breathe =
                        perf.idleAnim && i > 0
                            ? `sp-breathe ${(5.5 + i * 0.6).toFixed(1)}s ease-in-out ${(0.3 + i * 0.18).toFixed(2)}s infinite`
                            : undefined;
                    return (
                        <button
                            type="button"
                            key={g.genre}
                            onClick={() => onSelect(isSel ? null : g.genre)}
                            title={g.genre}
                            className="group/sp flex-1 min-w-0 flex flex-col h-full cursor-pointer transition-opacity duration-300"
                            style={{
                                animation: `sp-rise 620ms cubic-bezier(0.2,0.8,0.2,1) ${(i * 0.07).toFixed(2)}s both`,
                                opacity: hasSel && !isSel ? 0.45 : 1,
                            }}
                        >
                            <div className="relative flex-1 flex items-end">
                                <div
                                    className="sp-breathe w-full rounded-t-[7px] transition-[filter,box-shadow] duration-300"
                                    style={{
                                        height: `${h}%`,
                                        transformOrigin: 'bottom',
                                        background: `linear-gradient(180deg, ${rgbCss(rgb)}, ${rgbaCss(rgb, 0.12)})`,
                                        boxShadow: isSel
                                            ? `0 0 26px ${rgbaCss(rgb, 0.6)}, inset 0 1px 0 ${rgbaCss(rgb, 0.85)}`
                                            : perf.glow
                                                ? `0 0 18px ${rgbaCss(rgb, 0.33)}, inset 0 1px 0 ${rgbaCss(rgb, 0.85)}`
                                                : `inset 0 1px 0 ${rgbaCss(rgb, 0.85)}`,
                                        filter: isSel ? 'saturate(1.2) brightness(1.08)' : undefined,
                                        animation: breathe,
                                    }}
                                />
                            </div>
                            <span
                                className={`mt-2.5 text-[10.5px] capitalize truncate text-center transition-colors ${
                                    isSel ? 'text-ink' : 'text-ink-55 group-hover/sp:text-ink-95'
                                }`}
                            >
                {g.genre}
              </span>
                            <span className="text-[9px] tabular-nums text-center text-ink-30">
                {Math.round(g.share * 100)}%
              </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
});
