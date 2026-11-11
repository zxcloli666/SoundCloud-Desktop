import { useTranslation } from 'react-i18next';

export function StarMark({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 font-black uppercase tracking-[0.14em] text-accent ${className}`}
    >
      <span aria-hidden>✦</span>
      {t('nav.star')}
    </span>
  );
}
