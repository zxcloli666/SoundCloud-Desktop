import React from 'react';
import { type Aura, auraRgba } from '../../lib/aura';
import { art } from '../../lib/formatters';
import { Users } from '../../lib/icons';
import { usePerfMode } from '../../lib/perf';

interface AvatarArtifactProps {
  username: string;
  avatarUrl: string | null | undefined;
  hasStar: boolean;
  aura: Aura;
}

function AvatarArtifactImpl({ username, avatarUrl, hasStar, aura }: AvatarArtifactProps) {
  const perf = usePerfMode();
  const url = art(avatarUrl, 't500x500');
  return (
    <div className="relative shrink-0 self-center lg:self-start group w-[148px] h-[148px] md:w-[180px] md:h-[180px]">
      {hasStar && (
        <div
          className="absolute -inset-[5px] rounded-[2.2rem] pointer-events-none overflow-hidden"
          style={{
            padding: '3px',
            WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
            filter: perf.glow ? `drop-shadow(0 0 14px ${aura.orbs[0]}aa)` : undefined,
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
      <div
        className="relative w-[148px] h-[148px] md:w-[180px] md:h-[180px] rounded-[2rem] overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '0.5px solid rgba(255,255,255,0.10)',
          boxShadow: hasStar
            ? `0 30px 60px ${auraRgba(aura, 0.25)}, inset 0 1px 0 rgba(255,255,255,0.10)`
            : '0 20px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}
      >
        {url ? (
          <img
            src={url}
            alt={username}
            className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-[1.06]"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Users size={56} className="text-white/15" />
          </div>
        )}
      </div>
    </div>
  );
}

export const AvatarArtifact = React.memo(AvatarArtifactImpl);
