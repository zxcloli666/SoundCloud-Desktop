import React from 'react';
import type { Aura } from '../../lib/aura';
import { art } from '../../lib/formatters';
import { Users } from '../../lib/icons';
import { usePerfMode } from '../../lib/perf';
import type { StarTier } from '../../lib/star-tenure';
import { StarBadge } from '../layout/StarSubscription';

interface AvatarArtifactProps {
  username: string;
  avatarUrl: string | null | undefined;
  hasStar: boolean;
  tier?: StarTier;
  aura: Aura;
}

function AvatarArtifactImpl({ username, avatarUrl, hasStar, tier = 0, aura }: AvatarArtifactProps) {
  const perf = usePerfMode();
  const url = art(avatarUrl, 't500x500');
  return (
    <div className="relative shrink-0 self-center @min-[720px]:self-start group w-[148px] h-[148px] @lg:w-[180px] @lg:h-[180px]">
      {hasStar && (
        <div
          className="absolute -inset-[5px] rounded-[2.2rem] pointer-events-none overflow-hidden"
          style={{
            padding: '3px',
            WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
          }}
        >
          <div
            className="absolute -inset-[40%]"
            style={{
              background: `conic-gradient(from 0deg, ${aura.orbs[0]}, ${aura.orbs[1]}, ${aura.orbs[2]}, ${aura.orbs[0]})`,
              animation: perf.idleAnim ? 'ring-rotate 12s linear infinite' : undefined,
            }}
          />
        </div>
      )}
      <div className="relative w-[148px] h-[148px] @lg:w-[180px] @lg:h-[180px] rounded-[2rem] overflow-hidden bg-ink/[0.03] ring-1 ring-ink/10">
        {url ? (
          <img
            src={url}
            alt={username}
            className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-[1.06]"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Users size={56} className="text-ink-15" />
          </div>
        )}
        {hasStar && (
          <div className="absolute bottom-2 right-2 z-10 pointer-events-none">
            <StarBadge size="lg" tier={tier} />
          </div>
        )}
      </div>
    </div>
  );
}

export const AvatarArtifact = React.memo(AvatarArtifactImpl);
