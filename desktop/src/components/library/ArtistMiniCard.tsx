import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { art, fc } from '../../lib/formatters';
import type { SCUser } from '../../lib/hooks';
import { User, Users } from '../../lib/icons';

/** Compact artist tile for the hub's "Artists" rail — round avatar + name. */
export const ArtistMiniCard = memo(function ArtistMiniCard({ user }: { user: SCUser }) {
  const navigate = useNavigate();
  const avatar = art(user.avatar_url, 't200x200');
  return (
    <button
      type="button"
      onClick={() => navigate(`/user/${encodeURIComponent(user.urn)}`)}
      className="group flex flex-col items-center gap-2.5 w-[112px] shrink-0 cursor-pointer"
    >
      <div className="relative w-[88px] h-[88px] rounded-full overflow-hidden ring-1 ring-white/[0.08] group-hover:ring-white/20 group-hover:scale-[1.04] transition-all duration-400 shadow-lg">
        {avatar ? (
          <img
            src={avatar}
            alt=""
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-white/5">
            <User size={26} className="text-white/20" />
          </div>
        )}
      </div>
      <div className="text-center w-full">
        <p className="text-[13px] font-semibold text-white/85 truncate group-hover:text-white transition-colors">
          {user.username}
        </p>
        <span className="text-[10.5px] text-white/30 flex items-center justify-center gap-1">
          <Users size={9} />
          {fc(user.followers_count)}
        </span>
      </div>
    </button>
  );
});
