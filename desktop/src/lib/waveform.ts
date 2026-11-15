import { useQuery } from '@tanstack/react-query';
import type { Track } from '../stores/player';
import { netFetch } from './net/fetch';
import { queryClient } from './query-client';

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

const STALE_MS = 1000 * 60 * 30;
const GC_MS = 1000 * 60 * 60;

/** Fetch + cache a track's raw SC waveform JSON. 30-min cache per track URN. */
export function useTrackWaveform(track: Track | null) {
  const rawUrl = track?.waveform_url ?? null;
  return useQuery({
    queryKey: ['waveform', rawUrl],
    enabled: !!rawUrl,
    staleTime: STALE_MS,
    gcTime: GC_MS,
    retry: false,
    queryFn: () => fetchWaveform(rawUrl!),
  });
}

export function loadWaveform(track: Track): Promise<WaveformSamples | null> {
  const rawUrl = track.waveform_url;
  if (!rawUrl) return Promise.resolve(null);
  return queryClient
    .fetchQuery({
      queryKey: ['waveform', rawUrl],
      staleTime: STALE_MS,
      gcTime: GC_MS,
      retry: false,
      queryFn: () => fetchWaveform(rawUrl),
    })
    .catch(() => null);
}

export function downsample(samples: number[], height: number, count: number): number[] {
  if (!samples.length) return new Array(count).fill(0.35);
  const bucketSize = samples.length / count;
  const out = new Array<number>(count);
  for (let i = 0; i < count; i++) {
    const start = Math.floor(i * bucketSize);
    const end = Math.max(start + 1, Math.floor((i + 1) * bucketSize));
    let sum = 0;
    let n = 0;
    for (let j = start; j < end && j < samples.length; j++) {
      sum += samples[j];
      n++;
    }
    const avg = n > 0 ? sum / n / height : 0.35;
    out[i] = 0.18 + Math.min(0.82, avg * 0.95);
  }
  return out;
}
