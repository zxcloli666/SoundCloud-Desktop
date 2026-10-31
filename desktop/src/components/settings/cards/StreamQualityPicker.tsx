import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/shallow';
import { Star } from '../../../lib/icons';
import { QUALITY_LABEL_KEYS } from '../../../lib/playback-quality';
import { usePlayerStore } from '../../../stores/player';
import { type StreamQuality, useSettingsStore } from '../../../stores/settings';
import { Segmented } from '../primitives';

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
  const isHq = quality !== 'sq';

  return (
    <div className="flex shrink-0 items-center gap-2">
      <span className="text-[11px] text-ink-35">{t('settings.streamQualityNow')}</span>
      <span
        className={`inline-flex h-6 items-center rounded-md border px-2 text-[9px] font-semibold tracking-[0.14em] ${
          isHq
            ? 'border-ink/[0.14] bg-ink/[0.08] text-ink-92'
            : 'border-ink/[0.08] bg-ink/[0.04] text-ink-68'
        }`}
        style={isHq ? { boxShadow: '0 0 14px var(--color-accent-glow)' } : undefined}
      >
        {t(QUALITY_LABEL_KEYS[quality])}
      </span>
      {source === 'storage' && (
        <span className="inline-flex h-6 items-center rounded-md border border-mint/[0.16] bg-mint/[0.07] px-2 text-[8px] font-medium tracking-[0.12em] text-mint-ink/82">
          {t('player.qualityCDN')}
        </span>
      )}
    </div>
  );
}

export function StreamQualityPicker({ isPremium }: { isPremium: boolean }) {
  const { t } = useTranslation();
  const chosen = useSettingsStore((s) => s.streamQuality);
  const setStreamQuality = useSettingsStore((s) => s.setStreamQuality);
  const streamQuality = chosen === 'uq' && !isPremium ? 'hq' : chosen;

  return (
    <div className="space-y-3 py-3 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[13.5px] text-ink-80 font-medium">
            {t('settings.streamQuality')}
          </div>
          <p className="text-[11.5px] text-ink-35 mt-0.5 leading-snug">
            {t(DESC_KEYS[streamQuality])}
          </p>
        </div>
        <NowPlayingQuality />
      </div>
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
              <Star size={11} fill="currentColor" className="text-amber-400/80" />
            ),
          },
        ]}
      />
      {!isPremium && (
        <p className="flex items-center gap-1.5 text-[11.5px] leading-snug text-purple-200/55">
          <Star size={11} fill="currentColor" className="shrink-0 text-amber-400/80" />
          {t('settings.streamQualityLocked')}
        </p>
      )}
    </div>
  );
}
