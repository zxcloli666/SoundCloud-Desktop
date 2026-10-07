import {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {type Aura, auraRgba} from '../../lib/aura';
import {Calendar, Globe, Sparkles} from '../../lib/icons';
import {likedTracksCount} from '../../lib/likes';
import {usePerfMode} from '../../lib/perf';
import {BlockArtistButton} from '../music/blocklist/BlockArtistButton';
import {userTarget} from '../music/blocklist/targets';
import {CopyLinkButton} from '../ui/CopyLinkButton';
import {GlassHeroPanel} from '../ui/GlassHeroPanel';
import {AuraPicker} from './AuraPicker';
import {AvatarArtifact} from './AvatarArtifact';
import {FollowBtn} from './FollowBtn';
import {StatOrb} from './StatOrb';
import {getWebIcon, InfoChip, ProChip, VerifiedBadge} from './UserChips';

function dateFormattedLong(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  const d = new Date(dateStr.replace(/\//g, '-').replace(' +0000', 'Z'));
  if (Number.isNaN(d.getTime()) || d.getFullYear() <= 1970) return null;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
}

interface IdentityHubProps {
  user: {
    urn: string;
    username: string;
    full_name?: string | null;
    description?: string | null;
    avatar_url?: string | null;
    permalink_url?: string | null;
    plan?: string | null;
    verified?: boolean;
    created_at?: string | null;
    city?: string | null;
    country_code?: string | null;
    followers_count?: number | null;
    followings_count?: number | null;
    track_count?: number | null;
    public_favorites_count?: number | null;
    likes_count?: number | null;
  };
  hasStar: boolean;
  webProfiles:
    | Array<{ id: number | string; url: string; service: string; title: string }>
    | undefined;
  aura: Aura;
  isOwnProfile: boolean;
  customHex: string;
  onPickAura: (a: Aura) => void;
  onPickCustom: (hex: string) => void;
}

export function IdentityHub({
  user,
  hasStar,
  webProfiles,
  aura,
  isOwnProfile,
  customHex,
  onPickAura,
  onPickCustom,
}: IdentityHubProps) {
  const { t } = useTranslation();
    const perf = usePerfMode();
    const lb = perf.blur(16);
  const formattedDate = dateFormattedLong(user.created_at);
  const blockTarget = useMemo(() => userTarget(user), [user]);
  const country = [user.city, user.country_code].filter(Boolean).join(', ');

  return (
    <GlassHeroPanel hasStar={hasStar} aura={aura}>
      <div className="relative p-6 md:p-10 flex flex-col lg:flex-row gap-8 lg:gap-10 items-center lg:items-stretch">
        <AvatarArtifact
          username={user.username}
          avatarUrl={user.avatar_url}
          hasStar={hasStar}
          aura={aura}
        />

        <div className="flex-1 min-w-0 flex flex-col justify-between gap-5 text-center lg:text-left">
          <div className="flex flex-wrap items-center gap-2 justify-center lg:justify-start">
            {user.verified && <VerifiedBadge title={t('user.verifiedArtist')} />}
            {user.plan && user.plan !== 'Free' && <ProChip plan={user.plan} />}
            {formattedDate && <InfoChip icon={<Calendar size={11} />}>{formattedDate}</InfoChip>}
            {country && <InfoChip icon={<Globe size={11} />}>{country}</InfoChip>}
            {isOwnProfile && (
              <InfoChip icon={<Sparkles size={11} />}>{t('user.publicProfile')}</InfoChip>
            )}
          </div>

          <div className="flex flex-col items-center lg:items-start gap-3">
            <h1
              className="text-5xl md:text-7xl font-black leading-[0.85] tracking-tighter break-words max-w-full"
              style={
                hasStar
                  ? {
                      background: aura.nameGradient,
                      backgroundSize: '200% auto',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                        animation: perf.idleAnim ? 'prismatic-shift 6s linear infinite' : undefined,
                      filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.5))',
                    }
                  : { color: '#fff', textShadow: '0 8px 24px rgba(0,0,0,0.5)' }
              }
            >
              {user.username}
            </h1>

            {user.full_name && user.full_name !== user.username && (
              <p className="text-[13px] text-white/40 font-medium">{user.full_name}</p>
            )}
          </div>

          {user.description && (
              <p className="selectable text-[14px] md:text-[15px] text-white/65 leading-relaxed max-w-2xl line-clamp-3 hover:line-clamp-none transition-all duration-700 cursor-help">
              {user.description}
            </p>
          )}

          {webProfiles && webProfiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 justify-center lg:justify-start">
              {webProfiles.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold text-white/55 hover:text-white transition-all duration-300 hover:scale-105"
                  style={{
                      background: lb > 0 ? 'rgba(255,255,255,0.04)' : 'rgba(28,28,32,0.85)',
                    border: '0.5px solid rgba(255,255,255,0.08)',
                      backdropFilter: lb > 0 ? `blur(${lb}px)` : undefined,
                      WebkitBackdropFilter: lb > 0 ? `blur(${lb}px)` : undefined,
                  }}
                >
                  <span className="text-white/45">{getWebIcon(link.service)}</span>
                  <span className="truncate max-w-[160px]">{link.title}</span>
                </a>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1 justify-center lg:justify-start">
            {!isOwnProfile && <FollowBtn userUrn={user.urn} aura={aura} />}
            {user.permalink_url && <CopyLinkButton url={user.permalink_url} />}
            {!isOwnProfile && <BlockArtistButton target={blockTarget} />}
            {hasStar && isOwnProfile && (
              <AuraPicker
                aura={aura}
                onPickAura={onPickAura}
                customHex={customHex}
                onPickCustom={onPickCustom}
              />
            )}
          </div>
        </div>

        <div className="hidden xl:flex flex-col gap-3 self-stretch min-w-[160px]">
          <StatOrb
            value={user.followers_count}
            label={t('user.followers')}
            accent={auraRgba(aura, 0.2)}
          />
          <StatOrb
            value={user.followings_count}
            label={t('user.following')}
            accent={auraRgba(aura, 0.16)}
          />
          <StatOrb
            value={user.track_count}
            label={t('user.tracks')}
            accent={auraRgba(aura, 0.14)}
          />
          <StatOrb
            value={likedTracksCount(user)}
            label={t('user.likes')}
            accent={auraRgba(aura, 0.12)}
          />
        </div>
      </div>

      <div className="xl:hidden flex flex-wrap gap-2 px-6 md:px-10 pb-6 md:pb-8 justify-center lg:justify-start">
        <StatOrb
          value={user.followers_count}
          label={t('user.followers')}
          accent={auraRgba(aura, 0.2)}
        />
        <StatOrb
          value={user.followings_count}
          label={t('user.following')}
          accent={auraRgba(aura, 0.16)}
        />
        <StatOrb value={user.track_count} label={t('user.tracks')} accent={auraRgba(aura, 0.14)} />
        <StatOrb
          value={likedTracksCount(user)}
          label={t('user.likes')}
          accent={auraRgba(aura, 0.12)}
        />
      </div>
    </GlassHeroPanel>
  );
}
