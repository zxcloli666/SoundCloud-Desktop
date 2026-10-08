// Транспортные тиры до наших доменов: прямой хост → relay-пул
// (`<сервис>.<нода>.relay.scnative.space`). Тира CF-воркеров больше нет —
// их лимиты не держали наш трафик, см. `network/edge.rs`.
// Таблица и персист живут в Rust (`network/edge.rs`), здесь — зеркало вердикта для
// запросов, которые фронт делает сам. Политика та же, чтобы оба мира сходились к
// одному тиру; в ядро уходит только СМЕНА вердикта, не каждый запрос.
// Состав relay-пула приезжает из ядра — новую ноду сюда дописывать не нужно.

import { listen } from '@tauri-apps/api/event';
import { trackedInvoke as invoke } from '../diagnostics';

export type Tier = 'direct' | 'relay';

export interface Hop {
  url: string;
  tier: Tier;
  origin: string;
}

interface RustConfig {
  relays: [string, string[]][];
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

const TIER_ORDER: Record<Tier, number> = { direct: 0, relay: 1 };
const DIRECT_FAIL_THRESHOLD = 2;
const RELAY_WIN_THRESHOLD = 2;
const PROVEN_BYTES = 64 * 1024;

let relays = new Map<string, string[]>();
let revalidateMs = 600_000;
const origins = new Map<string, OriginState>();
const reported = new Map<string, Tier>();

/** Дёргать до первого сетевого запроса. Без конфига остаётся прямой путь. */
export async function initEdge(): Promise<void> {
  await listen<RustConfig>('edge:config', (event) => applyConfig(event.payload)).catch(() => {});
  try {
    applyConfig(await invoke<RustConfig>('edge_config'));
  } catch {
    // Ядро не ответило — работаем как раньше.
  }
}

function applyConfig(cfg: RustConfig): void {
  relays = new Map(cfg.relays);
  revalidateMs = cfg.revalidate_ms || revalidateMs;
  const now = Date.now();
  for (const [host, tier] of Object.entries(cfg.hints ?? {})) {
    const prev = origins.get(host);
    if (tier === 'direct' && prev?.tier === 'relay' && prev.until > now) continue;
    reported.set(host, tier);
    if (tier === 'direct') {
      if (prev?.tier === 'relay') origins.delete(host);
      continue;
    }
    const until = now + (cfg.revalidate_in_ms[host] ?? revalidateMs);
    origins.set(host, {
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
  if (prev.tier === 'relay' && now >= prev.until) {
    return { tier: 'direct', until: prev.until, directFails: 0, relayWins: 0, lastAt: now };
  }
  const stale = now - prev.lastAt >= revalidateMs;
  if (stale) return { ...prev, directFails: 0, relayWins: 0, lastAt: now };
  return { ...prev, lastAt: now };
}

function isPinned(state: OriginState | undefined, now: number): boolean {
  return state?.tier === 'relay' && now < state.until;
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

/** Пусто = домен не наш, идём как есть. */
export function planHops(url: string): Hop[] {
  const origin = hostOf(url);
  if (!origin) return [];
  const pool = relays.get(origin);
  if (!pool?.length) return [];

  const from: Tier = isPinned(origins.get(origin), Date.now()) ? 'relay' : 'direct';
  const min = TIER_ORDER[from];

  const hops: Hop[] = [];
  if (min <= TIER_ORDER.direct) hops.push({ url, tier: 'direct', origin });
  if (min <= TIER_ORDER.relay) {
    for (const relay of pool) hops.push({ url: swapHost(url, relay), tier: 'relay', origin });
  }

  if (min > TIER_ORDER.direct) {
    // Прямой путь остаётся последним шансом даже когда вердикт увёл на relay:
    // relay-нода может лечь, а origin к этому моменту уже разбанят.
    hops.push({ url, tier: 'direct', origin });
  }
  return hops;
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

export function noteHop(hop: Hop, ok: boolean, bytes = 0): void {
  const prev = origins.get(hop.origin);
  const counts = hop.tier === 'direct' ? !ok : ok;
  if (!prev && !counts) return;
  const now = Date.now();
  const state = refreshed(prev, now);
  if (prev?.tier === 'relay' && state.tier === 'direct') reported.set(hop.origin, 'direct');
  const change = step(state, hop, ok, bytes, now);
  origins.set(hop.origin, state);
  if (change === 'pinned') report(hop.origin, 'relay');
  else if (change === 'unpinned') report(hop.origin, 'direct');
}

/** Текущий тир — для диагностики и баннера состояния. */
export function tierOf(origin: string): Tier {
  return isPinned(origins.get(origin), Date.now()) ? 'relay' : 'direct';
}
