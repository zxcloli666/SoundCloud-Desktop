interface Volumes {
  volume?: number;
  volumeBeforeMute?: number;
}

export function earVolume(linear: number): number {
  return linear < 100 ? Math.round(10 * Math.sqrt(linear)) : linear;
}

export function volumesByEar<T extends Volumes>(stored: T): T {
  const { volume, volumeBeforeMute } = stored;
  return {
    ...stored,
    ...(volume === undefined ? {} : { volume: earVolume(volume) }),
    ...(volumeBeforeMute === undefined ? {} : { volumeBeforeMute: earVolume(volumeBeforeMute) }),
  };
}
