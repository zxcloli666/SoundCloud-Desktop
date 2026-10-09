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
    <div
      className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-4"
      style={
        s.enabled
          ? {
              borderColor: 'var(--color-accent-glow)',
              background:
                'linear-gradient(160deg, var(--color-accent-glow), transparent 55%), rgba(255,255,255,0.02)',
            }
          : undefined
      }
    >
      <Row title={t('settings.wpSlideshow')} desc={t('settings.wpSlideshowDesc')}>
        <Toggle checked={s.enabled} onChange={toggle} />
      </Row>

      {s.enabled && (
        <div className="space-y-4 animate-fade-in-up">
          <div className="flex items-center justify-between gap-3">
            <p
              className={`text-[12px] leading-snug ${ready ? 'text-white/45' : 'text-amber-300/80'}`}
            >
              {ready
                ? t('settings.wpSlideshowSelected', { count: s.names.length })
                : t('settings.wpSlideshowNeedTwo')}
            </p>
            <button
              type="button"
              onClick={advanceWallpaper}
              disabled={!ready}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white/70 bg-white/[0.06] border border-white/[0.06] hover:bg-white/[0.1] hover:text-white transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <SkipForward size={12} />
              {t('settings.wpSlideshowNext')}
            </button>
          </div>

          <div className="space-y-2">
            <span className="text-[12px] text-white/40 font-medium">
              {t('settings.wpSlideshowInterval')}
            </span>
            <Segmented
              value={String(s.minutes) as MinutesId}
              options={intervalOptions}
              onChange={(v) => s.setMinutes(Number(v))}
            />
          </div>

          <div className="space-y-2">
            <span className="text-[12px] text-white/40 font-medium">
              {t('settings.wpSlideshowOrder')}
            </span>
            <Segmented value={s.order} options={orderOptions} onChange={s.setOrder} />
          </div>
        </div>
      )}
    </div>
  );
}
