import * as Popover from '@radix-ui/react-popover';
import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SlidersVertical } from '../../lib/icons';
import { usePerfMode } from '../../lib/perf';
import { speaksForItself } from '../../lib/sound/live';
import { useSoundTokens } from '../../lib/sound/use-live';
import { closeSound, openSound, useSoundWindow } from '../../stores/sound-window';
import { SoundConsole } from './SoundConsole';
import { SoundTokens } from './SoundTokens';

export const SoundBtn = memo(function SoundBtn() {
  const { t } = useTranslation();
  const open = useSoundWindow((s) => s.open);
  const [button, setButton] = useState<HTMLButtonElement | null>(null);
  const tokens = useSoundTokens();
  const blur = usePerfMode().blur(28);
  const live = tokens.length > 0;
  const deck = button?.closest('[data-ui="deck-controls"]') ?? null;
  const dock = deck ?? button?.closest('.npb-dock') ?? button;
  const anchor = useMemo(() => ({ current: dock as Element }), [dock]);

  useEffect(() => closeSound, []);

  return (
    <Popover.Root open={open} onOpenChange={(wanted) => (wanted ? openSound() : closeSound())}>
      <Popover.Anchor virtualRef={anchor} />
      <Popover.Trigger asChild>
        <button
          ref={setButton}
          type="button"
          data-ui="player-sound"
          data-live={live ? '' : undefined}
          title={t('sound.title')}
          aria-label={t('sound.title')}
          className="sound-btn"
        >
          {!speaksForItself(tokens) && (
            <>
              <SlidersVertical size={16} className="sound-faders" />
              <span className="sound-name">{t('sound.title')}</span>
            </>
          )}
          <SoundTokens tokens={tokens} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          data-ui="sound-console"
          side="top"
          align={deck ? 'center' : 'end'}
          sideOffset={14}
          collisionPadding={12}
          onOpenAutoFocus={(e) => e.preventDefault()}
          data-glass={blur > 0 ? '' : undefined}
          style={blur > 0 ? { backdropFilter: `blur(${blur}px) saturate(1.6)` } : undefined}
          className="sound-pop z-[200] outline-none data-[state=open]:animate-fade-in-up"
        >
          <SoundConsole />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
});
