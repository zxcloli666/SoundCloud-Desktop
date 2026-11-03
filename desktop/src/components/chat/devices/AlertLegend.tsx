import { useTranslation } from 'react-i18next';
import { spanText } from './time';

export type AlertOutcome = 'confirmed' | 'acknowledged' | 'revoked';

interface AlertLegendProps {
  outcome: AlertOutcome | null;
  opensIn: number;
}

export function AlertLegend({ outcome, opensIn }: AlertLegendProps) {
  const { t } = useTranslation();

  if (outcome === 'confirmed') {
    return (
      <p className="mt-4 text-[12.5px] font-semibold text-emerald-300">
        {t('chat.devices.alert.unlocked')}
      </p>
    );
  }

  if (outcome === 'revoked') {
    return (
      <div className="mt-4 flex flex-col items-center gap-1">
        <p className="text-[12.5px] font-semibold text-rose-300">
          {t('chat.devices.alert.revoked')}
        </p>
        <p className="max-w-[300px] text-[11.5px] leading-snug text-ink-40">
          {t('chat.devices.alert.revokedHint')}
        </p>
      </div>
    );
  }

  if (opensIn <= 0) return null;

  return (
    <p className="mt-4 inline-flex items-center gap-2 text-[12px] text-ink-50">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
      {t('chat.devices.alert.opensIn', { span: spanText(t, opensIn) })}
    </p>
  );
}
