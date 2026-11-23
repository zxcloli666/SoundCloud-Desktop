import { memo, type ReactNode } from 'react';
import type { Aura } from '../../lib/aura';
import { Disc3 } from '../../lib/icons';
import { usePerfMode } from '../../lib/perf';

interface AlbumCoverArtifactProps {
  title: string;
  coverUrl?: string;
  hasStar: boolean;
  aura?: Aura;
  spinning?: boolean;
  children?: ReactNode;
}

function AlbumCoverArtifactImpl({
  title,
  coverUrl,
  hasStar,
  aura,
  spinning = true,
  children,
}: AlbumCoverArtifactProps) {
  const { idleAnim } = usePerfMode();
  return (
    <div className="relative shrink-0 self-center @min-[740px]:self-start group w-[180px] h-[180px] @min-[512px]:w-[220px] @min-[512px]:h-[220px]">
      {hasStar && aura && (
        <div
          className="absolute -inset-[5px] rounded-[2.4rem] pointer-events-none overflow-hidden"
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
              animation: idleAnim && spinning ? 'ring-rotate 12s linear infinite' : undefined,
            }}
          />
        </div>
      )}

      <div
        data-ui="artwork"
        className="relative h-full w-full overflow-hidden rounded-3xl bg-ink/[0.03] ring-1 ring-ink/10"
      >
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-[1.06]"
            decoding="async"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Disc3 size={72} className="text-ink-15" />
          </div>
        )}

        {children}
      </div>
    </div>
  );
}

export const AlbumCoverArtifact = memo(AlbumCoverArtifactImpl);
