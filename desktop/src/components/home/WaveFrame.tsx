import {memo, type ReactNode} from 'react';
import {usePerfMode} from '../../lib/perf';
import {LIBRARY_KEYFRAMES} from '../library/keyframes';
import type {Soundprint} from '../library/useSoundprint';
import {Atmosphere} from '../search/Atmosphere';
import {USER_PAGE_KEYFRAMES} from '../user/keyframes';
import {PAGE_STAR_SEEDS, StarField} from '../user/StarField';

/** Shell for the "Wave" home — a deeper, star-lit room. The genre-aura
 *  atmosphere bleeds to the listener's taste; a viewport-pinned star field
 *  twinkles behind the content (fixed, so it never cuts off at the scroll's end).
 *  All motion gates on perf.atmosphere/idleAnim via the reused pieces. */
export const WaveFrame = memo(function WaveFrame({
  sound,
  children,
}: {
  sound: Soundprint;
  children: ReactNode;
}) {
  const perf = usePerfMode();
  return (
    <div data-ui="page" data-page="home" className="relative min-h-full w-full">
      <style>{LIBRARY_KEYFRAMES + USER_PAGE_KEYFRAMES}</style>
      {perf.atmosphere && <Atmosphere tint={sound.tint} energy={sound.energy} />}
      {/* star field — viewport-pinned (fixed) so it never cuts off at the
                content's bottom edge, exactly like Atmosphere */}
      {perf.atmosphere && (
        <div
          aria-hidden
          className="fixed inset-0 pointer-events-none overflow-hidden"
          style={{ contain: 'strict' }}
        >
          <StarField aura={sound.aura} seeds={PAGE_STAR_SEEDS} intensity={0.7} glow={false} />
        </div>
      )}
      <div
        className="relative z-10 min-h-full max-w-[1320px] mx-auto px-4 md:px-8 pt-5 pb-6 space-y-8"
        style={{ isolation: 'isolate' }}
      >
        {children}
      </div>
    </div>
  );
});
