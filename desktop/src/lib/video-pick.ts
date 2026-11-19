import type { TrackVideo, VideoKind } from '../stores/player';

export const VIDEO_KINDS: VideoKind[] = ['clip', 'loop', 'generated'];

export interface VideoPrefs {
  order: VideoKind[];
  off: VideoKind[];
}

export interface PickedVideo extends TrackVideo {
  kind: VideoKind;
}

export function isVideoKind(kind: string): kind is VideoKind {
  return (VIDEO_KINDS as string[]).includes(kind);
}

export function videoOrder(order: readonly string[]): VideoKind[] {
  const known = order.filter(isVideoKind);
  const rest = VIDEO_KINDS.filter((kind) => !known.includes(kind));
  return [...new Set([...known, ...rest])];
}

export function pickVideo(
  videos: TrackVideo[] | undefined,
  prefs: VideoPrefs,
  failed: ReadonlySet<string>,
): PickedVideo | null {
  if (!videos) return null;
  const order = videoOrder(prefs.order);
  const usable = videos.filter(
    (video): video is PickedVideo =>
      isVideoKind(video.kind) && !prefs.off.includes(video.kind) && !failed.has(video.kind),
  );
  usable.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  return usable[0] ?? null;
}
