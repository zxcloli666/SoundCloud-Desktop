import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from '../../../lib/icons';

export function WallThumb({
  url,
  pressed,
  dim,
  badge,
  onClick,
  onRemove,
}: {
  url: string | null;
  pressed: boolean;
  dim: boolean;
  badge: ReactNode;
  onClick: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className={`group relative ${dim ? 'opacity-60 hover:opacity-100' : ''}`}>
      <button type="button" aria-pressed={pressed} onClick={onClick} className="set-thumb">
        {url && <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />}
      </button>
      {badge && (
        <span className="pointer-events-none absolute top-1.5 left-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-contrast">
          {badge}
        </span>
      )}
      <button
        type="button"
        data-scheme="dark"
        aria-label={t('settings.wpRemove')}
        title={t('settings.wpRemove')}
        onClick={onRemove}
        className="absolute top-1.5 right-1.5 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-black/60 text-ink opacity-0 transition-opacity duration-150 group-hover:opacity-100 hover:bg-bad hover:text-[rgb(var(--paper))] focus-visible:opacity-100"
      >
        <X size={10} />
      </button>
    </div>
  );
}

export function AddThumb({
  icon,
  label,
  pressed,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  pressed?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-dashed
      aria-pressed={pressed}
      onClick={onClick}
      className="set-thumb"
    >
      {icon}
      {label}
    </button>
  );
}
