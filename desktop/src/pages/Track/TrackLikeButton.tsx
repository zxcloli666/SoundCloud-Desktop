import React, { useEffect, useState } from 'react'
import { api } from '../../lib/api.ts'
import { Heart } from 'lucide-react'
import { toCompactCount } from '../../lib/utils.ts'
import { useQueryClient } from '@tanstack/react-query'

//todo: сделать нормальные, универсальные кнопки, а не плодить компоненты на все

const TrackLikeButtonBase = ({
    trackUrn,
    initialLiked,
    count,
}: {
    trackUrn: string
    initialLiked?: boolean
    count?: number
}) => {
    const [liked, setLiked] = useState(initialLiked ?? false)
    const [localCount, setLocalCount] = useState(count ?? 0)
    const qc = useQueryClient()

    // Sync local state when query data updates (e.g. after invalidation)
    useEffect(() => {
        setLiked(initialLiked ?? false)
    }, [initialLiked])
    useEffect(() => {
        setLocalCount(count ?? 0)
    }, [count])

    const toggle = async () => {
        const next = !liked
        setLiked(next)
        setLocalCount((c) => c + (next ? 1 : -1))
        try {
            await api(`/likes/tracks/${encodeURIComponent(trackUrn)}`, {
                method: next ? 'POST' : 'DELETE',
            })
            qc.invalidateQueries({
                queryKey: ['track', trackUrn],
                exact: true,
            })
            qc.invalidateQueries({
                queryKey: ['track', trackUrn, 'favoriters'],
            })
        } catch {
            setLiked(!next)
            setLocalCount((c) => c + (next ? -1 : 1))
        }
    }

    return (
        <button
            type="button"
            onClick={toggle}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ease-[var(--ease-apple)] cursor-pointer ${
                liked
                    ? 'bg-accent/15 text-accent border border-accent/20 shadow-[0_0_20px_rgba(255,85,0,0.1)]'
                    : 'glass hover:bg-white/[0.05] text-white/60 hover:text-white/80'
            }`}
        >
            <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
            <span className="tabular-nums">{toCompactCount(localCount)}</span>
        </button>
    )
}
export const TrackLikeButton = React.memo(TrackLikeButtonBase)
