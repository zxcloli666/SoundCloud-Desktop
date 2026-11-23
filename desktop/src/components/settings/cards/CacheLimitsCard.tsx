import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { enforceImageCacheLimit, getImageCacheSize } from '../../../lib/cache';
import {
  AUDIO_CACHE_STEPS,
  audioCacheStep,
  CACHE_UNLIMITED,
  formatCacheLimit,
  IMAGE_CACHE_STEPS,
  imageCacheStep,
  isAudioCacheOff,
  isAudioCacheUnlimited,
} from '../../../lib/cache-limit';
import { Gauge } from '../../../lib/icons';
import { enforceVideoCacheLimit, getVideoCacheSize } from '../../../lib/video-cache';
import { useSettingsStore } from '../../../stores/settings';
import { Card } from '../primitives';
import { CacheLimitSlider } from './CacheLimitSlider';

export function CacheLimitsCard({
  onImageSize,
  onVideoSize,
}: {
  onImageSize: (size: number) => void;
  onVideoSize: (size: number) => void;
}) {
  const { t } = useTranslation();
  const audioCacheLimitMB = useSettingsStore((s) => s.audioCacheLimitMB);
  const setAudioCacheLimitMB = useSettingsStore((s) => s.setAudioCacheLimitMB);
  const imageCacheLimitMB = useSettingsStore((s) => s.imageCacheLimitMB);
  const setImageCacheLimitMB = useSettingsStore((s) => s.setImageCacheLimitMB);
  const videoCacheLimitMB = useSettingsStore((s) => s.videoCacheLimitMB);
  const setVideoCacheLimitMB = useSettingsStore((s) => s.setVideoCacheLimitMB);

  const handleImageLimit = useCallback(
    (step: number) => {
      const limitMb = IMAGE_CACHE_STEPS[step];
      setImageCacheLimitMB(limitMb);
      void enforceImageCacheLimit(limitMb)
        .then(getImageCacheSize)
        .then(onImageSize)
        .catch(() => {});
    },
    [setImageCacheLimitMB, onImageSize],
  );

  const handleVideoLimit = useCallback(
    (step: number) => {
      const limitMb = IMAGE_CACHE_STEPS[step];
      setVideoCacheLimitMB(limitMb);
      void enforceVideoCacheLimit(limitMb)
        .then(getVideoCacheSize)
        .then(onVideoSize)
        .catch(() => {});
    },
    [setVideoCacheLimitMB, onVideoSize],
  );

  const cacheOff = isAudioCacheOff(audioCacheLimitMB);
  const limitLabel = cacheOff
    ? t('settings.audioCacheOff')
    : isAudioCacheUnlimited(audioCacheLimitMB)
      ? t('settings.unlimited')
      : `${audioCacheStep(audioCacheLimitMB)} GB`;
  const sizeLabel = (limitMb: number) =>
    limitMb === CACHE_UNLIMITED ? t('settings.unlimited') : formatCacheLimit(limitMb);

  return (
    <Card title={t('settings.cacheLimits')} icon={<Gauge size={17} />}>
      <CacheLimitSlider
        data-ui="settings-row"
        title={t('settings.audioCacheLimit')}
        desc={
          cacheOff === false ? t('settings.audioCacheLimitDesc') : t('settings.audioCacheOffDesc')
        }
        valueLabel={limitLabel}
        danger={cacheOff}
        step={audioCacheStep(audioCacheLimitMB)}
        steps={AUDIO_CACHE_STEPS.length}
        minLabel={t('settings.audioCacheOff')}
        maxLabel={t('settings.unlimited')}
        onChange={(step) => setAudioCacheLimitMB(AUDIO_CACHE_STEPS[step])}
      />
      <CacheLimitSlider
        data-ui="settings-row"
        title={t('settings.imageCacheLimit')}
        desc={t('settings.imageCacheLimitDesc')}
        valueLabel={sizeLabel(imageCacheLimitMB)}
        step={imageCacheStep(imageCacheLimitMB)}
        steps={IMAGE_CACHE_STEPS.length}
        minLabel={formatCacheLimit(IMAGE_CACHE_STEPS[0])}
        maxLabel={t('settings.unlimited')}
        onChange={handleImageLimit}
      />
      <CacheLimitSlider
        data-ui="settings-row"
        title={t('settings.videoCacheLimit')}
        desc={t('settings.videoCacheLimitDesc')}
        valueLabel={sizeLabel(videoCacheLimitMB)}
        step={imageCacheStep(videoCacheLimitMB)}
        steps={IMAGE_CACHE_STEPS.length}
        minLabel={formatCacheLimit(IMAGE_CACHE_STEPS[0])}
        maxLabel={t('settings.unlimited')}
        onChange={handleVideoLimit}
      />
    </Card>
  );
}
