import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { type Aura, auraRgb } from '../../lib/aura';
import { userEmbed } from '../../lib/chat/embed-snapshot';
import { Calendar, Globe, Sparkles } from '../../lib/icons';
import { likedTracksCount } from '../../lib/likes';
import type { StarTier } from '../../lib/star-tenure';
import { MessageButton } from '../chat/share/MessageButton';
import { ShareButton } from '../chat/share/ShareButton';
import { BlockArtistButton } from '../music/blocklist/BlockArtistButton';
import { userTarget } from '../music/blocklist/targets';
import { CopyLinkButton } from '../ui/CopyLinkButton';
import { GlassHeroPanel } from '../ui/GlassHeroPanel';
import { PinArtistButton } from '../ui/PinArtistButton';
import { RichText } from '../ui/RichText';
import { UploadTrackButton } from '../upload/UploadTrackButton';
import { AuraPicker } from './AuraPicker';
import { AvatarArtifact } from './AvatarArtifact';
import { FollowBtn } from './FollowBtn';
import { ProfileBanner } from './ProfileBanner';
import { StatOrb } from './StatOrb';
import { getWebIcon, InfoChip, ProChip, VerifiedBadge } from './UserChips';

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
    banner_url?: string | null;
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
  starTier: StarTier;
  webProfiles:
    | Array<{ id: number | string; url: string; service: string; title: string }>
    | undefined;
  aura: Aura;
  glow: readonly string[];
  isOwnProfile: boolean;
  customHex: string;
  onPickAura: (a: Aura) => void;
  onPickCustom: (hex: string) => void;
}

export function IdentityHub({
  user,
  hasStar,
  starTier,
  webProfiles,
  aura,
  glow,
  isOwnProfile,
  customHex,
  onPickAura,
  onPickCustom,
}: IdentityHubProps) {
  const { t } = useTranslation();
  const formattedDate = dateFormattedLong(user.created_at);
  const blockTarget = useMemo(() => userTarget(user), [user]);
  const country = [user.city, user.country_code].filter(Boolean).join(', ');

  return (
    <GlassHeroPanel className="@container" glow={glow} star={hasStar}>
      {user.banner_url && <ProfileBanner key={user.banner_url} url={user.banner_url} />}
      <div
        data-ui="user-hero"
        className="relative p-6 @lg:p-10 flex flex-col @min-[720px]:flex-row gap-8 @min-[720px]:gap-10 items-center @min-[720px]:items-stretch"
      >
        <AvatarArtifact
          username={user.username}
          avatarUrl={user.avatar_url}
          hasStar={hasStar}
          tier={starTier}
          aura={aura}
        />

        <div className="flex-1 min-w-0 flex flex-col justify-between gap-5 text-center @min-[720px]:text-left">
          <div className="flex flex-wrap items-center gap-2 justify-center @min-[720px]:justify-start">
            {user.verified && <VerifiedBadge title={t('user.verifiedArtist')} />}
            {user.plan && user.plan !== 'Free' && <ProChip plan={user.plan} />}
            {formattedDate && <InfoChip icon={<Calendar size={11} />}>{formattedDate}</InfoChip>}
            {country && <InfoChip icon={<Globe size={11} />}>{country}</InfoChip>}
            {isOwnProfile && (
              <InfoChip icon={<Sparkles size={11} />}>{t('user.publicProfile')}</InfoChip>
            )}
          </div>

          <div className="flex flex-col items-center @min-[720px]:items-start gap-3">
            <h1
              className="text-5xl @lg:text-7xl font-black leading-[0.85] tracking-tighter break-words max-w-full"
              style={
                hasStar
                  ? {
                      backgroundImage: aura.nameGradient,
                      backgroundSize: '200% auto',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }
                  : { color: 'rgb(var(--ink))' }
              }
            >
              {user.username}
            </h1>

            {user.full_name && user.full_name !== user.username && (
              <p className="text-[13px] text-ink-40 font-medium">{user.full_name}</p>
            )}
          </div>

          {user.description && (
            <p className="selectable text-[14px] @lg:text-[15px] text-ink-65 leading-relaxed max-w-2xl line-clamp-3 hover:line-clamp-none transition-all duration-700 cursor-help">
              <RichText text={user.description} accent={auraRgb(aura)} />
            </p>
          )}

          {webProfiles && webProfiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 justify-center @min-[720px]:justify-start">
              {webProfiles.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="chip-pill"
                >
                  <span className="text-ink-45">{getWebIcon(link.service)}</span>
                  <span className="truncate max-w-[160px]">{link.title}</span>
                </a>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1 justify-center @min-[720px]:justify-start">
            {!isOwnProfile && <FollowBtn userUrn={user.urn} />}
            {!isOwnProfile && <MessageButton userUrn={user.urn} name={user.username} />}
            {!isOwnProfile && (
              <PinArtistButton
                artist={{
                  id: user.urn,
                  name: user.username,
                  avatarUrl: user.avatar_url ?? null,
                  path: `/user/${encodeURIComponent(user.urn)}`,
                }}
              />
            )}
            {isOwnProfile && <UploadTrackButton />}
            {user.permalink_url && <CopyLinkButton url={user.permalink_url} />}
            <ShareButton
              embed={userEmbed(user)}
              size={15}
              className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full border-[0.5px] border-ink/[0.08] bg-ink/[0.04] text-ink-50 transition-all duration-300 ease-[var(--ease-apple)] hover:border-ink/[0.14] hover:bg-ink/[0.08] hover:text-ink-80"
            />
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

        <div className="hidden @min-[960px]:flex flex-col gap-3 self-stretch min-w-[160px]">
          <StatOrb value={user.followers_count} label={t('user.followers')} />
          <StatOrb value={user.followings_count} label={t('user.following')} />
          <StatOrb value={user.track_count} label={t('user.tracks')} />
          <StatOrb value={likedTracksCount(user)} label={t('user.likes')} />
        </div>
      </div>

      <div className="@min-[960px]:hidden flex flex-wrap gap-2 px-6 @lg:px-10 pb-6 @lg:pb-8 justify-center @min-[720px]:justify-start">
        <StatOrb value={user.followers_count} label={t('user.followers')} />
        <StatOrb value={user.followings_count} label={t('user.following')} />
        <StatOrb value={user.track_count} label={t('user.tracks')} />
        <StatOrb value={likedTracksCount(user)} label={t('user.likes')} />
      </div>
    </GlassHeroPanel>
  );
}
