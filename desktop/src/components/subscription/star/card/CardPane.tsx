import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { type Retry, type Stage, useCardLink } from '../../../../lib/card-link/use-card-link';
import { type CardFields, EMPTY_CARD } from '../../../../lib/card-link/validate';
import type { MethodId } from '../../../../lib/pay-client';
import { Btn } from '../ui/Btn';
import { Done } from '../ui/Done';
import { Title } from '../ui/Panel';
import { type OnLinked, useLinkEnd } from '../useLinkEnd';
import { CardFace } from './CardFace';
import { CardFailed } from './CardFailed';
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
  const { stage, held, submit, retry } = useCardLink(method, trial);
  useLinkEnd(stage, onLinked);
  return (
    <CardStage
      stage={stage}
      held={held}
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
  held,
  amount,
  onSubmit,
  onRetry,
  onOnce,
  onBack,
}: {
  stage: Stage;
  held: string | null;
  amount: string | null;
  onSubmit: (card: CardFields) => void;
  onRetry: (how: Retry) => void;
  onOnce: (() => void) | null;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div data-ui="star-card-link" data-stage={stage.kind}>
      <Title>{t('starpass.card.title')}</Title>
      {stage.kind === 'starting' && <CardFace fields={EMPTY_CARD} busy />}
      {stage.kind === 'form' && (
        <CardForm
          amount={amount}
          initial={stage.card}
          invalid={stage.invalid}
          onSubmit={onSubmit}
          onCancel={onBack}
        />
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
        <CardFailed
          reason={stage.reason}
          held={held}
          onRetry={onRetry}
          onOnce={onOnce}
          onBack={onBack}
        />
      )}
    </div>
  );
});
