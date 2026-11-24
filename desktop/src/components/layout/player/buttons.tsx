import React, { type ReactNode } from 'react';
import type { PlayerButtonId } from '../../../lib/player-zones';
import { EffectsBtn } from '../../music/effects/EffectsBtn';
import { SoundBtn } from '../../sound/SoundBtn';
import { TogetherButton } from '../../together/TogetherButton';
import { VoiceMicButton } from '../../voice/VoiceMicButton';
import { SleepTimerButton } from '../SleepTimerButton';
import { VolumeFlyout, VolumeLabel, VolumeSlider } from '../VolumeControls';
import { playerBtn } from './button-class';
import { LikeBtn } from './LikeBtn';
import { MoreBtn } from './more';
import { AddToPlaylistBtn, AlbumBtn, BlockBtn, DislikeBtn, QualityBadge } from './reactions';
import { EqBtn, LyricsBtn, QueueBtn } from './tools';
import { AbLoopBtn, RepeatBtn, ShuffleBtn } from './transport';
import { TuningBtn } from './tuning';

export interface PlayerContext {
  onQueueToggle: () => void;
  queueOpen: boolean;
}

const VolumeGroup = React.memo(() => (
  <>
    <VolumeFlyout />
    <div className="npb-vol-slider flex items-center gap-2 pl-1">
      <VolumeSlider className="w-[72px]" />
      <VolumeLabel />
    </div>
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
  abLoop: () => <AbLoopBtn />,
  together: () => <TogetherButton />,
  mic: () => <VoiceMicButton className={playerBtn} />,
  sleep: () => <SleepTimerButton className={playerBtn} />,
  tuning: () => <TuningBtn />,
  eq: () => <EqBtn />,
  effects: () => <EffectsBtn className={playerBtn} />,
  sound: () => <SoundBtn />,
  lyrics: () => <LyricsBtn />,
  queue: (ctx) => <QueueBtn onClick={ctx.onQueueToggle} active={ctx.queueOpen} />,
  volume: () => <VolumeGroup />,
};
