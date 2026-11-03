import {memo} from 'react';
import {type Aura, auraRgba} from '../../lib/aura';
import {Disc3} from '../../lib/icons';
import {usePerfMode} from '../../lib/perf';

interface AlbumCoverArtifactProps {
  title: string;
  coverUrl?: string;
  hasStar: boolean;
  aura: Aura;
    /** Rotate the ring. Defaults to true (idle spin); pass `isPlaying` to spin only on playback. */
    spinning?: boolean;
}

function AlbumCoverArtifactImpl({
                                    title,
                                    coverUrl,
                                    hasStar,
                                    aura,
                                    spinning = true,
                                }: AlbumCoverArtifactProps) {
    const {idleAnim} = usePerfMode();
  return (
    <div className="relative shrink-0 self-center lg:self-start group w-[180px] h-[180px] md:w-[220px] md:h-[220px]">
      {hasStar && (
        <div
          className="absolute -inset-[5px] rounded-[2.4rem] pointer-events-none overflow-hidden"
          style={{
            padding: '3px',
            WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
            filter: `drop-shadow(0 0 14px ${aura.orbs[0]}aa)`,
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
        className="relative w-full h-full rounded-[2.2rem] overflow-hidden"
        style={{
          background: 'rgb(var(--ink) / 0.03)',
          boxShadow: hasStar
            ? `0 35px 80px ${auraRgba(aura, 0.4)}, inset 0 0 0 1px rgb(var(--ink) / 0.12), inset 0 1px 0 rgb(var(--ink) / 0.15)`
            : '0 25px 60px rgb(var(--shade) / calc(0.55 * var(--shade-alpha))), inset 0 0 0 1px rgb(var(--ink) / 0.08), inset 0 1px 0 rgb(var(--ink) / 0.1)',
        }}
      >
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-[1.06]"
            decoding="async"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              background: hasStar
                ? `radial-gradient(circle at 30% 20%, ${auraRgba(aura, 0.35)}, transparent 70%)`
                : 'rgb(var(--ink) / 0.03)',
            }}
          >
            <Disc3 size={72} className="text-ink-15" />
          </div>
        )}

        <div
          className="absolute inset-x-0 top-0 h-1/2 pointer-events-none"
          style={{
            background:
              'linear-gradient(180deg, rgb(var(--ink) / 0.10) 0%, rgb(var(--ink) / 0) 100%)',
            mixBlendMode: 'overlay',
          }}
        />
      </div>
    </div>
  );
}

export const AlbumCoverArtifact = memo(AlbumCoverArtifactImpl);
