import { useQuery } from '@tanstack/react-query';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import type { Track } from '../stores/player';

export interface WaveformSamples {
  values: number[];
  height: number;
}

interface ScWaveformJson {
  width: number;
  height: number;
  samples: number[];
}

const WAVEFORM_FETCH_TIMEOUT_MS = 8_000;

/** Convert SC's PNG waveform URL (`_m.png`) to the JSON variant (`_m.json`). */
function normalizeWaveformUrl(raw: string): string | null {
  if (!raw) return null;
  // Modern field: "https://wave.sndcdn.com/XXXX_m.png" → swap extension to .json.
  // Legacy field already ends in .json.
  return raw.replace(/\.png(\?.*)?$/i, '.json$1').replace(/^http:\/\//i, 'https://');
}

async function fetchWaveform(rawUrl: string, callerSignal?: AbortSignal): Promise<WaveformSamples> {
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();
  if (callerSignal?.aborted) controller.abort();
  else callerSignal?.addEventListener('abort', abortFromCaller, { once: true });
  const timer = setTimeout(() => controller.abort(), WAVEFORM_FETCH_TIMEOUT_MS);
  const url = normalizeWaveformUrl(rawUrl);
  if (!url) throw new Error('Invalid waveform url');

  try {
    const res = await tauriFetch(url, { method: 'GET', signal: controller.signal });
    if (!res.ok) throw new Error(`waveform ${res.status}`);
    const json = (await res.json()) as ScWaveformJson;

    if (!Array.isArray(json.samples) || json.samples.length === 0) {
      throw new Error('waveform: empty samples');
    }
    return { values: json.samples, height: json.height || 140 };
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener('abort', abortFromCaller);
  }
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
    queryFn: ({ signal }) => fetchWaveform(rawUrl!, signal),
  });
}
