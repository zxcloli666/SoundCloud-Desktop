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
      className="group flex items-center gap-3.5 px-4 py-3 rounded-2xl bg-ink/[0.025] ring-1 ring-ink/[0.06] hover:bg-ink/[0.05] hover:ring-ink/[0.1] transition-all duration-300 ease-[var(--ease-apple)]"
    >
      <span className="w-9 h-9 rounded-xl bg-rose-400/[0.1] ring-1 ring-rose-400/20 text-rose-300/80 flex items-center justify-center shrink-0">
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
      <ChevronRight
        size={16}
        className="text-ink-30 group-hover:text-ink-70 group-hover:translate-x-0.5 transition-all"
      />
    </Link>
  );
});
