import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  clearCache,
  clearImageCache,
  clearLikedCache,
  getCacheSize,
  getImageCacheSize,
  getLikedCacheSize,
} from '../../../lib/cache';
import { isAudioCacheOff } from '../../../lib/cache-limit';
import { formatBytes } from '../../../lib/formatters';
import { Database } from '../../../lib/icons';
import { clearVideoCache, getVideoCacheSize } from '../../../lib/video-cache';
import { useSettingsStore } from '../../../stores/settings';
import { Skeleton } from '../../ui/Skeleton';
import { Card, Row, Toggle } from '../primitives';
import { CacheLikesRow } from './CacheLikesRow';
import { CacheLimitsCard } from './CacheLimitsCard';
import { CACHE_SHADES, CacheRow, UsageBar } from './CacheUsage';

export function CacheCard() {
  const { t } = useTranslation();
  const audioCacheLimitMB = useSettingsStore((s) => s.audioCacheLimitMB);
  const hoverPreload = useSettingsStore((s) => s.hoverPreload);
  const setHoverPreload = useSettingsStore((s) => s.setHoverPreload);
  const [audioSize, setAudioSize] = useState<number | null>(null);
  const [imagesSize, setImagesSize] = useState<number | null>(null);
  const [likedSize, setLikedSize] = useState<number | null>(null);
  const [videoSize, setVideoSize] = useState<number | null>(null);
  const [clearingVideo, setClearingVideo] = useState(false);
  const [clearingAudio, setClearingAudio] = useState(false);
  const [clearingImages, setClearingImages] = useState(false);
  const [clearingLiked, setClearingLiked] = useState(false);

  const refreshLikedSize = useCallback(() => {
    void getLikedCacheSize().then(setLikedSize);
  }, []);

  useEffect(() => {
    void getCacheSize().then(setAudioSize);
    void getImageCacheSize().then(setImagesSize);
    void getVideoCacheSize().then(setVideoSize);
    refreshLikedSize();
  }, [refreshLikedSize]);

  const clearWith = useCallback(
    async (
      fn: () => Promise<unknown>,
      setBusy: (b: boolean) => void,
      setSize: (n: number) => void,
    ) => {
      setBusy(true);
      try {
        await fn();
        setSize(0);
        toast.success(t('settings.cacheCleared'));
      } catch {
        toast.error(t('common.error'));
      } finally {
        setBusy(false);
      }
    },
    [t],
  );

  const sizes = [audioSize, likedSize, imagesSize, videoSize];
  const loaded = sizes.every((size) => size !== null);
  const total = sizes.reduce<number>((sum, size) => sum + (size ?? 0), 0);
  const cacheOff = isAudioCacheOff(audioCacheLimitMB);

  return (
    <>
      <Card
        title={t('settings.cache')}
        icon={<Database size={17} />}
        action={
          loaded ? (
            <span className="set-chip h-7 px-3 text-[12.5px]">
              {t('settings.total')}: {formatBytes(total)}
            </span>
          ) : (
            <Skeleton className="h-7 w-24 rounded-full" />
          )
        }
      >
        <UsageBar sizes={sizes} />
        <CacheRow
          data-ui="settings-row"
          label={t('settings.audioCacheSize')}
          size={audioSize}
          shade={CACHE_SHADES[0]}
          clearing={clearingAudio}
          clearLabel={t('settings.clearCache')}
          onClear={() => clearWith(clearCache, setClearingAudio, setAudioSize)}
        />
        <CacheRow
          data-ui="settings-row"
          label={t('settings.likedCacheSize')}
          info={t('settings.likedCacheHint')}
          size={likedSize}
          shade={CACHE_SHADES[1]}
          clearing={clearingLiked}
          clearLabel={t('settings.clearCache')}
          onClear={() => clearWith(clearLikedCache, setClearingLiked, setLikedSize)}
        />
        <CacheRow
          data-ui="settings-row"
          label={t('settings.assetsCacheSize')}
          size={imagesSize}
          shade={CACHE_SHADES[2]}
          clearing={clearingImages}
          clearLabel={t('settings.clearCache')}
          onClear={() => clearWith(clearImageCache, setClearingImages, setImagesSize)}
        />
        <CacheRow
          data-ui="settings-row"
          label={t('settings.videoCacheSize')}
          size={videoSize}
          shade={CACHE_SHADES[3]}
          clearing={clearingVideo}
          clearLabel={t('settings.clearCache')}
          onClear={() => clearWith(clearVideoCache, setClearingVideo, setVideoSize)}
        />
        <CacheLikesRow onProgress={refreshLikedSize} />
        <Row title={t('settings.hoverPreload')} desc={t('settings.hoverPreloadDesc')}>
          <Toggle
            checked={hoverPreload && !cacheOff}
            disabled={cacheOff}
            onChange={() => setHoverPreload(!hoverPreload)}
            label={t('settings.hoverPreload')}
          />
        </Row>
      </Card>
      <CacheLimitsCard onImageSize={setImagesSize} onVideoSize={setVideoSize} />
    </>
  );
}
