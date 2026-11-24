import React from 'react';
import { useTranslation } from 'react-i18next';
import { listMusic16, MicVocal } from '../../../lib/icons';
import { useLyricsStore } from '../../../stores/lyrics';
import { playerBtn } from './button-class';

export const QueueBtn = React.memo(
  ({ onClick, active }: { onClick: () => void; active: boolean }) => {
    const { t } = useTranslation();
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        title={t('player.queue')}
        aria-label={t('player.queue')}
        data-ui="player-queue"
        className={playerBtn(active)}
      >
        {listMusic16}
      </button>
    );
  },
);

export const LyricsBtn = React.memo(() => {
  const { t } = useTranslation();
  const open = useLyricsStore((s) => s.open);
  const closePanel = useLyricsStore((s) => s.close);
  const openPanel = useLyricsStore((s) => s.openPanel);
  return (
    <button
      type="button"
      onClick={() => {
        if (open) closePanel();
        else openPanel({ tab: 'lyrics', rightPanelOpen: true });
      }}
      aria-pressed={open}
      title={t('track.lyrics')}
      aria-label={t('track.lyrics')}
      data-ui="player-lyrics"
      className={playerBtn(open)}
    >
      <MicVocal size={16} />
    </button>
  );
});
