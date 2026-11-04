import { useTranslation } from 'react-i18next';

export function LinkHint({ hint }: { hint: string }) {
  const { t } = useTranslation();
  return (
    <span
      data-ui="voice-link-hint"
      aria-label={t('voice.speakers.confirmHint')}
      className="shrink-0 rounded-xl bg-accent/12 px-2.5 py-1 text-[18px] font-bold leading-none tracking-[0.08em] text-accent tabular-nums"
    >
      {hint}
    </span>
  );
}
