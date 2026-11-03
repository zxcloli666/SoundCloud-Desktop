import {useCallback, useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {toast} from 'sonner';
import {
    downloadWallpaper,
    getWallpaperUrl,
    listWallpapers,
    removeWallpaper,
    saveWallpaperFromBuffer,
} from '../../../lib/cache';
import {
    findDesktopWallpaper,
    isDesktopWallpaper,
    syncDesktopWallpaper,
    useDesktopWallpaperLost,
} from '../../../lib/desktop-wallpaper';
import {Check, Link, Loader2, Monitor, MonitorOff, Search, X} from '../../../lib/icons';
import {useSettingsStore} from '../../../stores/settings';
import {Card, RangeSlider} from '../primitives';
import {WallpaperSearch} from './WallpaperSearch';
import {WallpaperSlideshow} from './WallpaperSlideshow';

export function WallpaperCard() {
    const {t} = useTranslation();
    const backgroundImage = useSettingsStore((s) => s.backgroundImage);
    const setBackgroundImage = useSettingsStore((s) => s.setBackgroundImage);
    const backgroundOpacity = useSettingsStore((s) => s.backgroundOpacity);
    const setBackgroundOpacity = useSettingsStore((s) => s.setBackgroundOpacity);
    const backgroundDim = useSettingsStore((s) => s.backgroundDim);
    const setBackgroundDim = useSettingsStore((s) => s.setBackgroundDim);
    const backgroundBlur = useSettingsStore((s) => s.backgroundBlur);
    const setBackgroundBlur = useSettingsStore((s) => s.setBackgroundBlur);
    const rotation = useSettingsStore((s) => s.wallpaperRotation);
    const setRotation = useSettingsStore((s) => s.setWallpaperRotation);
    const rotationNames = useSettingsStore((s) => s.wallpaperRotationNames);
    const setRotationNames = useSettingsStore((s) => s.setWallpaperRotationNames);
    const rotationOrder = useSettingsStore((s) => s.wallpaperRotationOrder);

    const [wallpapers, setWallpapers] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);
    const [urlInput, setUrlInput] = useState('');
    const [showUrlInput, setShowUrlInput] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [desktopFound, setDesktopFound] = useState<boolean>();
    const [brokenDesktop, setBrokenDesktop] = useState<string>();
    const desktopLost = useDesktopWallpaperLost((s) => s.lost);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const followingDesktop = isDesktopWallpaper(backgroundImage);
    const desktopMissing = followingDesktop
        ? desktopLost || brokenDesktop === backgroundImage
        : desktopFound === false;
    const desktopUrl = followingDesktop && !desktopMissing ? getWallpaperUrl(backgroundImage) : null;

    const adopt = useCallback(
        (name: string) => {
            const s = useSettingsStore.getState();
            if (s.wallpaperRotation && !s.wallpaperRotationNames.includes(name)) {
                setRotationNames([...s.wallpaperRotationNames, name]);
            }
            setBackgroundImage(name);
        },
        [setBackgroundImage, setRotationNames],
    );

    const toggleInRotation = useCallback(
        (name: string) => {
            setRotationNames(
                rotationNames.includes(name)
                    ? rotationNames.filter((n) => n !== name)
                    : [...rotationNames, name],
            );
        },
        [rotationNames, setRotationNames],
    );

    const clearBackground = useCallback(() => {
        setRotation(false);
        setBackgroundImage('');
    }, [setRotation, setBackgroundImage]);

    const toggleDesktop = useCallback(async () => {
        const before = useSettingsStore.getState();
        if (isDesktopWallpaper(before.backgroundImage)) {
            setBackgroundImage('');
            return;
        }
        setDesktopFound(undefined);
        const name = await syncDesktopWallpaper();
        setDesktopFound(name !== null);
        const now = useSettingsStore.getState();
        if (
            !name ||
            now.backgroundImage !== before.backgroundImage ||
            now.wallpaperRotation !== before.wallpaperRotation
        )
            return;
        setRotation(false);
        setBackgroundImage(name);
    }, [setRotation, setBackgroundImage]);

    const handlePickOnline = useCallback(
        async (url: string) => {
            try {
                const name = await downloadWallpaper(url);
                setWallpapers((prev) => (prev.includes(name) ? prev : [...prev, name]));
                adopt(name);
                toast.success(t('settings.wallpaperAdded'));
            } catch {
                toast.error(t('settings.bgLoadError'));
            }
        },
        [adopt, t],
    );

    useEffect(() => {
        listWallpapers().then((names) => {
            setWallpapers(names);
            setLoading(false);
        });
        findDesktopWallpaper().then(setDesktopFound);
    }, []);

    const handleFileSelect = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
                const buffer = await file.arrayBuffer();
                const name = await saveWallpaperFromBuffer(buffer, file.name);
                setWallpapers((prev) => [...prev, name]);
                adopt(name);
                toast.success(t('settings.wallpaperAdded'));
            } catch {
                toast.error(t('common.error'));
            }
            e.target.value = '';
        },
        [adopt, t],
    );

    const handleDownloadUrl = useCallback(async () => {
        const url = urlInput.trim();
        if (!url) return;
        setDownloading(true);
        try {
            const name = await downloadWallpaper(url);
            setWallpapers((prev) => [...prev, name]);
            adopt(name);
            setUrlInput('');
            setShowUrlInput(false);
            toast.success(t('settings.wallpaperAdded'));
        } catch {
            toast.error(t('settings.bgLoadError'));
        } finally {
            setDownloading(false);
        }
    }, [urlInput, adopt, t]);

    const handleRemove = useCallback(
        async (name: string) => {
            await removeWallpaper(name);
            setWallpapers((prev) => prev.filter((w) => w !== name));
            const s = useSettingsStore.getState();
            const kept = s.wallpaperRotationNames.filter((n) => n !== name);
            if (kept.length !== s.wallpaperRotationNames.length) setRotationNames(kept);
            if (s.backgroundImage === name) setBackgroundImage(kept[0] ?? '');
        },
        [setBackgroundImage, setRotationNames],
    );

    return (
        <Card title={t('settings.backgroundImage')}>
            <div className="space-y-5">
                <div className="flex flex-wrap gap-3">
                    <button
                        type="button"
                        onClick={clearBackground}
                        className={`w-20 h-14 rounded-xl border-2 transition-all duration-200 cursor-pointer flex items-center justify-center ${
                            !backgroundImage
                                ? 'border-ink/40 bg-ink/[0.08]'
                                : 'border-ink/[0.06] bg-ink/[0.02] hover:border-ink/[0.12]'
                        }`}
                    >
                        <span className="text-[10px] text-ink-40 font-semibold">{t('settings.none')}</span>
                    </button>

                    <button
                        type="button"
                        onClick={toggleDesktop}
                        disabled={!followingDesktop && desktopMissing}
                        aria-pressed={followingDesktop}
                        title={t(desktopMissing ? 'settings.wpDesktopMissing' : 'settings.wpDesktop')}
                        className={`relative w-20 h-14 rounded-xl overflow-hidden border-2 transition-all duration-200 flex flex-col items-center justify-center gap-0.5 ${
                            followingDesktop
                                ? 'border-ink/40 shadow-[0_0_12px_rgba(255,255,255,0.1)] cursor-pointer'
                                : desktopMissing
                                  ? 'border-dashed border-ink/[0.06] cursor-not-allowed'
                                  : 'border-ink/[0.06] hover:border-ink/[0.15] cursor-pointer'
                        }`}
                    >
                        {desktopUrl ? (
                            <>
                                <img
                                    src={desktopUrl}
                                    alt=""
                                    onError={() => setBrokenDesktop(backgroundImage)}
                                    className="absolute inset-0 w-full h-full object-cover"
                                />
                                <span
                                    data-scheme="dark"
                                    className="absolute inset-x-0 bottom-0 py-0.5 bg-black/60 flex items-center justify-center gap-1 text-[9px] text-ink-80 font-medium">
                                    <Monitor size={9}/>
                                    {t('settings.wpDesktop')}
                                </span>
                            </>
                        ) : (
                            <>
                                {desktopMissing ? (
                                    <MonitorOff size={12} className="text-ink-25"/>
                                ) : desktopFound === undefined ? (
                                    <Loader2 size={12} className="animate-spin text-ink-20"/>
                                ) : (
                                    <Monitor size={12} className="text-ink-30"/>
                                )}
                                <span className="text-[9px] text-ink-25 font-medium">{t('settings.wpDesktop')}</span>
                            </>
                        )}
                        {followingDesktop && (
                            <div className="absolute inset-0 bg-ink/10 flex items-center justify-center">
                                <div className="w-4 h-4 rounded-full bg-white shadow-lg"/>
                            </div>
                        )}
                    </button>

                    {wallpapers.map((name) => {
                        const url = getWallpaperUrl(name);
                        const slot = rotation ? rotationNames.indexOf(name) : -1;
                        return (
                            <button
                                type="button"
                                key={name}
                                aria-pressed={rotation ? slot >= 0 : backgroundImage === name}
                                onClick={() =>
                                    rotation
                                        ? toggleInRotation(name)
                                        : setBackgroundImage(backgroundImage === name ? '' : name)
                                }
                                className={`relative group w-20 h-14 rounded-xl overflow-hidden border-2 transition-all duration-200 cursor-pointer ${
                                    slot >= 0
                                        ? ''
                                        : backgroundImage === name
                                          ? 'border-ink/40 shadow-[0_0_12px_rgba(255,255,255,0.1)]'
                                          : 'border-ink/[0.06] hover:border-ink/[0.15]'
                                } ${rotation && slot < 0 ? 'opacity-60 hover:opacity-100' : ''}`}
                                style={
                                    slot >= 0
                                        ? {
                                            borderColor: 'var(--color-accent)',
                                            boxShadow: '0 0 14px var(--color-accent-glow)',
                                        }
                                        : undefined
                                }
                            >
                                {url && <img src={url} alt="" className="w-full h-full object-cover"/>}
                                <span
                                    role="button"
                                    tabIndex={0}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemove(name);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.stopPropagation();
                                            handleRemove(name);
                                        }
                                    }}
                                    className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-red-500/80"
                                >
                  <X size={8} className="text-ink"/>
                </span>
                                {slot >= 0 && (
                                    <span
                                        className="absolute top-0.5 left-0.5 min-w-[16px] h-4 px-1 rounded-full bg-accent text-accent-contrast text-[9px] font-bold flex items-center justify-center shadow-md">
                                        {rotationOrder === 'sequence' ? slot + 1 : <Check size={9}/>}
                                    </span>
                                )}
                                {backgroundImage === name && (
                                    <div className="absolute inset-0 bg-ink/10 flex items-center justify-center">
                                        <div className="w-4 h-4 rounded-full bg-white shadow-lg"/>
                                    </div>
                                )}
                            </button>
                        );
                    })}

                    {loading && (
                        <div
                            className="w-20 h-14 rounded-xl bg-ink/[0.02] border border-ink/[0.06] flex items-center justify-center">
                            <Loader2 size={14} className="animate-spin text-ink-20"/>
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-20 h-14 rounded-xl border-2 border-dashed border-ink/[0.1] hover:border-ink/[0.2] transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 hover:bg-ink/[0.02]"
                    >
                        <span className="text-[14px] text-ink-30 font-light leading-none">+</span>
                        <span className="text-[9px] text-ink-25 font-medium">{t('settings.addFile')}</span>
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                    />

                    <button
                        type="button"
                        onClick={() => setShowUrlInput(!showUrlInput)}
                        className={`w-20 h-14 rounded-xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                            showUrlInput
                                ? 'border-ink/[0.2] bg-ink/[0.04]'
                                : 'border-ink/[0.1] hover:border-ink/[0.2] hover:bg-ink/[0.02]'
                        }`}
                    >
                        <Link size={12} className="text-ink-30"/>
                        <span className="text-[9px] text-ink-25 font-medium">URL</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setShowSearch((v) => !v)}
                        className={`w-20 h-14 rounded-xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                            showSearch
                                ? 'bg-[var(--color-accent-glow)]'
                                : 'border-ink/[0.1] hover:border-ink/[0.2] hover:bg-ink/[0.02]'
                        }`}
                        style={showSearch ? {borderColor: 'var(--color-accent)'} : undefined}
                    >
                        <Search
                            size={12}
                            className={showSearch ? 'text-[var(--color-accent)]' : 'text-ink-30'}
                        />
                        <span className="text-[9px] text-ink-25 font-medium">{t('settings.wpSearch')}</span>
                    </button>
                </div>

                {showSearch && <WallpaperSearch onPick={handlePickOnline}/>}

                {(rotation || wallpapers.length > 1) && <WallpaperSlideshow available={wallpapers}/>}

                {showUrlInput && (
                    <div className="flex gap-2 animate-fade-in-up">
                        <input
                            type="text"
                            value={urlInput}
                            onChange={(e) => setUrlInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleDownloadUrl()}
                            placeholder={t('settings.bgUrlPlaceholder')}
                            className="flex-1 px-4 py-2.5 rounded-xl bg-ink/[0.04] border border-ink/[0.06] text-[13px] text-ink-80 placeholder:text-ink-20 focus:border-ink/[0.12] focus:bg-ink/[0.06] transition-all duration-200 outline-none"
                        />
                        <button
                            type="button"
                            onClick={handleDownloadUrl}
                            disabled={downloading || !urlInput.trim()}
                            className="px-4 py-2.5 rounded-xl text-[12px] font-semibold bg-ink/[0.08] text-ink-70 hover:bg-ink/[0.12] border border-ink/[0.06] transition-all disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                        >
                            {downloading ? (
                                <Loader2 size={14} className="animate-spin"/>
                            ) : (
                                t('settings.download')
                            )}
                        </button>
                    </div>
                )}

                {backgroundImage && (
                    <div className="space-y-4 pt-1">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-[13px] text-ink-50 font-medium">
                                    {t('settings.bgDim')}
                                </label>
                                <span className="text-[12px] text-ink-30 tabular-nums">
                  {Math.round(backgroundDim * 100)}%
                </span>
                            </div>
                            <RangeSlider
                                value={backgroundDim}
                                min={0}
                                max={0.85}
                                step={0.01}
                                onChange={setBackgroundDim}
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-[13px] text-ink-50 font-medium">
                                    {t('settings.bgOpacity')}
                                </label>
                                <span className="text-[12px] text-ink-30 tabular-nums">
                  {Math.round(backgroundOpacity * 100)}%
                </span>
                            </div>
                            <RangeSlider
                                value={backgroundOpacity}
                                min={0}
                                max={0.7}
                                step={0.01}
                                onChange={setBackgroundOpacity}
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-[13px] text-ink-50 font-medium">
                                    {t('settings.bgBlur')}
                                </label>
                                <span className="text-[12px] text-ink-30 tabular-nums">{backgroundBlur}px</span>
                            </div>
                            <RangeSlider
                                value={backgroundBlur}
                                min={0}
                                max={40}
                                step={1}
                                onChange={setBackgroundBlur}
                            />
                        </div>
                    </div>
                )}
            </div>
        </Card>
    );
}
