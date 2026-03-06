import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFollowUser } from '../../components/user/useFollowUser.ts';

export function UserFollowButton({ userUrn }: { userUrn: string }) {
  const { t } = useTranslation();
  const { following, loading, toggle } = useFollowUser(userUrn);

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`cursor-pointer inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ease-[var(--ease-apple)] shadow-xl disabled:opacity-50 ${
        following
          ? 'bg-white/[0.08] text-white hover:bg-white/[0.12] border border-white/[0.08]'
          : 'bg-white text-black hover:bg-white/90 hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.2)]'
      }`}
    >
      {loading ? (
        <Loader2 size={16} className="animate-spin" />
      ) : following ? (
        t('user.following')
      ) : (
        t('user.follow')
      )}
    </button>
  );
}
