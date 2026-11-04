import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { openShare } from '../../../lib/chat/share';
import type { Embed } from '../../../lib/chat/types';
import { Bookmark, Pause, Play, Send, Shuffle } from '../../../lib/icons';
import { usePerfMode } from '../../../lib/perf';
import { linkRoute } from '../../../lib/soundcloudLink';
import { useIsPlayingFrom } from '../../../lib/useTrackPlay';
import { usePlayerStore } from '../../../stores/player';
import { spanText } from '../devices/time';
import { EmbedAction } from './EmbedAction';
import { EmbedShell } from './EmbedShell';
import { listTrack } from './embed-track';
import { PlaylistMosaic } from './PlaylistMosaic';
import { PlaylistRow } from './PlaylistRow';
import { playPlaylist } from './playlist-play';
import { useCoverTint } from './useCoverTint';
import { useInView } from './useInView';
import { usePlaylistSaved } from './usePlaylistSaved';

interface PlaylistEmbedProps {
  embed: Embed;
  mine: boolean;
  compact: boolean;
}

function coversOf(embed: Embed): string[] {
  const fromTracks = embed.tracks.flatMap((track) => track.artworkUrl ?? []);
  if (fromTracks.length >= 4) return fromTracks;
  if (embed.artworkUrl) return [embed.artworkUrl];
  return fromTracks;
}

export const PlaylistEmbed = memo(function PlaylistEmbed({
  embed,
  mine,
  compact,
}: PlaylistEmbedProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const perf = usePerfMode();
  const [ref, visible] = useInView<HTMLDivElement>();
  const tracks = useMemo(() => embed.tracks.map(listTrack), [embed.tracks]);
  const urns = useMemo(() => new Set(tracks.map((track) => track.urn)), [tracks]);
  const playingHere = useIsPlayingFrom(urns);
  const currentHere = usePlayerStore((s) => !!s.currentTrack && urns.has(s.currentTrack.urn));
  const covers = useMemo(() => coversOf(embed), [embed]);
  const tint = useCoverTint(covers[0] ?? null, visible && perf.bloom && !compact);
  const { saved, toggle: toggleSaved } = usePlaylistSaved(embed.urn, visible && !compact);
  const route = linkRoute(embed.urn);
  const meta = [embed.artist, embed.durationMs ? spanText(t, embed.durationMs) : null]
    .filter(Boolean)
    .join(' · ');

  const playAll = () => {
    const player = usePlayerStore.getState();
    if (playingHere) player.pause();
    else if (currentHere) player.resume();
    else void playPlaylist(embed.urn, tracks);
  };

  return (
    <EmbedShell
      kind={embed.kind}
      ref={ref}
      tint={tint}
      mine={mine}
      compact={compact}
      label={embed.title}
    >
      <div className="flex min-w-0 items-center gap-3">
        <PlaylistMosaic covers={covers} size={compact ? 40 : 60} stacked={!compact} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <button
            type="button"
            disabled={!route}
            onClick={() => route && navigate(route)}
            className="min-w-0 truncate text-left text-[13.5px] font-semibold leading-tight text-ink-92 cursor-pointer hover:text-ink disabled:cursor-default"
          >
            {embed.title}
          </button>
          {meta && <span className="min-w-0 truncate text-[12px] text-ink-50">{meta}</span>}
        </div>
      </div>
      {!compact && tracks.length > 0 && (
        <ol className="mt-2.5 flex flex-col">
          {tracks.map((track, index) => (
            <PlaylistRow
              key={`${track.urn}-${index}`}
              track={track}
              index={index}
              onPlay={() => void playPlaylist(embed.urn, tracks, { index })}
            />
          ))}
        </ol>
      )}
      {!compact && (
        <div className="mt-2.5 flex items-center gap-1">
          <button
            type="button"
            onClick={playAll}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white px-3.5 text-[12px] font-semibold text-black transition-transform duration-300 cursor-pointer hover:scale-[1.03] active:scale-[0.97]"
          >
            {playingHere ? (
              <Pause size={12} fill="currentColor" strokeWidth={0} />
            ) : (
              <Play size={12} fill="currentColor" strokeWidth={0} />
            )}
            {t('chat.embeds.playlist.playAll')}
          </button>
          <EmbedAction
            icon={<Shuffle size={14} />}
            label={t('chat.embeds.playlist.shuffle')}
            onClick={() => void playPlaylist(embed.urn, tracks, { shuffle: true })}
          />
          <div className="ml-auto flex items-center gap-0.5">
            <EmbedAction
              icon={<Bookmark size={14} fill={saved ? 'currentColor' : 'none'} />}
              label={saved ? t('chat.embeds.playlist.saved') : t('chat.embeds.playlist.save')}
              active={saved}
              onClick={() => void toggleSaved()}
            />
            <EmbedAction
              icon={<Send size={14} />}
              label={t('chat.embeds.share.action')}
              onClick={() => openShare(embed)}
            />
          </div>
        </div>
      )}
    </EmbedShell>
  );
});
