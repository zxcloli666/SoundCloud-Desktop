export type LabScheme = 'dark' | 'white';
export type LabPerf = 'beauty' | 'medium' | 'light';

export interface LabParams {
  scene: string | null;
  scheme: LabScheme | null;
  perf: LabPerf | null;
  motion: 'reduce' | null;
  lang: string | null;
  chrome: boolean;
}

export function readParams(search = window.location.search): LabParams {
  const q = new URLSearchParams(search);
  const scheme = q.get('scheme');
  const perf = q.get('perf');
  return {
    scene: q.get('scene'),
    scheme: scheme === 'dark' || scheme === 'white' ? scheme : null,
    perf: perf === 'beauty' || perf === 'medium' || perf === 'light' ? perf : null,
    motion: q.get('motion') === 'reduce' ? 'reduce' : null,
    lang: q.get('lang'),
    chrome: q.get('chrome') !== '0',
  };
}

export function paramsUrl(params: Partial<LabParams>): string {
  const q = new URLSearchParams(window.location.search);
  q.set('chat-lab', '');
  for (const key of ['scene', 'scheme', 'perf', 'motion', 'lang'] as const) {
    if (!(key in params)) continue;
    const value = params[key];
    if (value) q.set(key, value);
    else q.delete(key);
  }
  if ('chrome' in params) {
    if (params.chrome === false) q.set('chrome', '0');
    else q.delete('chrome');
  }
  return `${window.location.pathname}?${q.toString().replace('chat-lab=', 'chat-lab')}`;
}
