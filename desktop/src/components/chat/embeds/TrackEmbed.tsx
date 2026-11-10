import type React from 'react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { playAt } from '../../../lib/audio';
import { listenTogether, openShare } from '../../../lib/chat/share';
import type { Embed } from '../../../lib/chat/types';
import { durLong } from '../../../lib/formatters';
import { Ellipsis, ListEnd, ListStart, Send, Users } from '../../../lib/icons';
import { usePerfMode } from '../../../lib/perf';
import { linkRoute } from '../../../lib/soundcloudLink';
import { playTrackLast, playTrackNext } from '../../../lib/track-actions';
import { getTrackDisplay } from '../../../lib/track-display';
import { isRoomGuest, useTogetherStore } from '../../../stores/together';
import { useTrackMenuStore } from '../../../stores/trackMenu';
import { EmbedAction } from './EmbedAction';
import { EmbedHeart } from './EmbedHeart';
import { EmbedShell } from './EmbedShell';
import { EmbedSleeve } from './EmbedSleeve';
import { EmbedWave } from './EmbedWave';
import {
  fullTrack,
  isUnavailable,
  snapshotTrack,
  togglePlay,
  useIsCurrent,
  useIsPlaying,
} from './embed-track';
import { useLiveTrack } from './live-tracks';
import { TimestampChip } from './TimestampChip';
import { useCoverTint } from './useCoverTint';
import { useInView } from './useInView';

interface TrackEmbedProps {
  embed: Embed;
  mine: boolean;
  compact: boolean;
}

function StateBadge({ tone, children }: { tone: 'amber' | 'rose'; children: React.ReactNode }) {
  const colors =
    tone === 'amber' ? 'bg-amber-500/15 text-amber-300/90' : 'bg-rose-500/15 text-rose-300/90';
  return (
    <span
      className={`shrink-0 rounded-[5px] px-1.5 py-px text-[9px] font-bold uppercase tracking-wide ${colors}`}
    >
      {children}
    </span>
  );
}

export const TrackEmbed = memo(function TrackEmbed({ embed, mine, compact }: TrackEmbedProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const perf = usePerfMode();
  const [ref, visible] = useInView<HTMLDivElement>();
  const live = useLiveTrack(embed.urn, visible);
  const snapshot = useMemo(() => snapshotTrack(embed), [embed]);
  const track = live ?? snapshot;
  const current = useIsCurrent(embed.urn);
  const playing = useIsPlaying(embed.urn);
  const guest = useTogetherStore(isRoomGuest);
  const tint = useCoverTint(track.artwork_url, visible && perf.bloom && !compact);
  const unavailable = isUnavailable(track);
  const display = live ? getTrackDisplay(live) : null;
  const title = display?.title || embed.title;
  const artist = display?.artistLine || live?.user.username || embed.artist;
  const route = linkRoute(embed.urn);
  const playLabel = playing ? t('chat.embeds.track.pause') : t('chat.embeds.track.play');

  const openMenu = async (event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const full = live ?? (await fullTrack(embed.urn).catch(() => null));
    if (full) useTrackMenuStore.getState().open({ track: full, x: rect.left, y: rect.bottom + 4 });
  };

  const badges = (
    <>{unavailable && <StateBadge tone="rose">{t('chat.embeds.track.unavailable')}</StateBadge>}</>
  );

  return (
    <EmbedShell
      kind={embed.kind}
      ref={ref}
      tint={tint}
      mine={mine}
      dim={unavailable}
      compact={compact}
      label={title}
    >
      <div className="flex min-w-0 items-center gap-3">
        <EmbedSleeve
          artworkUrl={track.artwork_url}
          size={compact ? 40 : 64}
          current={current}
          playing={playing}
          disc={!compact}
          disabled={unavailable}
          label={playLabel}
          onToggle={() => togglePlay(track)}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <button
            type="button"
            disabled={!route}
            onClick={() => route && navigate(route)}
            className="min-w-0 truncate text-left text-[13.5px] font-semibold leading-tight text-ink-92 cursor-pointer hover:text-ink disabled:cursor-default"
          >
            {title}
          </button>
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="min-w-0 truncate text-[12px] text-ink-50">{artist}</span>
            {badges}
          </div>
          {!compact && (
            <div className="flex items-center gap-2 pt-0.5">
              <EmbedWave
                track={snapshot}
                live={live}
                current={current}
                disabled={unavailable}
                label={t('chat.embeds.track.seek')}
              />
              {!!embed.durationMs && (
                <span className="shrink-0 text-[10.5px] tabular-nums text-ink-35">
                  {durLong(embed.durationMs)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      {!compact && (
        <div className="mt-2.5 flex items-center gap-1">
          {embed.atMs !== null && (
            <TimestampChip
              atMs={embed.atMs}
              disabled={unavailable}
              onPlay={() => playAt(track, (embed.atMs ?? 0) / 1000)}
            />
          )}
          <div className="ml-auto flex items-center gap-0.5">
            <EmbedAction
              icon={<ListStart size={15} />}
              label={t('chat.embeds.track.playNext')}
              disabled={unavailable}
              onClick={() => playTrackNext(track)}
            />
            <EmbedAction
              icon={<ListEnd size={15} />}
              label={t('chat.embeds.track.queue')}
              disabled={unavailable}
              onClick={() => playTrackLast(track)}
            />
            <EmbedHeart urn={embed.urn} live={live} />
            {!guest && (
              <EmbedAction
                className="hidden @3xs:flex"
                icon={<Users size={15} />}
                label={t('chat.embeds.track.together')}
                disabled={unavailable}
                onClick={() => void listenTogether(track)}
              />
            )}
            <EmbedAction
              icon={<Send size={14} />}
              label={t('chat.embeds.share.action')}
              onClick={() => openShare(embed)}
            />
            <EmbedAction
              icon={<Ellipsis size={15} />}
              label={t('chat.embeds.more')}
              onClick={(event) => void openMenu(event)}
            />
          </div>
        </div>
      )}
    </EmbedShell>
  );
});
