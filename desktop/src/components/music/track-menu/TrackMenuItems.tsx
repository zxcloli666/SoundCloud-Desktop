import { useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { shareTrack } from '../../../lib/chat/share';
import {
  ArrowDownToLine,
  ArrowUpToLine,
  ClipboardCopy,
  Disc3,
  Download,
  Heart,
  LinkIcon,
  ListEnd,
  ListPlus,
  ListStart,
  ListX,
  Send,
  User,
} from '../../../lib/icons';
import { setTrackLiked } from '../../../lib/like-toggle';
import { useLiked } from '../../../lib/likes';
import { LIKED_ORDER_SCOPE, likesOrder } from '../../../lib/likes-order';
import { isLocalUrn } from '../../../lib/local-library';
import { toggleSuperlike } from '../../../lib/superlike-actions';
import { SUPERLIKED_ORDER_SCOPE, superlikesOrder } from '../../../lib/superlikes-order';
import { useSuperliked } from '../../../lib/superlikes';
import {
  copyTrackLabel,
  copyTrackLink,
  playTrackLast,
  playTrackNext,
  saveTrackFile,
} from '../../../lib/track-actions';
import { getArtistDisplay, getArtistTarget } from '../../../lib/track-display';
import { useAppMode } from '../../../stores/app-status';
import { selectChatEnabled, useChatStore } from '../../../stores/chat';
import { usePlayerStore } from '../../../stores/player';
import { type TrackMenuTarget, useTrackMenuStore } from '../../../stores/trackMenu';
import { SuperHeart } from '../superlike/SuperHeart';
import { MenuItem, MenuSeparator } from './MenuItem';

function orderOf(scope: string | undefined, liked: boolean, superliked: boolean) {
  if (scope === LIKED_ORDER_SCOPE && liked) return likesOrder;
  if (scope === SUPERLIKED_ORDER_SCOPE && superliked) return superlikesOrder;
  return null;
}

export function TrackMenuItems({ target }: { target: TrackMenuTarget }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { track, queueIndex } = target;
  const liked = useLiked(track.urn);
  const superliked = useSuperliked(track.urn, track.user_superlike) && liked;
  const online = useAppMode() === 'online';
  const playable = getArtistDisplay(track).availability === 'indexed';
  const remote = !isLocalUrn(track.urn);
  const artistPath = getArtistTarget(track);
  const order = online ? orderOf(target.scope, liked, superliked) : null;
  const chat = useChatStore(selectChatEnabled);

  const run = (action: () => void) => () => {
    useTrackMenuStore.getState().close();
    action();
  };

  const removeFromQueue = () => {
    const player = usePlayerStore.getState();
    if (queueIndex !== undefined && player.queue[queueIndex]?.urn === track.urn) {
      player.removeFromQueue(queueIndex);
    }
  };

  const download = async () => {
    try {
      await saveTrackFile(track);
      toast.success(t('track.downloaded'));
    } catch (e: unknown) {
      if (e instanceof Error && e.message === 'cancelled') return;
      toast.error(String(e));
    }
  };

  const groups: [string, React.ReactNode[]][] = [
    [
      'queue',
      [
        playable && (
          <MenuItem
            key="next"
            icon={<ListStart size={15} />}
            label={t('trackMenu.playNext')}
            onSelect={run(() => playTrackNext(track))}
          />
        ),
        playable && (
          <MenuItem
            key="last"
            icon={<ListEnd size={15} />}
            label={t('trackMenu.playLast')}
            onSelect={run(() => playTrackLast(track))}
          />
        ),
        queueIndex !== undefined && (
          <MenuItem
            key="remove"
            tone="danger"
            icon={<ListX size={15} />}
            label={t('trackMenu.removeFromQueue')}
            onSelect={run(removeFromQueue)}
          />
        ),
      ],
    ],
    [
      'library',
      [
        online && remote && playable && (
          <MenuItem
            key="like"
            active={liked}
            icon={<Heart size={15} fill={liked ? 'currentColor' : 'none'} />}
            label={liked ? t('trackMenu.unlike') : t('trackMenu.like')}
            onSelect={run(() => void setTrackLiked(qc, track, !liked))}
          />
        ),
        online && remote && playable && (
          <MenuItem
            key="superlike"
            active={superliked}
            icon={<SuperHeart size={15} />}
            label={superliked ? t('trackMenu.removeSuperlike') : t('trackMenu.superlike')}
            onSelect={run(() => toggleSuperlike(track))}
          />
        ),
        online && remote && playable && (
          <MenuItem
            key="playlist"
            icon={<ListPlus size={15} />}
            label={t('trackMenu.addToPlaylist')}
            onSelect={() => useTrackMenuStore.getState().openPlaylistDialog(track.urn)}
          />
        ),
        remote && playable && (
          <MenuItem
            key="download"
            icon={<Download size={15} />}
            label={t('trackMenu.download')}
            onSelect={run(() => void download())}
          />
        ),
      ],
    ],
    [
      'order',
      [
        order && (
          <MenuItem
            key="top"
            icon={<ArrowUpToLine size={15} />}
            label={t('likesOrder.moveToTop')}
            onSelect={run(() => order.move(qc, track, 'top'))}
          />
        ),
        order && (
          <MenuItem
            key="bottom"
            icon={<ArrowDownToLine size={15} />}
            label={t('likesOrder.moveToBottom')}
            onSelect={run(() => order.move(qc, track, 'bottom'))}
          />
        ),
      ],
    ],
    [
      'navigate',
      [
        online && remote && playable && (
          <MenuItem
            key="track"
            icon={<Disc3 size={15} />}
            label={t('trackMenu.goToTrack')}
            onSelect={run(() => navigate(`/track/${encodeURIComponent(track.urn)}`))}
          />
        ),
        online && remote && artistPath && (
          <MenuItem
            key="artist"
            icon={<User size={15} />}
            label={t('trackMenu.goToArtist')}
            onSelect={run(() => navigate(artistPath))}
          />
        ),
      ],
    ],
    [
      'copy',
      [
        chat && remote && (
          <MenuItem
            key="share"
            icon={<Send size={15} />}
            label={t('chat.embeds.share.action')}
            onSelect={run(() => shareTrack(track))}
          />
        ),
        track.permalink_url && (
          <MenuItem
            key="link"
            icon={<LinkIcon size={15} />}
            label={t('trackMenu.copyLink')}
            onSelect={run(() => copyTrackLink(track))}
          />
        ),
        <MenuItem
          key="label"
          icon={<ClipboardCopy size={15} />}
          label={t('trackMenu.copyLabel')}
          onSelect={run(() => copyTrackLabel(track))}
        />,
      ],
    ],
  ];
  const visible = groups
    .map(([id, items]) => [id, items.filter(Boolean)] as const)
    .filter(([, items]) => items.length > 0);

  return (
    <>
      {visible.map(([id, items], i) => (
        <React.Fragment key={id}>
          {i > 0 && <MenuSeparator />}
          {items}
        </React.Fragment>
      ))}
    </>
  );
}
