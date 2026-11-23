import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/shallow';
import { SkipForward } from '../../../lib/icons';
import { advanceWallpaper, ROTATION_MINUTES } from '../../../lib/wallpaper-rotation';
import { useSettingsStore, type WallpaperRotationOrder } from '../../../stores/settings';
import { Row, Segmented, Toggle } from '../primitives';

type MinutesId = `${(typeof ROTATION_MINUTES)[number]}`;

export function WallpaperSlideshow({ available }: { available: string[] }) {
  const { t } = useTranslation();
  const s = useSettingsStore(
    useShallow((st) => ({
      enabled: st.wallpaperRotation,
      names: st.wallpaperRotationNames,
      minutes: st.wallpaperRotationMinutes,
      order: st.wallpaperRotationOrder,
      current: st.backgroundImage,
      setEnabled: st.setWallpaperRotation,
      setNames: st.setWallpaperRotationNames,
      setMinutes: st.setWallpaperRotationMinutes,
      setOrder: st.setWallpaperRotationOrder,
    })),
  );

  const toggle = () => {
    if (s.enabled) {
      s.setEnabled(false);
      return;
    }
    const kept = s.names.filter((n) => available.includes(n));
    s.setNames(kept.length > 0 ? kept : s.current ? [s.current] : []);
    s.setEnabled(true);
  };

  const intervalOptions = ROTATION_MINUTES.map((m) => ({
    id: String(m) as MinutesId,
    label:
      m < 60
        ? t('settings.wpIntervalMin', { count: m })
        : t('settings.wpIntervalHour', { count: m / 60 }),
  }));

  const orderOptions: { id: WallpaperRotationOrder; label: string }[] = [
    { id: 'sequence', label: t('settings.wpOrderSequence') },
    { id: 'shuffle', label: t('settings.wpOrderShuffle') },
  ];

  const ready = s.names.length > 1;

  return (
    <>
      <Row title={t('settings.wpSlideshow')} desc={t('settings.wpSlideshowDesc')}>
        <Toggle checked={s.enabled} onChange={toggle} label={t('settings.wpSlideshow')} />
      </Row>
      {s.enabled && (
        <>
          <div className="set-row flex min-h-[52px] items-center gap-3 py-2.5">
            <p
              className={`min-w-0 flex-1 text-[12.5px] leading-snug ${ready ? 'text-ink-55' : 'text-amber-400'}`}
            >
              {ready
                ? t('settings.wpSlideshowSelected', { count: s.names.length })
                : t('settings.wpSlideshowNeedTwo')}
            </p>
            <button type="button" onClick={advanceWallpaper} disabled={!ready} className="set-btn">
              <SkipForward size={13} />
              {t('settings.wpSlideshowNext')}
            </button>
          </div>
          <Row title={t('settings.wpSlideshowInterval')}>
            <Segmented
              value={String(s.minutes) as MinutesId}
              options={intervalOptions}
              onChange={(v) => s.setMinutes(Number(v))}
            />
          </Row>
          <Row title={t('settings.wpSlideshowOrder')}>
            <Segmented value={s.order} options={orderOptions} onChange={s.setOrder} />
          </Row>
        </>
      )}
    </>
  );
}
