export const HAVE_METADATA = 1;
const HAVE_CURRENT_DATA = 2;
const HAVE_FUTURE_DATA = 3;
const HAVE_ENOUGH_DATA = 4;

export function hasFrame(video: HTMLVideoElement): boolean {
  return !video.seeking && video.readyState >= HAVE_CURRENT_DATA;
}

export function canPlay(video: HTMLVideoElement): boolean {
  return !video.seeking && video.readyState >= HAVE_FUTURE_DATA;
}

export function canPlayOn(video: HTMLVideoElement): boolean {
  return !video.seeking && video.readyState >= HAVE_ENOUGH_DATA;
}

export function buffered(video: HTMLVideoElement, time: number): boolean {
  const ranges = video.buffered;
  for (let i = 0; i < ranges.length; i++) {
    if (ranges.start(i) <= time && time < ranges.end(i)) return true;
  }
  return false;
}
