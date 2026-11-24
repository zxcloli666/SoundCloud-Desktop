import { volumeGain } from '../volume.ts';

interface VolumePair {
  volume: number;
  volumeBeforeMute: number;
}

export interface StoredVolume extends VolumePair {
  earVolume: number;
  earVolumeBeforeMute: number;
}

export function earVolume(linear: number): number {
  return linear < 100 ? Math.round(10 * Math.sqrt(linear)) : linear;
}

export function linearVolume(volume: number): number {
  const linear = Math.round(volumeGain(volume) * 100);
  return volume > 0 ? Math.max(1, linear) : 0;
}

export function storeVolume({ volume, volumeBeforeMute }: VolumePair): StoredVolume {
  return {
    volume: linearVolume(volume),
    volumeBeforeMute: linearVolume(volumeBeforeMute),
    earVolume: volume,
    earVolumeBeforeMute: volumeBeforeMute,
  };
}

export function readVolume(stored: Partial<StoredVolume>): Partial<VolumePair> {
  return {
    ...pick('volume', stored.earVolume, stored.volume),
    ...pick('volumeBeforeMute', stored.earVolumeBeforeMute, stored.volumeBeforeMute),
  };
}

function pick(key: keyof VolumePair, ear?: number, linear?: number): Partial<VolumePair> {
  if (ear !== undefined) return { [key]: ear };
  return linear === undefined ? {} : { [key]: earVolume(linear) };
}
