import { listen } from '@tauri-apps/api/event';
import { trackedInvoke as invoke, logError } from '../diagnostics';

export type Tier = 'direct' | 'relay' | 'pro';

export interface Hop {
  url: string;
  tier: Tier;
  origin: string;
}

interface RustConfig {
  keys: Record<string, string>;
  relays: Record<string, string[]>;
  origins: Record<string, string>;
  direct: string[];
  zones: string[];
  pro?: string[];
  hints: Record<string, Tier>;
  revalidate_in_ms: Record<string, number>;
  revalidate_ms: number;
}

interface OriginState {
  tier: Tier;
  until: number;
  directFails: number;
  relayWins: number;
  lastAt: number;
}

type Change = 'none' | 'pinned' | 'unpinned';

const DIRECT_FAIL_THRESHOLD = 2;
const RELAY_WIN_THRESHOLD = 2;
const PROVEN_BYTES = 64 * 1024;

let keys = new Map<string, string>();
let relays = new Map<string, string[]>();
let plainHosts = new Map<string, string>();
let directLabels = new Set<string>();
let zones: string[] = [];
let gateways: string[] = [];
let revalidateMs = 600_000;
const origins = new Map<string, OriginState>();
const reported = new Map<string, Tier>();

export async function initEdge(): Promise<void> {
  await listen<RustConfig>('edge:config', (event) => applyConfig(event.payload)).catch(() => {});
  try {
    applyConfig(await invoke<RustConfig>('edge_config'));
  } catch (error) {
    logError(`[Edge] no config from the core: ${String(error)}`);
  }
}

function baseOf(label: string): Tier {
  return directLabels.has(label) ? 'direct' : 'relay';
}

function applyConfig(cfg: RustConfig): void {
  keys = new Map(Object.entries(cfg.keys ?? {}));
  relays = new Map(Object.entries(cfg.relays ?? {}));
  plainHosts = new Map(Object.entries(cfg.origins ?? {}));
  directLabels = new Set(cfg.direct ?? []);
  zones = cfg.zones ?? [];
  gateways = cfg.pro ?? [];
  revalidateMs = cfg.revalidate_ms || revalidateMs;
  const now = Date.now();
  for (const [label, tier] of Object.entries(cfg.hints ?? {})) {
    const prev = origins.get(label);
    if (tier === 'direct' && prev?.tier === 'relay' && prev.until > now) continue;
    reported.set(label, tier);
    if (tier === baseOf(label)) {
      if (prev && prev.tier !== tier) origins.delete(label);
      continue;
    }
    const until = now + (cfg.revalidate_in_ms[label] ?? revalidateMs);
    origins.set(label, {
      tier,
      until: prev?.tier === tier ? Math.max(prev.until, until) : until,
      directFails: 0,
      relayWins: 0,
      lastAt: now,
    });
  }
}

function refreshed(prev: OriginState | undefined, now: number): OriginState {
  if (!prev) return { tier: 'direct', until: now, directFails: 0, relayWins: 0, lastAt: now };
  if (prev.tier !== 'direct' && now >= prev.until) {
    return { tier: 'direct', until: prev.until, directFails: 0, relayWins: 0, lastAt: now };
  }
  const stale = now - prev.lastAt >= revalidateMs;
  if (stale) return { ...prev, directFails: 0, relayWins: 0, lastAt: now };
  return { ...prev, lastAt: now };
}

function levelOf(label: string, now: number): Tier {
  const state = origins.get(label);
  return state && now < state.until ? state.tier : baseOf(label);
}

function base64Url(text: string): string {
  let binary = '';
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function swapHost(url: string, host: string): string {
  try {
    const u = new URL(url);
    u.protocol = 'https:';
    u.hostname = host;
    u.port = '';
    return u.toString();
  } catch {
    return url;
  }
}

function inOurZones(host: string): boolean {
  return zones.some((zone) => host === zone || host.endsWith(`.${zone}`));
}

export function planHops(url: string): Hop[] | null {
  const host = hostOf(url);
  if (!host) return null;
  const origin = keys.get(host);
  if (!origin) {
    if (!inOurZones(host)) return null;
    logError(`[Edge] ${host}: unknown service, no route`);
    return [];
  }

  const level = levelOf(origin, Date.now());
  const plain = plainHosts.get(origin) ?? host;
  const pros: Hop[] = gateways.map((gateway) => ({
    url: gateway + base64Url(swapHost(url, plain)),
    tier: 'pro',
    origin,
  }));
  const relayed: Hop[] = (relays.get(origin) ?? []).map((relay) => ({
    url: swapHost(url, relay),
    tier: 'relay',
    origin,
  }));

  if (!directLabels.has(origin)) {
    return level === 'pro' ? [...pros, ...relayed] : [...relayed, ...pros];
  }
  if (level === 'pro' && pros.length > 0) return pros;
  const direct: Hop = { url: swapHost(url, plain), tier: 'direct', origin };
  if (level === 'direct') return [direct, ...relayed];
  // Прямой путь остаётся последним шансом даже когда вердикт увёл на relay:
  // relay-нода может лечь, а origin к этому моменту уже разбанят.
  return [...relayed, direct];
}

/**
 * В ядро уходит ВЫВОД (текущий тир), а не событие: у Rust свой счётчик провалов,
 * и одиночный «direct не ответил» его бы не сдвинул — вердикт фронта потерялся бы.
 * Шлём только смену, поэтому IPC не идёт на каждый запрос.
 */
function report(origin: string, tier: Tier): void {
  if (reported.get(origin) === tier) return;
  reported.set(origin, tier);
  void invoke('edge_note', { origin, tier, ok: true }).catch(() => {});
}

function step(state: OriginState, hop: Hop, ok: boolean, bytes: number, now: number): Change {
  if (hop.tier === 'direct' && ok) {
    state.directFails = 0;
    state.relayWins = 0;
    if (bytes < PROVEN_BYTES || state.tier !== 'relay') return 'none';
    state.tier = 'direct';
    return 'unpinned';
  }
  if (hop.tier === 'direct') state.directFails += 1;
  else if (ok) state.relayWins += 1;
  const due = state.directFails >= DIRECT_FAIL_THRESHOLD || state.relayWins >= RELAY_WIN_THRESHOLD;
  if (state.tier !== 'direct' || !due) return 'none';
  state.tier = 'relay';
  state.until = now + revalidateMs;
  state.directFails = 0;
  state.relayWins = 0;
  return 'pinned';
}

function tellCore(hop: Hop, ok: boolean): void {
  void invoke('edge_note', { origin: hop.origin, tier: hop.tier, ok }).catch(() => {});
}

export function noteHop(hop: Hop, ok: boolean, bytes = 0): void {
  if (hop.tier === 'pro' || (hop.tier === 'relay' && !ok)) tellCore(hop, ok);
  if (hop.tier === 'pro' || !directLabels.has(hop.origin)) return;
  const prev = origins.get(hop.origin);
  const counts = hop.tier === 'direct' ? !ok : ok;
  if (!prev && !counts) return;
  const now = Date.now();
  const state = refreshed(prev, now);
  if (prev && prev.tier !== 'direct' && state.tier === 'direct') reported.set(hop.origin, 'direct');
  const change = step(state, hop, ok, bytes, now);
  origins.set(hop.origin, state);
  if (change === 'pinned') report(hop.origin, 'relay');
  else if (change === 'unpinned') report(hop.origin, 'direct');
}

/** Текущий тир — для диагностики и баннера состояния. */
export function tierOf(origin: string): Tier {
  return levelOf(origin, Date.now());
}
