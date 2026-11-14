import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type FailReason,
  type Stage,
  useCardLink,
} from '../../../../lib/boosty-card/use-card-link';
import { type CardFields, EMPTY_CARD } from '../../../../lib/boosty-card/validate';
import { Check } from '../../../../lib/icons';
import type { BoostyCardMethod } from '../../../../lib/pay-client';
import { AccentSpinner } from '../AccentSpinner';
import { GhostBtn, LinkBtn, PrimaryBtn, Ttl } from '../StarConsole';
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
  method: BoostyCardMethod;
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

export const CardStage = memo(function CardStage({
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
    <div>
      <Ttl>{t('starpass.card.title')}</Ttl>
      {stage.kind === 'starting' && (
        <div className="flex items-center gap-4">
          <CardFace fields={EMPTY_CARD} />
          <AccentSpinner />
        </div>
      )}
      {stage.kind === 'form' && (
        <CardForm amount={amount} invalid={stage.invalid} onSubmit={onSubmit} />
      )}
      {stage.kind === 'working' && (
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <CardFace fields={EMPTY_CARD} sealed />
          <div className="flex min-w-0 flex-1 flex-col items-start gap-4">
            <CardProgress stage={stage} />
            {stage.phase === 'confirm' && (
              <span className="font-mono text-[10.5px] tracking-[0.06em] text-ink-45">
                {t('starpass.card.confirmHint')}
              </span>
            )}
            <LinkBtn onClick={onBack}>{t('starpass.card.cancel')}</LinkBtn>
          </div>
        </div>
      )}
      {stage.kind === 'linked' && (
        <div className="flex items-center gap-3.5">
          <span
            className="grid size-[26px] place-items-center rounded-full"
            style={{ background: 'var(--color-accent)' }}
          >
            <Check size={15} strokeWidth={3} className="text-accent-contrast" />
          </span>
          <span className="text-[14px] font-medium text-ink">{t('starpass.card.linked')}</span>
        </div>
      )}
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
        <span
          className="grid size-[22px] shrink-0 place-items-center rounded-full font-bold"
          style={{ background: 'rgb(var(--bad))', color: 'rgb(var(--paper))' }}
        >
          ✕
        </span>
        <span className="text-[13.5px] text-ink-80">{t(`starpass.card.fail.${reason}`)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
        {retryable ? (
          <PrimaryBtn onClick={onRetry}>
            {t(reason === 'inUse' ? 'starpass.card.linkOther' : 'starpass.retry')}
          </PrimaryBtn>
        ) : (
          <GhostBtn onClick={onBack}>{t('starpass.back')}</GhostBtn>
        )}
        {onOnce && <LinkBtn onClick={onOnce}>{t('starpass.bind.payOnce')}</LinkBtn>}
        {retryable && <LinkBtn onClick={onBack}>{t('starpass.changeMethod')}</LinkBtn>}
      </div>
    </div>
  );
});
