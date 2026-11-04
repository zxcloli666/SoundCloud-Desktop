import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Star } from '../../../../lib/icons';

export const StarMark = memo(function StarMark({
  size = 16,
  className = '',
  lock = false,
}: {
  size?: number;
  className?: string;
  lock?: boolean;
}) {
  const { t } = useTranslation();
  const label = t(lock ? 'chat.room.perks.needsStar' : 'chat.room.perks.starHost');
  return (
    <span
      role="img"
      title={label}
      aria-label={label}
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(135deg, #5b21b6, #7c3aed 55%, #a855f7)',
        boxShadow: '0 0 0 1.5px rgba(196,181,253,0.55), 0 2px 8px -2px rgba(139,92,246,0.7)',
      }}
    >
      <Star size={Math.round(size * 0.58)} fill="#fbbf24" color="#fbbf24" strokeWidth={1.5} />
    </span>
  );
});
