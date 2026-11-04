import { memo, useEffect, useState } from 'react';
import { chatMediaUrl } from '../../../lib/chat/media-url';
import type { RoomView } from '../../../lib/together/types';
import { watchBackdropUploads } from '../../../stores/chat/backdrop';
import { BackdropStage } from './backdrop/BackdropStage';
import { sampleLuminance } from './backdrop/luminance';
import { UNKNOWN_LIGHT } from './backdrop/scrim';
import { useRoomBackdrop } from './backdrop/shown';
import type { Luminance } from './presets/types';

const RETRY_MS = 30_000;

function ImageBackdrop({ src, onFail }: { src: string; onFail: () => void }) {
  const [light, setLight] = useState<Luminance>(UNKNOWN_LIGHT);

  useEffect(() => {
    let live = true;
    void sampleLuminance(src).then((measured) => {
      if (live) setLight(measured);
    });
    return () => {
      live = false;
    };
  }, [src]);

  return <BackdropStage src={src} light={light} motion={null} onFail={onFail} />;
}

function useFailed(src: string | null) {
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    if (failed === null) return;
    const timer = setTimeout(() => setFailed(null), RETRY_MS);
    return () => clearTimeout(timer);
  }, [failed]);
  return [failed !== null && failed === src, () => setFailed(src)] as const;
}

export const RoomBackdrop = memo(function RoomBackdrop({ room }: { room: RoomView }) {
  const { shown } = useRoomBackdrop(room);
  const src =
    shown?.kind === 'image' ? chatMediaUrl(shown.conversationId, shown.mediaId, 'image') : null;
  const [failed, fail] = useFailed(src);

  useEffect(() => {
    watchBackdropUploads();
  }, []);

  if (shown?.kind === 'preset') {
    const { preset } = shown;
    return (
      <BackdropStage key={preset.id} src={preset.image} light={preset.light} motion={preset.tone} />
    );
  }
  if (!src || failed) return null;
  return <ImageBackdrop key={src} src={src} onFail={fail} />;
});
