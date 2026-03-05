import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../stores/auth.ts'
import { api } from '../../lib/api.ts'
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

export function UserFollowButton({ userUrn }: { userUrn: string }) {
    const { t } = useTranslation()

    const currentUser = useAuthStore((s) => s.user)
    const qc = useQueryClient()

    const { data: initialFollowing = false, isLoading: isQueryLoading } =
        useQuery({
            queryKey: ['following', currentUser?.urn, userUrn],
            queryFn: () =>
                api<boolean>(
                    `/users/${encodeURIComponent(currentUser!.urn)}/followings/${encodeURIComponent(userUrn)}`
                ),
            enabled: !!currentUser?.urn && !!userUrn,
        })

    const [following, setFollowing] = useState(false)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        setFollowing(initialFollowing)
    }, [initialFollowing])

    const toggle = async () => {
        setLoading(true)
        const next = !following
        setFollowing(next)
        try {
            await api(`/me/followings/${encodeURIComponent(userUrn)}`, {
                method: next ? 'PUT' : 'DELETE',
            })
            // update follwrs counts
            qc.invalidateQueries({
                queryKey: ['following', currentUser?.urn, userUrn],
            })
            qc.invalidateQueries({ queryKey: ['user', userUrn] })
        } catch (e) {
            // Revert on failure
            setFollowing(!next)
        } finally {
            setLoading(false)
        }
    }

    return (
        <button
            onClick={toggle}
            disabled={loading || isQueryLoading}
            className={`cursor-pointer inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ease-[var(--ease-apple)] shadow-xl disabled:opacity-50 ${
                following
                    ? 'bg-white/[0.08] text-white hover:bg-white/[0.12] border border-white/[0.08]'
                    : 'bg-white text-black hover:bg-white/90 hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.2)]'
            }`}
        >
            {loading || isQueryLoading ? (
                <Loader2 size={16} className="animate-spin" />
            ) : following ? (
                t('user.following')
            ) : (
                t('user.follow')
            )}
        </button>
    )
}
