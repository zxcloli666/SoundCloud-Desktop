import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { type FailReason, type Stage, useCardLink } from '../../../../lib/card-link/use-card-link';
import { type CardFields, EMPTY_CARD } from '../../../../lib/card-link/validate';
import { X } from '../../../../lib/icons';
import type { MethodId } from '../../../../lib/pay-client';
import { Btn } from '../ui/Btn';
import { Done } from '../ui/Done';
import { Title } from '../ui/Panel';
import { type OnLinked, useLinkEnd } from '../useLinkEnd';
import { CardFace } from './CardFace';
import { CardForm } from './CardForm';
import { CardProgress } from './CardProgress';

export const CardPane = memo(function CardPane({
  method,
  amount,
  trial = false,
  onLinked,
  onOnce,
  onBack,
}: {
  method: MethodId;
  amount: string | null;
  trial?: boolean;
  onLinked: OnLinked;
  onOnce: (() => void) | null;
  onBack: () => void;
}) {
  const { stage, submit, retry } = useCardLink(method, trial);
  useLinkEnd(stage, onLinked);
  return (
    <CardStage
      stage={stage}
      amount={amount}
      onSubmit={(card) => void submit(card)}
      onRetry={retry}
      onOnce={onOnce}
      onBack={onBack}
    />
  );
});

const CardStage = memo(function CardStage({
  stage,
  amount,
  onSubmit,
  onRetry,
  onOnce,
  onBack,
}: {
  stage: Stage;
  amount: string | null;
  onSubmit: (card: CardFields) => void;
  onRetry: () => void;
  onOnce: (() => void) | null;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div data-ui="star-card-link" data-stage={stage.kind}>
      <Title>{t('starpass.card.title')}</Title>
      {stage.kind === 'starting' && <CardFace fields={EMPTY_CARD} busy />}
      {stage.kind === 'form' && (
        <CardForm amount={amount} invalid={stage.invalid} onSubmit={onSubmit} onCancel={onBack} />
      )}
      {stage.kind === 'working' && (
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <CardFace fields={EMPTY_CARD} sealed />
          <div className="flex min-w-0 flex-1 flex-col items-start gap-4">
            <CardProgress stage={stage} />
            {stage.phase === 'confirm' && (
              <span className="text-[12.5px] text-ink-50">{t('starpass.card.confirmHint')}</span>
            )}
            <Btn size="sm" tone="quiet" onClick={onBack}>
              {t('starpass.card.cancel')}
            </Btn>
          </div>
        </div>
      )}
      {stage.kind === 'linked' && <Done>{t('starpass.card.linked')}</Done>}
      {stage.kind === 'failed' && (
        <Failed reason={stage.reason} onRetry={onRetry} onOnce={onOnce} onBack={onBack} />
      )}
    </div>
  );
});

const Failed = memo(function Failed({
  reason,
  onRetry,
  onOnce,
  onBack,
}: {
  reason: FailReason;
  onRetry: () => void;
  onOnce: (() => void) | null;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const retryable = reason !== 'unavailable' && reason !== 'bundle';
  return (
    <div className="flex flex-col items-start gap-4">
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
          <Btn tone="primary" onClick={onRetry}>
            {t(reason === 'inUse' ? 'starpass.card.linkOther' : 'starpass.retry')}
          </Btn>
        ) : (
          <Btn onClick={onBack}>{t('starpass.back')}</Btn>
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
