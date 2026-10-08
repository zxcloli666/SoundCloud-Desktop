import { useQuery } from '@tanstack/react-query';
import type { Track } from '../stores/player';
import { netFetch } from './net/fetch';

export interface WaveformSamples {
  values: number[];
  height: number;
}

interface ScWaveformJson {
  width: number;
  height: number;
  samples: number[];
}

/** Convert SC's PNG waveform URL (`_m.png`) to the JSON variant (`_m.json`). */
function normalizeWaveformUrl(raw: string): string | null {
  if (!raw) return null;
  // Modern field: "https://wave.sndcdn.com/XXXX_m.png" → swap extension to .json.
  // Legacy field already ends in .json.
  return raw.replace(/\.png(\?.*)?$/i, '.json$1').replace(/^http:\/\//i, 'https://');
}

async function fetchWaveform(rawUrl: string): Promise<WaveformSamples> {
  const url = normalizeWaveformUrl(rawUrl);
  if (!url) throw new Error('Invalid waveform url');

  const res = await netFetch(url, { method: 'GET' });
  if (!res.ok) throw new Error(`waveform ${res.status}`);
  const json = (await res.json()) as ScWaveformJson;

  if (!Array.isArray(json.samples) || json.samples.length === 0) {
    throw new Error('waveform: empty samples');
  }
  return { values: json.samples, height: json.height || 140 };
}

/** Fetch + cache a track's raw SC waveform JSON. 30-min cache per track URN. */
export function useTrackWaveform(track: Track | null) {
  const rawUrl = track?.waveform_url ?? null;
  return useQuery({
    queryKey: ['waveform', rawUrl],
    enabled: !!rawUrl,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    retry: false,
    queryFn: () => fetchWaveform(rawUrl!),
  });
}
