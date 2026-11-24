import React, { type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Ellipsis } from '../../../lib/icons';
import { type Track, usePlayerStore } from '../../../stores/player';
import { useTrackMenuStore } from '../../../stores/trackMenu';
import { playerBtn } from './button-class';

const GAP = 10;

function openBeside(button: HTMLElement, track: Track) {
  const box = button.getBoundingClientRect();
  const below = box.bottom < window.innerHeight / 3;
  useTrackMenuStore.getState().open({
    track,
    x: box.left,
    y: below ? box.bottom + GAP : box.top - GAP,
    above: !below,
  });
}

export const MoreBtn = React.memo(() => {
  const { t } = useTranslation();
  const track = usePlayerStore((s) => s.currentTrack);
  const open = useTrackMenuStore((s) => s.target?.above !== undefined);
  return (
    <button
      type="button"
      disabled={!track}
      onClick={(e: MouseEvent<HTMLButtonElement>) => track && openBeside(e.currentTarget, track)}
      title={t('player.more')}
      aria-label={t('player.more')}
      aria-haspopup="menu"
      aria-expanded={open}
      data-ui="player-more"
      className={playerBtn(open)}
    >
      <Ellipsis size={16} />
    </button>
  );
});
