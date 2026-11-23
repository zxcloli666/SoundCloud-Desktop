import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
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
import {
  Check,
  ImageIcon,
  ImagePlus,
  Link,
  Loader2,
  Monitor,
  MonitorOff,
  Search,
} from '../../../lib/icons';
import { useSettingsStore } from '../../../stores/settings';
import { Block, Card, RangeSlider, Row, Toggle } from '../primitives';
import { WallpaperSearch } from './WallpaperSearch';
import { WallpaperSlideshow } from './WallpaperSlideshow';
import { AddThumb, WallThumb } from './WallpaperTiles';

export function WallpaperCard() {
  const { t } = useTranslation();
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
  const liveBackground = useSettingsStore((s) => s.liveBackground);
  const setLiveBackground = useSettingsStore((s) => s.setLiveBackground);

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
    <Card title={t('settings.backgroundImage')} icon={<ImageIcon size={17} />}>
      <Block>
        <div className="set-thumbs">
          <button
            type="button"
            aria-pressed={!backgroundImage}
            onClick={clearBackground}
            className="set-thumb"
          >
            {t('settings.none')}
          </button>
          <button
            type="button"
            onClick={toggleDesktop}
            disabled={!followingDesktop && desktopMissing}
            aria-pressed={followingDesktop}
            title={t(desktopMissing ? 'settings.wpDesktopMissing' : 'settings.wpDesktop')}
            className="set-thumb"
          >
            {desktopUrl ? (
              <>
                <img
                  src={desktopUrl}
                  alt=""
                  onError={() => setBrokenDesktop(backgroundImage)}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <span
                  data-scheme="dark"
                  className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/55 py-1 text-[10.5px] text-ink-85"
                >
                  <Monitor size={10} />
                  {t('settings.wpDesktop')}
                </span>
              </>
            ) : (
              <>
                {desktopMissing ? (
                  <MonitorOff size={15} />
                ) : desktopFound === undefined ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Monitor size={15} />
                )}
                {t('settings.wpDesktop')}
              </>
            )}
          </button>
          {wallpapers.map((name) => {
            const slot = rotation ? rotationNames.indexOf(name) : -1;
            const picked = backgroundImage === name;
            return (
              <WallThumb
                key={name}
                url={getWallpaperUrl(name)}
                pressed={rotation ? slot >= 0 : picked}
                dim={rotation && slot < 0}
                badge={
                  slot >= 0 ? (
                    rotationOrder === 'sequence' ? (
                      slot + 1
                    ) : (
                      <Check size={11} strokeWidth={3} />
                    )
                  ) : picked ? (
                    <Check size={11} strokeWidth={3} />
                  ) : null
                }
                onClick={() =>
                  rotation ? toggleInRotation(name) : setBackgroundImage(picked ? '' : name)
                }
                onRemove={() => void handleRemove(name)}
              />
            );
          })}
          {loading && (
            <span className="set-thumb">
              <Loader2 size={15} className="animate-spin" />
            </span>
          )}
          <AddThumb
            icon={<ImagePlus size={15} />}
            label={t('settings.addFile')}
            onClick={() => fileInputRef.current?.click()}
          />
          <AddThumb
            icon={<Link size={15} />}
            label="URL"
            pressed={showUrlInput}
            onClick={() => setShowUrlInput(!showUrlInput)}
          />
          <AddThumb
            icon={<Search size={15} />}
            label={t('settings.wpSearch')}
            pressed={showSearch}
            onClick={() => setShowSearch((v) => !v)}
          />
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        {showUrlInput && (
          <div className="mt-3 flex gap-2 animate-fade-in-up">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleDownloadUrl()}
              placeholder={t('settings.bgUrlPlaceholder')}
              className="h-9 min-w-0 flex-1 rounded-[10px] border border-[color:var(--set-line)] bg-[var(--set-well)] px-3 text-[13px] text-ink-90 outline-none transition-colors duration-150 placeholder:text-ink-35 focus:border-accent"
            />
            <button
              type="button"
              onClick={handleDownloadUrl}
              disabled={downloading || !urlInput.trim()}
              className="set-btn h-9"
              data-tone="accent"
            >
              {downloading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                t('settings.download')
              )}
            </button>
          </div>
        )}
        {showSearch && (
          <div className="mt-3">
            <WallpaperSearch onPick={handlePickOnline} />
          </div>
        )}
      </Block>
      {(rotation || wallpapers.length > 1) && <WallpaperSlideshow available={wallpapers} />}
      {backgroundImage && (
        <>
          <Row
            title={t('settings.bgDim')}
            value={<span className="set-chip">{Math.round(backgroundDim * 100)}%</span>}
            stacked
          >
            <RangeSlider
              value={backgroundDim}
              min={0}
              max={0.85}
              step={0.01}
              onChange={setBackgroundDim}
            />
          </Row>
          <Row
            title={t('settings.bgOpacity')}
            value={<span className="set-chip">{Math.round(backgroundOpacity * 100)}%</span>}
            stacked
          >
            <RangeSlider
              value={backgroundOpacity}
              min={0}
              max={0.7}
              step={0.01}
              onChange={setBackgroundOpacity}
            />
          </Row>
          <Row
            title={t('settings.bgBlur')}
            value={<span className="set-chip">{backgroundBlur}px</span>}
            stacked
          >
            <RangeSlider
              value={backgroundBlur}
              min={0}
              max={40}
              step={1}
              onChange={setBackgroundBlur}
            />
          </Row>
        </>
      )}
      <Row title={t('settings.liveBackground')} desc={t('settings.liveBackgroundDesc')}>
        <Toggle
          checked={liveBackground}
          onChange={() => setLiveBackground(!liveBackground)}
          label={t('settings.liveBackground')}
        />
      </Row>
    </Card>
  );
}
