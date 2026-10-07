import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { type Aura, auraRgb, auraRgba } from '../../../lib/aura';
import { art } from '../../../lib/formatters';
import { useUser } from '../../../lib/hooks';
import { Crown, User as UserIcon, Users } from '../../../lib/icons';
import { usePerfMode } from '../../../lib/perf';
import { StatsPanel } from './StatsPanel';
import type { TopArtist } from './useListeningStats';
import { useStatsFormat } from './useStatsFormat';

function useArtistPicture(artist: TopArtist, size: string): string | null {
  const { data } = useUser(artist.artistUrn ?? undefined);
  return art(data?.avatar_url || artist.artworkUrl, size);
}

const Avatar = memo(function Avatar({ url, className }: { url: string | null; className: string }) {
  return (
    <div className={`rounded-full overflow-hidden shrink-0 bg-white/[0.05] ${className}`}>
      {url ? (
        <img src={url} alt="" decoding="async" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <UserIcon size={16} className="text-white/25" />
        </div>
      )}
    </div>
  );
});

const LeadArtist = memo(function LeadArtist({ artist, aura }: { artist: TopArtist; aura: Aura }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const perf = usePerfMode();
  const fmt = useStatsFormat();
  const picture = useArtistPicture(artist, 't300x300');
  const open = () => artist.artistUrn && navigate(`/user/${encodeURIComponent(artist.artistUrn)}`);
  return (
    <button
      type="button"
      onClick={open}
      disabled={!artist.artistUrn}
      className="group relative w-full flex items-center gap-5 p-4 rounded-[1.5rem] overflow-hidden text-left cursor-pointer disabled:cursor-default mb-3"
      style={{
        border: `0.5px solid ${auraRgba(aura, 0.3)}`,
        background: `linear-gradient(120deg, ${auraRgba(aura, 0.16)}, rgba(255,255,255,0.015) 65%)`,
      }}
    >
      {picture && perf.bloom && (
        <img
          src={picture}
          alt=""
          aria-hidden
          decoding="async"
          className="absolute -right-10 -top-10 w-56 h-56 object-cover rounded-full opacity-25 pointer-events-none"
          style={{ filter: perf.glow ? 'blur(28px) saturate(150%)' : 'blur(16px)' }}
        />
      )}
      <div className="relative shrink-0">
        <div
          className="absolute -inset-2 rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, ${auraRgba(aura, 0.5)}, transparent 70%)` }}
        />
        <Avatar
          url={picture}
          className="relative w-[84px] h-[84px] ring-1 ring-white/15 transition-transform duration-500 group-hover:scale-[1.04]"
        />
        <span
          className="absolute -top-1.5 -right-1.5 w-7 h-7 rounded-full flex items-center justify-center"
          style={{
            background: `radial-gradient(125% 125% at 30% 22%, ${aura.orbs[1]}, ${aura.orbs[0]} 70%)`,
            boxShadow: `0 4px 14px ${auraRgba(aura, 0.55)}`,
          }}
        >
          <Crown size={13} className="text-white" />
        </span>
      </div>
      <div className="relative min-w-0 flex-1">
        <p
          className="text-[10px] font-bold uppercase tracking-[0.24em] mb-1"
          style={{ color: auraRgb(aura) }}
        >
          {t('stats.topArtist')}
        </p>
        <p
          className="text-[24px] font-black tracking-tight leading-tight truncate"
          style={{
            backgroundImage: aura.nameGradient,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          {artist.artistName}
        </p>
        <p className="text-[12px] text-white/50 mt-1 tabular-nums truncate">
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
  aura,
}: {
  artist: TopArtist;
  rank: number;
  max: number;
  aura: Aura;
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
      className="group w-full flex items-center gap-3 px-2 py-2 rounded-2xl text-left hover:bg-white/[0.04] transition-colors cursor-pointer disabled:cursor-default"
    >
      <span className="w-5 text-right text-[12px] font-bold tabular-nums text-white/30">
        {rank}
      </span>
      <Avatar url={picture} className="w-9 h-9 ring-1 ring-white/[0.08]" />
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-semibold text-white/85 group-hover:text-white truncate transition-colors">
          {artist.artistName}
        </p>
        <div className="mt-1.5 h-[3px] rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.max(4, (artist.plays / max) * 100)}%`,
              background: `linear-gradient(90deg, ${auraRgba(aura, 0.35)}, ${auraRgb(aura)})`,
            }}
          />
        </div>
      </div>
      <span className="text-[12px] tabular-nums text-white/45 shrink-0 w-12 text-right">
        {fmt.number(artist.plays)}
      </span>
    </button>
  );
});

export const TopArtists = memo(function TopArtists({
  artists,
  aura,
  delay,
}: {
  artists: TopArtist[];
  aura: Aura;
  delay?: number;
}) {
  const { t } = useTranslation();
  if (artists.length === 0) return null;
  const [lead, ...rest] = artists;
  return (
    <StatsPanel aura={aura} icon={<Users size={14} />} title={t('stats.topArtists')} delay={delay}>
      <LeadArtist artist={lead} aura={aura} />
      <div className="flex flex-col">
        {rest.map((artist, i) => (
          <ArtistRow
            key={artist.artistUrn ?? artist.artistName}
            artist={artist}
            rank={i + 2}
            max={lead.plays}
            aura={aura}
          />
        ))}
      </div>
    </StatsPanel>
  );
});
