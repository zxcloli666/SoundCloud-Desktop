import type { BackdropPresetId } from '../../../../lib/chat/media-types';

export interface Luminance {
  mean: number;
  low: number;
  high: number;
}

export interface BackdropPreset {
  id: BackdropPresetId;
  image: string;
  tile: string;
  tone: 'dark' | 'light';
  light: Luminance;
}
