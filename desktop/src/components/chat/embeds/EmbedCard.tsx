import { memo, useMemo } from 'react';
import { receivedEmbed } from '../../../lib/chat/embed-snapshot';
import type { Embed } from '../../../lib/chat/types';
import { PlaylistEmbed } from './PlaylistEmbed';
import { RoomInviteEmbed } from './RoomInviteEmbed';
import { TrackEmbed } from './TrackEmbed';
import { UserEmbed } from './UserEmbed';

export interface EmbedCardProps {
  embed: Embed;
  mine?: boolean;
  compact?: boolean;
}

export const EmbedCard = memo(function EmbedCard({
  embed,
  mine = false,
  compact = false,
}: EmbedCardProps) {
  const safe = useMemo(() => receivedEmbed(embed), [embed]);
  if (!safe) return null;
  switch (safe.kind) {
    case 'track':
      return <TrackEmbed embed={safe} mine={mine} compact={compact} />;
    case 'playlist':
      return <PlaylistEmbed embed={safe} mine={mine} compact={compact} />;
    case 'user':
      return <UserEmbed embed={safe} mine={mine} compact={compact} />;
    case 'room_invite':
      return <RoomInviteEmbed embed={safe} mine={mine} compact={compact} />;
    default:
      return null;
  }
});
