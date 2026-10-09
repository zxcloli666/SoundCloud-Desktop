/* ── Constants ─────────────────────────────────────────────── */

export const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;
export const EQ_LABELS = ['32', '64', '125', '250', '500', '1K', '2K', '4K', '8K', '16K'];
export const EQ_BAND_COUNT = EQ_FREQUENCIES.length;
export const EQ_MIN_GAIN = -12;
export const EQ_MAX_GAIN = 12;

export const EQ_PRESETS: Record<string, { label: string; labelRu: string; gains: number[] }> = {
  flat: { label: 'Flat', labelRu: 'Ровный', gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  bassBoost: { label: 'Bass Boost', labelRu: 'Бас+', gains: [6, 5, 4, 2, 0, 0, 0, 0, 0, 0] },
  bassDestroyer: {
    label: 'Bass Destroyer',
    labelRu: 'Сабвуфер',
    gains: [12, 12, 10, 7, 3, 0, -2, -4, -4, -5],
  },
  trebleBoost: {
    label: 'Treble Boost',
    labelRu: 'Верха+',
    gains: [0, 0, 0, 0, 0, 0, 2, 4, 5, 6],
  },
  vocal: { label: 'Vocal', labelRu: 'Вокал', gains: [-2, -1, 0, 2, 4, 4, 3, 1, 0, -1] },
  rock: { label: 'Rock', labelRu: 'Рок', gains: [4, 3, 1, 0, -1, 0, 2, 3, 4, 4] },
  electronic: {
    label: 'Electronic',
    labelRu: 'Электроника',
    gains: [5, 4, 2, 0, -1, 0, 1, 3, 4, 5],
  },
  classical: {
    label: 'Classical',
    labelRu: 'Классика',
    gains: [0, 0, 0, 0, 0, 0, -2, -3, -3, -4],
  },
  loudness: {
    label: 'Loudness',
    labelRu: 'Громкость',
    gains: [5, 4, 1, 0, -1, 0, -1, 0, 3, 4],
  },
  vShape: {
    label: 'V-Shape',
    labelRu: 'V-образный',
    gains: [5, 3, 1, -1, -3, -3, -1, 1, 3, 5],
  },
  nightMode: {
    label: 'Night',
    labelRu: 'Ночной',
    gains: [-3, -2, 0, 2, 3, 3, 2, 0, -2, -4],
  },
};

export const EQ_CUSTOM_PRESET_LIMIT = 20;
export const EQ_PRESET_NAME_MAX = 24;

export interface EqCustomPreset {
  id: string;
  name: string;
  gains: number[];
}
