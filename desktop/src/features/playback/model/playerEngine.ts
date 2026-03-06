import { Howl } from 'howler';

export function toHowlerVolume(volume: number) {
  return Math.min(1, Math.max(0, volume / 200));
}

interface CreateTrackHowlOptions {
  src: string;
  volume: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onLoad: (duration: number) => void;
  onEnd: () => void;
  onLoadError: (error: unknown) => void;
  onPlayError: (error: unknown) => void;
}

export function createTrackHowl(options: CreateTrackHowlOptions): Howl {
  const { src, volume, onPlay, onPause, onStop, onLoad, onEnd, onLoadError, onPlayError } = options;

  const howl = new Howl({
    src: [src],
    html5: true,
    format: ['mp3'],
    volume: toHowlerVolume(volume),
    onplay: onPlay,
    onpause: onPause,
    onstop: onStop,
    onload: () => onLoad(howl.duration()),
    onend: onEnd,
    onloaderror: (_id, error) => onLoadError(error),
    onplayerror: (_id, error) => onPlayError(error),
  });

  return howl;
}

export function destroyHowlInstance(howl: Howl | null) {
  if (!howl) return null;
  howl.off();
  howl.stop();
  howl.unload();
  return null;
}

export function setHowlVolume(howl: Howl | null, volume: number) {
  if (!howl) return;
  howl.volume(toHowlerVolume(volume));
}
