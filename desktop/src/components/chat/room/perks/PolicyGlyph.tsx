import { memo } from 'react';
import type { RoomImagesPolicy } from '../../../../lib/chat/media-types';
import { Crown, Shield, User } from '../../../../lib/icons';

type Who = 'host' | 'mod' | 'member';

const PEOPLE: Who[] = ['host', 'mod', 'member', 'member'];
const PEOPLE_KEYS = ['host', 'mod', 'member-a', 'member-b'];

function allowed(policy: RoomImagesPolicy, who: Who): boolean {
  if (policy === 'off') return false;
  return policy === 'members' || who !== 'member';
}

function Face({ who, on }: { who: Who; on: boolean }) {
  const Icon = who === 'host' ? Crown : who === 'mod' ? Shield : User;
  return (
    <span
      className={`perk-motion flex size-[15px] items-center justify-center rounded-full transition-colors duration-300 ${
        on ? 'bg-accent text-accent-contrast' : 'bg-ink/[0.08] text-ink-30'
      }`}
    >
      <Icon size={8.5} strokeWidth={2.8} />
    </span>
  );
}

export const PolicyGlyph = memo(function PolicyGlyph({ policy }: { policy: RoomImagesPolicy }) {
  return (
    <span aria-hidden className="relative flex items-center -space-x-[3px]">
      {PEOPLE.map((who, index) => (
        <Face key={PEOPLE_KEYS[index]} who={who} on={allowed(policy, who)} />
      ))}
      {policy === 'off' && (
        <span className="absolute inset-x-[-2px] top-1/2 h-[1.5px] -translate-y-1/2 -rotate-12 rounded-full bg-ink/50" />
      )}
    </span>
  );
});
