import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { resendable } from '../../../../lib/card-link/reasons';
import type { FailReason, Retry } from '../../../../lib/card-link/use-card-link';
import { X } from '../../../../lib/icons';
import { Btn } from '../ui/Btn';

const FINAL = new Set<FailReason>(['unavailable', 'bundle', 'limit']);

function retryOf(reason: FailReason, held: string | null): Retry {
  if (reason === 'inUse' || held === null) return 'fresh';
  return resendable(reason) ? 'same' : 'edit';
}

export const CardFailed = memo(function CardFailed({
  reason,
  held,
  onRetry,
  onOnce,
  onBack,
}: {
  reason: FailReason;
  held: string | null;
  onRetry: (how: Retry) => void;
  onOnce: (() => void) | null;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const retryable = !FINAL.has(reason);
  const how = retryOf(reason, held);
  return (
    <div data-ui="star-card-failed" data-retry={how} className="flex flex-col items-start gap-4">
      <div className="flex items-center gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-bad/15 text-bad">
          <X size={16} strokeWidth={3} />
        </span>
        <span className="text-[13.5px] font-medium text-ink-85">
          {t(`starpass.card.fail.${reason}`)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {retryable ? (
          <Btn tone="primary" act="card-retry" onClick={() => onRetry(how)}>
            {t(reason === 'inUse' ? 'starpass.card.linkOther' : 'starpass.retry')}
            {how === 'same' && (
              <span className="font-mono text-[12px] tracking-[0.06em] opacity-75">
                •••• {held}
              </span>
            )}
          </Btn>
        ) : (
          <Btn onClick={onBack}>{t('starpass.back')}</Btn>
        )}
        {how === 'same' && (
          <Btn tone="quiet" act="card-other" onClick={() => onRetry('fresh')}>
            {t('starpass.card.linkOther')}
          </Btn>
        )}
        {onOnce && <Btn onClick={onOnce}>{t('starpass.bind.payOnce')}</Btn>}
        {retryable && (
          <Btn tone="quiet" onClick={onBack}>
            {t('starpass.changeMethod')}
          </Btn>
        )}
      </div>
    </div>
  );
});
