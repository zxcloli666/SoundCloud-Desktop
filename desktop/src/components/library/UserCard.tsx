import React from 'react';
import {useNavigate} from 'react-router-dom';
import {art, fc} from '../../lib/formatters';
import type {SCUser} from '../../lib/hooks';
import {User, Users} from '../../lib/icons';

export const UserCard = React.memo(({user}: { user: SCUser }) => {
    const navigate = useNavigate();
    const avatar = art(user.avatar_url, 't300x300');

    return (
        <div
            className="group flex flex-col items-center gap-4 p-5 rounded-3xl bg-ink/[0.02] hover:bg-ink/[0.04] border border-ink/[0.04] hover:border-ink/[0.08] transition-all duration-300 cursor-pointer"
            onClick={() => navigate(`/user/${encodeURIComponent(user.urn)}`)}
        >
            <div
                className="relative w-24 h-24 rounded-full shadow-xl overflow-hidden ring-2 ring-ink/[0.05] group-hover:ring-ink/[0.15] group-hover:scale-105 transition-all duration-500">
                {avatar ? (
                    <img
                        src={avatar}
                        alt={user.username}
                        className="w-full h-full object-cover"
                        decoding="async"
                    />
                ) : (
                    <div className="w-full h-full bg-ink/5 flex items-center justify-center">
                        <User size={32} className="text-ink-20"/>
                    </div>
                )}
            </div>

            <div className="text-center w-full">
                <p className="text-[15px] font-bold text-ink-90 truncate group-hover:text-ink transition-colors">
                    {user.username}
                </p>
                <div className="flex items-center justify-center gap-3 mt-2 text-[11px] text-ink-30 font-medium">
          <span className="uppercase tracking-wider flex items-center gap-1">
            <Users size={10}/>
              {fc(user.followers_count)}
          </span>
                </div>
            </div>
        </div>
    );
});
