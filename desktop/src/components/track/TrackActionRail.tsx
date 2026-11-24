import React from 'react';
import { useTranslation } from 'react-i18next';
import { MicVocal } from '../../lib/icons';
import { useLyricsStore } from '../../stores/lyrics';
import type { Track } from '../../stores/player';
import { AddToPlaylistButton } from '../music/AddToPlaylistButton';
import { PlayNextButton } from '../music/PlayNextButton';
import { SaveOfflineAction } from '../music/SaveOfflineButton';
import { CopyIconAction, DownloadButton, IconAction, LikeBtn, PlayPill } from './actions';
import { MomentReactionPicker } from './MomentReactionPicker';
import { OwnerTrackActions } from './OwnerTrackActions';
import { SuperlikeBtn } from './SuperlikeBtn';

export const TrackActionRail = React.memo(function TrackActionRail({
  track,
  isPlaying,
  isCurrent,
  isOwner,
  onPlay,
}: {
  track: Track;
  isPlaying: boolean;
  isCurrent: boolean;
  isOwner: boolean;
  onPlay: () => void;
}) {
  const { t } = useTranslation();
  const openLyrics = useLyricsStore((s) => s.openPanel);

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <PlayPill isPlaying={isPlaying} onClick={onPlay} />
      <LikeBtn trackUrn={track.urn} count={track.favoritings_count ?? track.likes_count} />
      <SuperlikeBtn track={track} />
      <div className="flex h-11 items-center gap-0.5 rounded-2xl border border-ink/[0.07] bg-ink/[0.04] px-1.5">
        <IconAction
          icon={<MicVocal size={16} />}
          label={t('track.lyrics')}
          onClick={() => openLyrics('lyrics')}
        />
        <MomentReactionPicker trackUrn={track.urn} isCurrent={isCurrent} />
        <span className="w-px h-5 bg-ink/[0.08] mx-0.5" aria-hidden />
        <AddToPlaylistButton
          track={track}
          size={16}
          className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-ink-60 transition-colors duration-200 hover:bg-ink/[0.07] hover:text-ink-95"
        />
        <PlayNextButton
          track={track}
          size={16}
          className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-ink-60 transition-colors duration-200 hover:bg-ink/[0.07] hover:text-ink-95"
        />
        <CopyIconAction url={track.permalink_url} />
        <SaveOfflineAction track={track} />
        <DownloadButton track={track} />
        {isOwner && <OwnerTrackActions track={track} />}
      </div>
    </div>
  );
});
