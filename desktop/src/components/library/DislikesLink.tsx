import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useDislikedCount } from '../../lib/dislikes';
import { ChevronRight, ThumbsDown } from '../../lib/icons';

export const DislikesLink = memo(function DislikesLink() {
  const { t } = useTranslation();
  const count = useDislikedCount();
  if (count === 0) return null;

  return (
    <Link
      to="/library/dislikes"
      className="panel group flex items-center gap-3.5 rounded-2xl px-4 py-3 transition-colors duration-200 hover:border-ink/[0.14] hover:bg-ink/[0.04]"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink/[0.06] text-ink-60">
        <ThumbsDown size={15} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[14px] font-semibold text-ink-85 truncate">
          {t('dislikes.title')}
        </span>
        <span className="block text-[12px] text-ink-35 truncate">
          {t('dislikes.summary', { count })}
        </span>
      </span>
      <ChevronRight size={16} className="text-ink-30 transition-colors group-hover:text-ink-70" />
    </Link>
  );
});
