import { useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ClipboardCopy,
  Disc3,
  Download,
  Heart,
  LinkIcon,
  ListEnd,
  ListPlus,
  ListStart,
  ListX,
  User,
} from '../../../lib/icons';
import { setTrackLiked } from '../../../lib/like-toggle';
import { useLiked } from '../../../lib/likes';
import { isLocalUrn } from '../../../lib/local-library';
import {
  copyTrackLabel,
  copyTrackLink,
  playTrackLast,
  playTrackNext,
  saveTrackFile,
} from '../../../lib/track-actions';
import { getArtistDisplay, getArtistTarget } from '../../../lib/track-display';
import { useAppMode } from '../../../stores/app-status';
import { usePlayerStore } from '../../../stores/player';
import { type TrackMenuTarget, useTrackMenuStore } from '../../../stores/trackMenu';
import { MenuItem, MenuSeparator } from './MenuItem';

export function TrackMenuItems({ target }: { target: TrackMenuTarget }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { track, queueIndex } = target;
  const liked = useLiked(track.urn);
  const online = useAppMode() === 'online';
  const playable = getArtistDisplay(track).availability === 'indexed';
  const remote = !isLocalUrn(track.urn);
  const artistPath = getArtistTarget(track);

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
