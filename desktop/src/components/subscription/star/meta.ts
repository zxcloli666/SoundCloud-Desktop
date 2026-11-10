import {
  AudioLines,
  Bell,
  Database,
  Flame,
  Globe,
  Heart,
  ListMusic,
  Music,
  RefreshCw,
  Sparkles,
  Waves,
} from '../../../lib/icons';
import type { Entitlement } from '../../../lib/pay-client';
import { SuperHeart } from '../../music/superlike/SuperHeart';

/** Flow steps for the STAR membership page. */
export type Step =
  | 'overview'
  | 'method'
  | 'pay'
  | 'success'
  | 'redeem'
  | 'manage'
  | 'invite'
  | 'gifts'
  | 'plan';

/** Who the pass is for: the buyer, or a friend through a gift code. */
export type Recipient = 'self' | 'gift';

/** Perks shown on overview / success — icon + i18n title and tag (`starpass.perk.<key>.title|tag`). */
export const FRESH_PERKS = [
  { key: 'effects', Icon: Waves },
  { key: 'releases', Icon: Bell },
  { key: 'importSync', Icon: ListMusic },
  { key: 'streak', Icon: Flame },
] as const;

export const CORE_PERKS = [
  { key: 'goPlus', Icon: Music },
  { key: 'server', Icon: Database },
  { key: 'sync', Icon: RefreshCw },
  { key: 'uq', Icon: AudioLines },
  { key: 'whitelist', Icon: Globe },
  { key: 'soundwave', Icon: Sparkles },
  { key: 'superlikes', Icon: SuperHeart },
  { key: 'support', Icon: Heart },
] as const;

export const PERKS = [...FRESH_PERKS, ...CORE_PERKS];

export type FreshPerkKey = (typeof FRESH_PERKS)[number]['key'];

/** Map a plan's month count to its i18n label key. */
export function monthsKey(months: number): 'year' | 'quarter' | 'month' {
  return months >= 12 ? 'year' : months >= 3 ? 'quarter' : 'month';
}

/** The entitlement that defines the active window (latest end). */
export function primaryEntitlement(ents: Entitlement[]): Entitlement | null {
  return ents.reduce<Entitlement | null>((b, e) => (!b || e.ends_at > b.ends_at ? e : b), null);
}
