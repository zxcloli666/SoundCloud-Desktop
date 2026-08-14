// Транспортные тиры до наших доменов: прямой хост → relay-пул
// (`<сервис>.<нода>.<relayZone>` из backend.config.json). Тира CF-воркеров больше нет —
// их лимиты не держали наш трафик, см. `network/edge.rs`.
// Таблица и персист живут в Rust (`network/edge.rs`), здесь — зеркало вердикта для
// запросов, которые фронт делает сам. Политика та же, чтобы оба мира сходились к
// одному тиру; в ядро уходит только СМЕНА вердикта, не каждый запрос.
// Состав relay-пула приезжает из ядра — новую ноду сюда дописывать не нужно.

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
  revalidate_ms: number;
}

interface OriginState {
  tier: Tier;
  revalidateAt: number;
  directFails: number;
}

const TIER_ORDER: Record<Tier, number> = { direct: 0, relay: 1 };
const DIRECT_FAIL_THRESHOLD = 2;

let relays = new Map<string, string[]>();
let revalidateMs = 600_000;
const origins = new Map<string, OriginState>();

/** Дёргать до первого сетевого запроса. Без конфига остаётся прямой путь. */
export async function initEdge(): Promise<void> {
  try {
    const cfg = await invoke<RustConfig>('edge_config');
    relays = new Map(cfg.relays);
    revalidateMs = cfg.revalidate_ms || revalidateMs;
    const now = Date.now();
    for (const [host, tier] of Object.entries(cfg.hints ?? {})) {
      if (tier === 'direct') continue;
      origins.set(host, {
        tier,
        revalidateAt: now + revalidateMs,
        directFails: DIRECT_FAIL_THRESHOLD,
      });
    }
  } catch {
    // Ядро не ответило — работаем как раньше.
  }
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

  const now = Date.now();
  const state = origins.get(origin);
  // До ревалидации тиры ниже залипшего не трогаем — иначе каждый запрос
  // платит таймаутом за заведомо закрытый путь.
  const from = !state || now >= state.revalidateAt ? 'direct' : state.tier;
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
const reported = new Map<string, Tier>();

function report(origin: string, tier: Tier): void {
  if (reported.get(origin) === tier) return;
  reported.set(origin, tier);
  void invoke('edge_note', { origin, tier, ok: true }).catch(() => {});
}

export function noteHop(hop: Hop, ok: boolean): void {
  const now = Date.now();
  const prev = origins.get(hop.origin);

  if (ok) {
    const tier = hop.tier;
    // Часы ревалидации перезапускает только СМЕНА тира — иначе на живом
    // трафике они никогда не досчитают и юзер навсегда останется на relay.
    const revalidateAt = prev && prev.tier === tier ? prev.revalidateAt : now + revalidateMs;
    origins.set(hop.origin, {
      tier,
      revalidateAt,
      directFails: tier === 'direct' ? 0 : DIRECT_FAIL_THRESHOLD,
    });
    report(hop.origin, tier);
    return;
  }

  if (hop.tier !== 'direct') return;
  const state = prev ?? { tier: 'direct' as Tier, revalidateAt: now, directFails: 0 };
  state.directFails += 1;
  state.revalidateAt = now + revalidateMs;
  if (state.tier === 'direct' && state.directFails >= DIRECT_FAIL_THRESHOLD) state.tier = 'relay';
  origins.set(hop.origin, state);
  if (state.tier !== 'direct') report(hop.origin, state.tier);
}

/** Текущий тир — для диагностики и баннера состояния. */
export function tierOf(origin: string): Tier {
  return origins.get(origin)?.tier ?? 'direct';
}
