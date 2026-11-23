import React, { type CSSProperties, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type CoverPalette, tintFromRgb, useCoverPalette } from '../../lib/cover-palette';
import { usePlayerStore } from '../../stores/player';
import { QueueEmpty } from './queue/QueueEmpty';
import { QueueHeader } from './queue/QueueHeader';
import { QueueHero } from './queue/QueueHero';
import { QueueList } from './queue/QueueList';
import { useHeroGone } from './queue/use-hero-gone';

const EXIT_MS = 460;

type Phase = 'closed' | 'open';

function paletteStyle(palette: CoverPalette | null): CSSProperties {
  if (!palette)
    return { '--q-c1': 'var(--color-accent)', '--q-c2': 'var(--color-accent)' } as CSSProperties;
  const one = tintFromRgb(palette.primary).join(' ');
  const two = tintFromRgb(palette.secondary).join(' ');
  return { '--q-c1': `rgb(${one})`, '--q-c2': `rgb(${two})` } as CSSProperties;
}

function QueueFrame({ phase, onClose }: { phase: Phase; onClose: () => void }) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [playedOpen, setPlayedOpen] = useState(false);
  const empty = usePlayerStore((s) => s.queue.length === 0 && !s.currentTrack);
  const palette = useCoverPalette(true);
  const { gone, sentinelRef } = useHeroGone(scrollRef);

  useEffect(() => {
    if (phase === 'open') panelRef.current?.focus({ preventScroll: true });
  }, [phase]);

  const toTop = () => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <>
      <div className="queue-scrim fixed inset-0 z-40" data-state={phase} onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-label={t('player.queue')}
        tabIndex={-1}
        data-ui="queue"
        data-state={phase}
        style={paletteStyle(palette)}
        className="queue-panel fixed top-16 right-2 bottom-2 z-50 flex flex-col overflow-hidden outline-none"
      >
        <div className="queue-bg absolute inset-0" />
        <div
          data-empty={empty}
          className="queue-wash pointer-events-none absolute inset-x-0 top-0 h-[520px]"
        />
        <div className="relative flex min-h-0 flex-1 flex-col" style={{ isolation: 'isolate' }}>
          <QueueHeader compact={gone && !empty} onClose={onClose} onTop={toTop} />
          <div className="relative min-h-0 flex-1">
            <div
              ref={scrollRef}
              data-scroll-root
              className="h-full overflow-x-hidden overflow-y-auto overscroll-contain"
            >
              {empty ? (
                <QueueEmpty />
              ) : (
                <div>
                  <QueueHero sentinelRef={sentinelRef} />
                  <div className="px-3 pb-3">
                    <QueueList
                      playedOpen={playedOpen}
                      onPlayedToggle={() => setPlayedOpen((v) => !v)}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export const QueuePanel = React.memo(
  ({ open, onClose }: { open: boolean; onClose: () => void }) => {
    const [mounted, setMounted] = useState(open);
    const [phase, setPhase] = useState<Phase>('closed');

    useEffect(() => {
      if (open) {
        setMounted(true);
        let inner = 0;
        const outer = requestAnimationFrame(() => {
          inner = requestAnimationFrame(() => setPhase('open'));
        });
        return () => {
          cancelAnimationFrame(outer);
          cancelAnimationFrame(inner);
        };
      }
      setPhase('closed');
      const timer = setTimeout(() => setMounted(false), EXIT_MS);
      return () => clearTimeout(timer);
    }, [open]);

    if (!mounted) return null;
    return <QueueFrame phase={phase} onClose={onClose} />;
  },
);
