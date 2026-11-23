import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/shallow';
import { Star } from '../../../lib/icons';
import { QUALITY_LABEL_KEYS } from '../../../lib/playback-quality';
import { usePlayerStore } from '../../../stores/player';
import { type StreamQuality, useSettingsStore } from '../../../stores/settings';
import { Row, Segmented } from '../primitives';

const DESC_KEYS: Record<StreamQuality, string> = {
  auto: 'settings.streamQualityAutoDesc',
  sq: 'settings.streamQualitySqDesc',
  hq: 'settings.streamQualityHqDesc',
  uq: 'settings.streamQualityUqDesc',
};

function NowPlayingQuality() {
  const { t } = useTranslation();
  const { quality, source } = usePlayerStore(
    useShallow((s) => ({ quality: s.playbackQuality, source: s.playbackSource })),
  );
  if (!quality) return null;

  return (
    <span
      title={t('settings.streamQualityNow')}
      className="set-chip ml-1 h-5 gap-1.5 px-2 text-[10px] tracking-[0.08em] text-ink-60"
    >
      {t(QUALITY_LABEL_KEYS[quality])}
      {source === 'storage' && <span className="text-mint-ink">{t('player.qualityCDN')}</span>}
    </span>
  );
}

export function StreamQualityPicker({ isPremium }: { isPremium: boolean }) {
  const { t } = useTranslation();
  const chosen = useSettingsStore((s) => s.streamQuality);
  const setStreamQuality = useSettingsStore((s) => s.setStreamQuality);
  const streamQuality = chosen === 'uq' && !isPremium ? 'hq' : chosen;

  return (
    <Row
      title={
        <>
          {t('settings.streamQuality')}
          <NowPlayingQuality />
        </>
      }
      info={
        <>
          {t(DESC_KEYS[streamQuality])}
          {!isPremium && (
            <span className="mt-1.5 block text-ink-50">{t('settings.streamQualityLocked')}</span>
          )}
        </>
      }
    >
      <Segmented
        value={streamQuality}
        onChange={setStreamQuality}
        options={[
          { id: 'auto', label: t('settings.streamQualityAuto') },
          { id: 'sq', label: t('settings.streamQualitySq') },
          { id: 'hq', label: t('settings.streamQualityHq') },
          {
            id: 'uq',
            label: t('settings.streamQualityUq'),
            disabled: !isPremium,
            adornment: isPremium ? undefined : (
              <Star size={10} fill="currentColor" className="shrink-0 text-amber-400" />
            ),
          },
        ]}
      />
    </Row>
  );
}
