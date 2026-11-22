import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { art, fc } from '../../lib/formatters';
import type { SCUser } from '../../lib/hooks';
import { User, Users } from '../../lib/icons';

export const ArtistMiniCard = memo(function ArtistMiniCard({
  user,
  rail = false,
}: {
  user: SCUser;
  rail?: boolean;
}) {
  const navigate = useNavigate();
  const avatar = art(user.avatar_url, 't200x200');
  return (
    <button
      type="button"
      onClick={() => navigate(`/user/${encodeURIComponent(user.urn)}`)}
      className={`group flex shrink-0 cursor-pointer flex-col ${rail ? 'w-[150px] items-start' : 'w-[112px] items-center gap-2.5'}`}
    >
      <div
        className={`relative overflow-hidden ring-1 ring-ink/[0.08] transition-shadow duration-300 group-hover:ring-ink/20 ${rail ? 'aspect-square w-full rounded-2xl' : 'h-[88px] w-[88px] rounded-full'}`}
      >
        {avatar ? (
          <img src={avatar} alt="" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-ink/5">
            <User size={26} className="text-ink-20" />
          </div>
        )}
      </div>
      <div className={`w-full ${rail ? 'mt-3 text-left' : 'text-center'}`}>
        <p
          className={`truncate text-[13px] text-ink-85 transition-colors group-hover:text-ink ${rail ? 'font-medium' : 'font-semibold'}`}
        >
          {user.username}
        </p>
        <span
          className={`flex items-center gap-1 text-ink-35 ${rail ? 'mt-0.5 justify-start text-[11px]' : 'justify-center text-[10.5px]'}`}
        >
          <Users size={9} />
          {fc(user.followers_count)}
        </span>
      </div>
    </button>
  );
});
