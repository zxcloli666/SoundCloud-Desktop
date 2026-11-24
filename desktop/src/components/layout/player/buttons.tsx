import React, { type ReactNode } from 'react';
import type { PlayerButtonId } from '../../../lib/player-zones';
import { SoundBtn } from '../../sound/SoundBtn';
import { TogetherButton } from '../../together/TogetherButton';
import { VoiceMicButton } from '../../voice/VoiceMicButton';
import { VolumeArea, VolumeFlyout, VolumeLabel, VolumeSlider } from '../VolumeControls';
import { playerBtn } from './button-class';
import { LikeBtn } from './LikeBtn';
import { MoreBtn } from './more';
import { AddToPlaylistBtn, AlbumBtn, BlockBtn, DislikeBtn, QualityBadge } from './reactions';
import { LyricsBtn, QueueBtn } from './tools';
import { RepeatBtn, ShuffleBtn } from './transport';

export interface PlayerContext {
  onQueueToggle: () => void;
  queueOpen: boolean;
}

const VolumeGroup = React.memo(() => (
  <>
    <VolumeFlyout />
    <VolumeArea className="npb-vol-slider flex items-center gap-2 pl-1">
      <VolumeSlider className="w-[72px]" />
      <VolumeLabel />
    </VolumeArea>
  </>
));

export const BUTTONS: Record<PlayerButtonId, (ctx: PlayerContext) => ReactNode> = {
  like: () => <LikeBtn />,
  dislike: () => <DislikeBtn />,
  addToPlaylist: () => <AddToPlaylistBtn />,
  album: () => <AlbumBtn />,
  block: () => <BlockBtn />,
  quality: () => <QualityBadge />,
  more: () => <MoreBtn />,
  shuffle: () => <ShuffleBtn />,
  repeat: () => <RepeatBtn />,
  together: () => <TogetherButton />,
  mic: () => <VoiceMicButton className={playerBtn} />,
  sound: () => <SoundBtn />,
  lyrics: () => <LyricsBtn />,
  queue: (ctx) => <QueueBtn onClick={ctx.onQueueToggle} active={ctx.queueOpen} />,
  volume: () => <VolumeGroup />,
};
