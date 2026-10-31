import {useCallback, useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {toScproxyUrl} from '../../../lib/asset-url';
import {Check, Loader2, Lock, Search} from '../../../lib/icons';
import {
    searchWallpapers,
    sourceCaps,
    WALLPAPER_COLORS,
    WALLPAPER_SOURCES,
    type WallpaperCategory,
    type WallpaperHit,
    type WallpaperSource,
} from '../../../lib/wallpapers';
import {useSettingsStore} from '../../../stores/settings';
import {Segmented} from '../primitives';

/** Online wallpaper finder embedded in the appearance card. Searches Wallhaven
 *  (categories + colour), Konachan & Safebooru (tag-based anime art). Pick →
 *  parent downloads & applies. Adult content is opt-in; Wallhaven NSFW needs a
 *  personal API key. */
export function WallpaperSearch({onPick}: { onPick: (url: string) => Promise<void> | void }) {
    const {t} = useTranslation();
    const apiKey = useSettingsStore((s) => s.wallhavenApiKey);
    const setApiKey = useSettingsStore((s) => s.setWallhavenApiKey);

    const [source, setSource] = useState<WallpaperSource>('wallhaven');
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState<WallpaperCategory>('anime');
    const [color, setColor] = useState<string | null>(null);
    const [adult, setAdult] = useState(false);
    const [items, setItems] = useState<WallpaperHit[]>([]);
    const [cursor, setCursor] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [picking, setPicking] = useState<string | null>(null);
    const reqId = useRef(0);

    const caps = sourceCaps(source);
    const keyTrimmed = apiKey.trim();
    const adultBlocked = adult && caps.adultNeedsKey && !keyTrimmed;

    const run = useCallback(
        async (nextCursor: string | null, append: boolean) => {
            const id = ++reqId.current;
            setLoading(true);
            setError(false);
            try {
                const res = await searchWallpapers({
                    source,
                    query,
                    category,
                    color,
                    adult,
                    apiKey,
                    cursor: nextCursor,
                });
                if (id !== reqId.current) return; // stale
                setCursor(res.cursor);
                setItems((prev) => (append ? [...prev, ...res.items] : res.items));
            } catch {
                if (id !== reqId.current) return;
                setError(true);
                if (!append) setItems([]);
            } finally {
                if (id === reqId.current) setLoading(false);
            }
        },
        [source, query, category, color, adult, apiKey],
    );

    // Debounced fresh search whenever any input changes.
    // biome-ignore lint/correctness/useExhaustiveDependencies: run already closes over these deps
    useEffect(() => {
        const tmr = setTimeout(() => void run(null, false), query || keyTrimmed ? 420 : 0);
        return () => clearTimeout(tmr);
    }, [source, query, category, color, adult, apiKey]);

    const handlePick = useCallback(
        async (hit: WallpaperHit) => {
            if (picking) return;
            setPicking(hit.id);
            try {
                await onPick(hit.full);
            } finally {
                setPicking(null);
            }
        },
        [onPick, picking],
    );

    return (
        <div className="mt-4 rounded-2xl border border-ink/[0.06] bg-shade-20 p-4 space-y-3.5">
            {/* source */}
            <Segmented
                value={source}
                columns={WALLPAPER_SOURCES.length}
                onChange={setSource}
                options={WALLPAPER_SOURCES.map((s) => ({id: s.id, label: s.label}))}
            />

            {/* search + category */}
            <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                    <Search
                        size={15}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-35 pointer-events-none"
                    />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={caps.tagBased ? t('settings.wpTags') : t('settings.wpPlaceholder')}
                        className="w-full h-10 pl-9 pr-3 rounded-xl bg-ink/[0.05] border border-ink/[0.08] text-[13px] text-ink-85 placeholder:text-ink-30 outline-none focus:border-[var(--color-accent)] transition-colors"
                    />
                </div>
                {caps.category && (
                    <div className="sm:w-[260px]">
                        <Segmented
                            value={category}
                            columns={3}
                            onChange={setCategory}
                            options={[
                                {id: 'anime', label: t('settings.wpAnime')},
                                {id: 'general', label: t('settings.wpGeneral')},
                                {id: 'people', label: t('settings.wpPeople')},
                            ]}
                        />
                    </div>
                )}
            </div>

            {/* colour palette */}
            {caps.color && (
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-ink-40 mr-1">{t('settings.wpColor')}</span>
                    <button
                        type="button"
                        onClick={() => setColor(null)}
                        className={`h-6 px-2.5 rounded-full text-[10.5px] font-semibold border transition-all ${
                            color === null
                                ? 'text-ink border-ink/30 bg-ink/[0.08]'
                                : 'text-ink-45 border-ink/[0.08] hover:text-ink-70'
                        }`}
                    >
                        {t('settings.wpAnyColor')}
                    </button>
                    {WALLPAPER_COLORS.map((c) => {
                        const on = color === c;
                        return (
                            <button
                                key={c}
                                type="button"
                                aria-label={`#${c}`}
                                onClick={() => setColor(on ? null : c)}
                                className="w-6 h-6 rounded-full cursor-pointer transition-transform hover:scale-110"
                                style={{
                                    background: `#${c}`,
                                    border: on ? '2px solid rgb(var(--ink))' : '1px solid rgb(var(--ink) / 0.18)',
                                    boxShadow: on ? `0 0 12px #${c}` : undefined,
                                }}
                            />
                        );
                    })}
                </div>
            )}

            {/* adult opt-in + Wallhaven key */}
            {caps.adult && (
                <div className="space-y-2.5">
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <button
                            type="button"
                            onClick={() => setAdult((v) => !v)}
                            className={`h-7 px-3 rounded-full text-[11px] font-bold border transition-all cursor-pointer ${
                                adult
                                    ? 'text-[var(--color-accent-contrast)] bg-[var(--color-accent)] border-transparent'
                                    : 'text-ink-45 border-ink/[0.1] hover:text-ink-75 hover:border-ink/25'
                            }`}
                        >
                            18+
                        </button>
                        <span className="text-[11px] text-ink-35">
              {adult ? t('settings.wpAdultOn') : t('settings.wpAdultOff')}
            </span>
                    </div>

                    {caps.adultNeedsKey && adult && (
                        <div className="space-y-1.5">
                            <div className="relative">
                                <Lock
                                    size={13}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-30 pointer-events-none"
                                />
                                <input
                                    type="password"
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    placeholder={t('settings.wpKeyPlaceholder')}
                                    spellCheck={false}
                                    autoComplete="off"
                                    className={`w-full h-9 pl-8 pr-3 rounded-xl bg-ink/[0.05] border text-[12px] text-ink-85 placeholder:text-ink-25 outline-none transition-colors font-mono tracking-tight ${
                                        adultBlocked
                                            ? 'border-amber-400/40 focus:border-amber-400/70'
                                            : 'border-ink/[0.08] focus:border-[var(--color-accent)]'
                                    }`}
                                />
                            </div>
                            <p className="text-[10.5px] text-ink-30 leading-snug">
                                {adultBlocked ? t('settings.wpKeyNeeded') : t('settings.wpKeyHint')}
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* results */}
            {error ? (
                <div className="py-8 text-center text-[12.5px] text-red-400/80">
                    {t('settings.wpError')}
                </div>
            ) : items.length === 0 && !loading ? (
                <div className="py-8 text-center text-[12.5px] text-ink-35">{t('settings.wpEmpty')}</div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {items.map((hit) => (
                        <button
                            key={hit.id}
                            type="button"
                            onClick={() => handlePick(hit)}
                            className="group relative aspect-video overflow-hidden rounded-xl border border-ink/[0.06] bg-ink/[0.03] cursor-pointer"
                        >
                            <img
                                src={toScproxyUrl(hit.thumb)}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                            <span
                                className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                {picking === hit.id ? (
                    <Loader2 size={20} className="text-ink animate-spin"/>
                ) : (
                    <span
                        className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold text-[var(--color-accent-contrast)] bg-[var(--color-accent)] shadow-[0_8px_22px_var(--color-accent-glow)]">
                    <Check size={12}/>
                        {t('settings.wpSet')}
                  </span>
                )}
              </span>
                            {hit.resolution && (
                                <span
                                    data-scheme="dark"
                                    className="absolute bottom-1 right-1 text-[9px] font-semibold text-ink-85 bg-black/55 backdrop-blur-sm px-1.5 py-0.5 rounded tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">
                  {hit.resolution}
                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {/* footer */}
            <div className="flex items-center justify-between pt-1">
        <span className="text-[10.5px] text-ink-25">
          {WALLPAPER_SOURCES.find((s) => s.id === source)?.label} ·{' '}
            {adult && !adultBlocked ? '18+' : 'SFW'}
        </span>
                {loading ? (
                    <Loader2 size={14} className="animate-spin text-ink-40"/>
                ) : (
                    cursor !== null &&
                    items.length > 0 && (
                        <button
                            type="button"
                            onClick={() => void run(cursor, true)}
                            className="px-3.5 py-1.5 rounded-xl text-[12px] font-semibold bg-ink/[0.06] text-ink-70 hover:bg-ink/[0.1] border border-ink/[0.06] transition-all cursor-pointer"
                        >
                            {t('settings.wpMore')}
                        </button>
                    )
                )}
            </div>
        </div>
    );
}
