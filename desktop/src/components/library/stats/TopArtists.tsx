import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { art } from '../../../lib/formatters';
import { useUser } from '../../../lib/hooks';
import { Crown, User as UserIcon, Users } from '../../../lib/icons';
import { StatsPanel } from './StatsPanel';
import type { TopArtist } from './useListeningStats';
import { useStatsFormat } from './useStatsFormat';

function useArtistPicture(artist: TopArtist, size: string): string | null {
  const { data } = useUser(artist.artistUrn ?? undefined);
  return art(data?.avatar_url || artist.artworkUrl, size);
}

const Avatar = memo(function Avatar({ url, className }: { url: string | null; className: string }) {
  return (
    <div className={`rounded-full overflow-hidden shrink-0 bg-ink/[0.05] ${className}`}>
      {url ? (
        <img src={url} alt="" decoding="async" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <UserIcon size={16} className="text-ink-25" />
        </div>
      )}
    </div>
  );
});

const LeadArtist = memo(function LeadArtist({ artist }: { artist: TopArtist }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fmt = useStatsFormat();
  const picture = useArtistPicture(artist, 't300x300');
  const open = () => artist.artistUrn && navigate(`/user/${encodeURIComponent(artist.artistUrn)}`);
  return (
    <button
      type="button"
      onClick={open}
      disabled={!artist.artistUrn}
      className="group mb-3 flex w-full cursor-pointer items-center gap-5 rounded-2xl bg-ink/[0.04] p-4 text-left transition-colors enabled:hover:bg-ink/[0.06] disabled:cursor-default"
    >
      <div className="relative shrink-0">
        <Avatar url={picture} className="h-[84px] w-[84px] ring-1 ring-ink/[0.1]" />
        <span className="absolute -top-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-paper text-ink-80 ring-1 ring-ink/[0.12]">
          <Crown size={13} />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-45">
          {t('stats.topArtist')}
        </p>
        <p className="truncate text-[24px] leading-tight font-bold tracking-tight text-ink">
          {artist.artistName}
        </p>
        <p className="mt-1 truncate text-[12px] tabular-nums text-ink-50">
          {t('stats.playsCount', { count: artist.plays, formatted: fmt.number(artist.plays) })}
          {' · '}
          {t('stats.tracksCount', { count: artist.tracks, formatted: fmt.number(artist.tracks) })}
          {' · '}
          {fmt.duration(artist.listenedMs)}
        </p>
      </div>
    </button>
  );
});

const ArtistRow = memo(function ArtistRow({
  artist,
  rank,
  max,
}: {
  artist: TopArtist;
  rank: number;
  max: number;
}) {
  const navigate = useNavigate();
  const fmt = useStatsFormat();
  const picture = useArtistPicture(artist, 't200x200');
  const open = () => artist.artistUrn && navigate(`/user/${encodeURIComponent(artist.artistUrn)}`);
  return (
    <button
      type="button"
      onClick={open}
      disabled={!artist.artistUrn}
      className="group w-full flex items-center gap-3 px-2 py-2 rounded-2xl text-left hover:bg-ink/[0.04] transition-colors cursor-pointer disabled:cursor-default"
    >
      <span className="w-5 text-right text-[12px] font-bold tabular-nums text-ink-30">{rank}</span>
      <Avatar url={picture} className="w-9 h-9 ring-1 ring-ink/[0.08]" />
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-semibold text-ink-85 group-hover:text-ink truncate transition-colors">
          {artist.artistName}
        </p>
        <div className="mt-1.5 h-[3px] rounded-full bg-ink/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full bg-ink/[0.3]"
            style={{ width: `${Math.max(4, (artist.plays / max) * 100)}%` }}
          />
        </div>
      </div>
      <span className="text-[12px] tabular-nums text-ink-45 shrink-0 w-12 text-right">
        {fmt.number(artist.plays)}
      </span>
    </button>
  );
});

export const TopArtists = memo(function TopArtists({
  artists,
  delay,
}: {
  artists: TopArtist[];
  delay?: number;
}) {
  const { t } = useTranslation();
  if (artists.length === 0) return null;
  const [lead, ...rest] = artists;
  return (
    <StatsPanel icon={<Users size={14} />} title={t('stats.topArtists')} delay={delay}>
      <LeadArtist artist={lead} />
      <div className="flex flex-col">
        {rest.map((artist, i) => (
          <ArtistRow
            key={artist.artistUrn ?? artist.artistName}
            artist={artist}
            rank={i + 2}
            max={lead.plays}
          />
        ))}
      </div>
    </StatsPanel>
  );
});
