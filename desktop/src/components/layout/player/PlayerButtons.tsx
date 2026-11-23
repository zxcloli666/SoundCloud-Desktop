import React, { type ReactNode } from 'react';
import type { LayoutId } from '../../../lib/layout';
import { useLayout } from '../../../lib/use-layout';
import { EffectsBtn } from '../../music/effects/EffectsBtn';
import { TogetherButton } from '../../together/TogetherButton';
import { VoiceMicButton } from '../../voice/VoiceMicButton';
import { SleepTimerButton } from '../SleepTimerButton';
import { VolumeFlyout, VolumeLabel, VolumeSlider } from '../VolumeControls';
import { playerBtn } from './button-class';
import { LikeBtn } from './LikeBtn';
import { AddToPlaylistBtn, AlbumBtn, BlockBtn, DislikeBtn, QualityBadge } from './reactions';
import { EqBtn, LyricsBtn, QueueBtn } from './tools';
import { AbLoopBtn, NextBtn, PlayPauseBtn, PrevBtn, RepeatBtn, ShuffleBtn } from './transport';
import { TuningBtn } from './tuning';

export type PlayerButtonId = LayoutId<'player'>;

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

const BUTTONS: Record<PlayerButtonId, (ctx: PlayerContext) => ReactNode> = {
  like: () => <LikeBtn />,
  dislike: () => <DislikeBtn />,
  addToPlaylist: () => <AddToPlaylistBtn />,
  album: () => <AlbumBtn />,
  block: () => <BlockBtn />,
  quality: () => <QualityBadge />,
  shuffle: () => <ShuffleBtn />,
  repeat: () => <RepeatBtn />,
  abLoop: () => <AbLoopBtn />,
  together: () => <TogetherButton />,
  mic: () => <VoiceMicButton className={playerBtn} />,
  sleep: () => <SleepTimerButton className={playerBtn} />,
  tuning: () => <TuningBtn />,
  eq: () => <EqBtn />,
  effects: () => <EffectsBtn className={playerBtn} />,
  lyrics: () => <LyricsBtn />,
  queue: (ctx) => <QueueBtn onClick={ctx.onQueueToggle} active={ctx.queueOpen} />,
  volume: () => <VolumeGroup />,
};

const TRACK_IDS: readonly PlayerButtonId[] = [
  'like',
  'dislike',
  'addToPlaylist',
  'album',
  'block',
  'quality',
];
const TRANSPORT_IDS: readonly PlayerButtonId[] = ['shuffle', 'repeat', 'abLoop'];
const POPOVER_IDS: readonly PlayerButtonId[] = ['mic', 'sleep', 'tuning', 'eq', 'effects'];

function useVisible(): ReadonlySet<PlayerButtonId> {
  const layout = useLayout('player');
  return React.useMemo(() => new Set(layout.filter((e) => !e.hidden).map((e) => e.id)), [layout]);
}

function usePlayerOrder(): PlayerButtonId[] {
  const layout = useLayout('player');
  return React.useMemo(() => layout.map((e) => e.id), [layout]);
}

function Group({
  ids,
  ctx,
  className,
}: {
  ids: readonly PlayerButtonId[];
  ctx: PlayerContext;
  className: string;
}) {
  const visible = useVisible();
  const order = usePlayerOrder();
  const shown = order.filter((id) => ids.includes(id) && visible.has(id));
  if (shown.length === 0) return null;
  return (
    <div className={className}>
      {shown.map((id) => (
        <React.Fragment key={id}>{BUTTONS[id](ctx)}</React.Fragment>
      ))}
    </div>
  );
}

const NO_IDS: readonly PlayerButtonId[] = [];

interface ToolProps {
  ctx: PlayerContext;
  omit?: readonly PlayerButtonId[];
  className?: string;
}

export const TrackButtons = React.memo(
  ({ ctx, className = 'npb-track-btns' }: { ctx: PlayerContext; className?: string }) => (
    <Group ids={TRACK_IDS} ctx={ctx} className={className} />
  ),
);

export const ToolButtons = React.memo(
  ({ ctx, omit = NO_IDS, className = 'npb-tool-btns' }: ToolProps) => {
    const rest = React.useMemo(
      () =>
        (Object.keys(BUTTONS) as PlayerButtonId[]).filter(
          (id) => !TRACK_IDS.includes(id) && !TRANSPORT_IDS.includes(id) && !omit.includes(id),
        ),
      [omit],
    );
    return <Group ids={rest} ctx={ctx} className={className} />;
  },
);

export const QueueSlot = React.memo(({ ctx }: { ctx: PlayerContext }) => {
  const visible = useVisible();
  return visible.has('queue') ? BUTTONS.queue(ctx) : null;
});

export const TransportButtons = React.memo(({ ctx }: { ctx: PlayerContext }) => {
  const visible = useVisible();
  const order = usePlayerOrder();
  const after = order.filter(
    (id) => id !== 'shuffle' && TRANSPORT_IDS.includes(id) && visible.has(id),
  );
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-0.5" data-ui="player-transport">
      <div className="flex items-center justify-end gap-[inherit]">
        {visible.has('shuffle') && BUTTONS.shuffle(ctx)}
        <PrevBtn />
      </div>
      <PlayPauseBtn />
      <div className="flex items-center justify-start gap-[inherit]">
        <NextBtn />
        {after.map((id) => (
          <React.Fragment key={id}>{BUTTONS[id](ctx)}</React.Fragment>
        ))}
      </div>
    </div>
  );
});

export const HiddenPopovers = React.memo(({ ctx }: { ctx: PlayerContext }) => {
  const visible = useVisible();
  const hidden = POPOVER_IDS.filter((id) => !visible.has(id));
  if (hidden.length === 0) return null;
  return (
    <div aria-hidden className="npb-ghosts" data-ui="player-ghosts">
      {hidden.map((id) => (
        <React.Fragment key={id}>{BUTTONS[id](ctx)}</React.Fragment>
      ))}
    </div>
  );
});
