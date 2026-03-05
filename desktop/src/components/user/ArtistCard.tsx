import React from 'react'
import type { SCUser } from '../../lib/hooks.ts'
import { useNavigate } from 'react-router-dom'
import { User, Users } from 'lucide-react'
import { replaceArtSize, toCompactCount } from '../../lib/utils.ts'

const ArtistCardBase = ({ user }: { user: SCUser }) => {
    const navigate = useNavigate()
    const avatar = replaceArtSize(user.avatar_url, 't300x300')

    return (
        <div
            className="group flex flex-col items-center gap-4 p-5 rounded-3xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.04] hover:border-white/[0.08] transition-all duration-300 cursor-pointer"
            onClick={() => navigate(`/user/${encodeURIComponent(user.urn)}`)}
        >
            <div className="relative w-24 h-24 rounded-full shadow-xl overflow-hidden ring-2 ring-white/[0.05] group-hover:ring-white/[0.15] group-hover:scale-105 transition-all duration-500">
                {avatar ? (
                    <img
                        src={avatar}
                        alt={user.username}
                        className="w-full h-full object-cover"
                        loading="lazy"
                    />
                ) : (
                    <div className="w-full h-full bg-white/5 flex items-center justify-center">
                        <User size={32} className="text-white/20" />
                    </div>
                )}
            </div>

            <div className="text-center w-full">
                <p className="text-[15px] font-bold text-white/90 truncate group-hover:text-white transition-colors">
                    {user.username}
                </p>
                <div className="flex items-center justify-center gap-3 mt-2 text-[11px] text-white/30 font-medium">
                    <span className="uppercase tracking-wider flex items-center gap-1">
                        <Users size={10} />
                        {toCompactCount(user.followers_count)}
                    </span>
                </div>
            </div>
        </div>
    )
}

export const ArtistCard = React.memo(ArtistCardBase)
