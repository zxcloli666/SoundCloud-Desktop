import * as Popover from '@radix-ui/react-popover';
import { memo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SlidersVertical } from '../../lib/icons';
import { usePerfMode } from '../../lib/perf';
import { pressPlayerButton } from '../../lib/player-trigger';
import { speaksForItself } from '../../lib/sound/live';
import { useSoundTokens } from '../../lib/sound/use-live';
import { type FullPanel, SoundConsole } from './SoundConsole';
import { SoundTokens } from './SoundTokens';

export const SoundBtn = memo(function SoundBtn() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [onDeck, setOnDeck] = useState(false);
  const tokens = useSoundTokens();
  const trigger = useRef<HTMLButtonElement>(null);
  const anchor = useRef<Element>(null!);
  const next = useRef<FullPanel | null>(null);
  const blur = usePerfMode().blur(28);
  const live = tokens.length > 0;

  const change = (wanted: boolean) => {
    const button = trigger.current;
    if (wanted && button) {
      const deck = button.closest('[data-ui="deck-controls"]');
      anchor.current = deck ?? button.closest('.npb-dock') ?? button;
      setOnDeck(deck !== null);
    }
    setOpen(wanted);
  };
  const openFull = (panel: FullPanel) => {
    next.current = panel;
    setOpen(false);
  };
  const leave = (event: Event) => {
    if (!next.current) return;
    event.preventDefault();
    pressPlayerButton(next.current);
    next.current = null;
  };

  return (
    <Popover.Root open={open} onOpenChange={change}>
      <Popover.Anchor virtualRef={anchor} />
      <Popover.Trigger asChild>
        <button
          ref={trigger}
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
          align={onDeck ? 'center' : 'end'}
          sideOffset={14}
          collisionPadding={12}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={leave}
          data-glass={blur > 0 ? '' : undefined}
          style={blur > 0 ? { backdropFilter: `blur(${blur}px) saturate(1.6)` } : undefined}
          className="sound-pop z-[200] outline-none data-[state=open]:animate-fade-in-up"
        >
          <SoundConsole onFull={openFull} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
});
