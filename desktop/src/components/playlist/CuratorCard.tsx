import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { Playlist } from '../../lib/hooks';
import { useUser } from '../../lib/hooks';
import { Avatar } from '../ui/Avatar';
import { RichText } from '../ui/RichText';
import { FollowBtn } from '../user/FollowBtn';
import { StatOrb } from '../user/StatOrb';

type Curator = Playlist['user'];

export const CuratorCard = React.memo(function CuratorCard({
  user,
  isOwner,
  note,
}: {
  user: Curator;
  isOwner: boolean;
  note?: string | null;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: profile } = useUser(user.urn);
  const goUser = () => navigate(`/user/${encodeURIComponent(user.urn)}`);

  const avatarUrl = profile?.avatar_url ?? user.avatar_url;
  const followers = profile?.followers_count ?? user.followers_count;
  const trackCount = profile?.track_count ?? user.track_count;
  const trimmed = note?.trim();

  return (
    <div className="rounded-2xl border border-ink/[0.07] bg-ink/[0.03] p-4 @min-[512px]:p-5">
      <div className="flex items-center gap-3.5">
        <button type="button" onClick={goUser} className="shrink-0 cursor-pointer">
          <Avatar src={avatarUrl} alt={user.username} size={48} className="ring-1 ring-ink/[0.1]" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-35">
            {t('playlist.curatedBy')}
          </p>
          <button
            type="button"
            onClick={goUser}
            className="block text-[16px] font-bold text-ink-90 truncate hover:text-ink transition-colors cursor-pointer text-left max-w-full"
          >
            {user.username}
          </button>
        </div>
        {!isOwner && <FollowBtn userUrn={user.urn} />}
      </div>

      {(followers != null || trackCount != null) && (
        <div className="flex flex-wrap gap-2.5 mt-4">
          {followers != null && <StatOrb value={followers} label={t('user.followers')} />}
          {trackCount != null && <StatOrb value={trackCount} label={t('user.tracks')} />}
        </div>
      )}

      {trimmed && (
        <div className="mt-4 border-l-2 border-ink/[0.12] pl-3.5">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-ink-30 mb-1.5">
            {t('playlist.linerNote')}
          </p>
          <p className="selectable text-[12.5px] text-ink-55 leading-relaxed whitespace-pre-wrap break-words line-clamp-4 hover:line-clamp-none transition-all duration-500">
            <RichText text={trimmed} />
          </p>
        </div>
      )}
    </div>
  );
});
