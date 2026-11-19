import { memo, type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from '../../../../lib/icons';
import type { MethodId } from '../../../../lib/pay-client';
import { type SbpStage, useSbpLink } from '../../../../lib/sbp-link';
import { QrCode } from '../../../auth/QrCode';
import { AccentSpinner } from '../AccentSpinner';
import { TimeRing } from '../pay/TimeRing';
import { Btn } from '../ui/Btn';
import { Done } from '../ui/Done';
import { Title } from '../ui/Panel';
import { type OnLinked, useLinkEnd } from '../useLinkEnd';

const QR_SIZE = 168;
const PNG_PREFIX = 'data:image/png;base64,';

export const SbpPane = memo(function SbpPane({
  method,
  paying = true,
  trial = false,
  onLinked,
  onOnce,
  onBack,
}: {
  method: MethodId;
  paying?: boolean;
  trial?: boolean;
  onLinked: OnLinked;
  onOnce: (() => void) | null;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const { stage, restart, relink } = useSbpLink(method, trial);
  const [relinked, setRelinked] = useState(false);
  useLinkEnd(stage, onLinked);

  if (stage.kind === 'refused') return null;
  if (stage.kind === 'linked') {
    return (
      <div data-ui="star-sbp-link" data-stage="linked">
        <Title>{t('starpass.bind.sbp.title')}</Title>
        <Done>{t('starpass.bind.sbp.linked')}</Done>
      </div>
    );
  }
  const once = onOnce && <Btn onClick={onOnce}>{t('starpass.bind.payOnce')}</Btn>;
  return (
    <div
      data-ui="star-sbp-link"
      data-stage={stage.kind}
      className="flex flex-col items-center gap-6 sm:flex-row sm:items-start"
    >
      {(stage.kind === 'starting' || stage.kind === 'waiting') && <QrBox stage={stage} />}
      <div className="min-w-0 flex-1">
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="text-[18px] font-extrabold leading-tight tracking-tight text-ink">
            {t('starpass.bind.sbp.title')}
          </h2>
          {stage.kind === 'waiting' && <TimeRing until={stage.expiresAt} />}
        </div>
        {stage.kind === 'failed' ? (
          <Problem>{t(`starpass.bind.sbp.fail.${stage.reason}`)}</Problem>
        ) : stage.kind === 'expired' ? (
          <Problem>{t('starpass.bind.sbp.expired')}</Problem>
        ) : (
          <Steps paying={paying} relinked={relinked} />
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Actions
            stage={stage}
            onRestart={restart}
            onRelink={() => {
              setRelinked(true);
              relink();
            }}
            onBack={onBack}
            once={once}
          />
        </div>
      </div>
    </div>
  );
});

function Problem({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-px grid size-6 shrink-0 place-items-center rounded-full bg-bad/15 text-bad">
        <X size={13} strokeWidth={3} />
      </span>
      <p className="text-[13px] leading-relaxed text-ink-80">{children}</p>
    </div>
  );
}

const Actions = memo(function Actions({
  stage,
  onRestart,
  onRelink,
  onBack,
  once,
}: {
  stage: SbpStage;
  onRestart: () => void;
  onRelink: () => void;
  onBack: () => void;
  once: ReactNode;
}) {
  const { t } = useTranslation();
  const again = t('starpass.bind.sbp.showAgain');
  if (stage.kind === 'failed' && stage.reason === 'exists') {
    return (
      <>
        <Btn tone="primary" onClick={onRelink}>
          {t('starpass.bind.relink')}
        </Btn>
        {once}
      </>
    );
  }
  if (stage.kind === 'failed' && (stage.reason === 'limit' || stage.reason === 'unavailable')) {
    return (
      <>
        <Btn onClick={onBack}>{t('starpass.back')}</Btn>
        {once}
      </>
    );
  }
  if (stage.kind === 'failed' || stage.kind === 'expired') {
    return (
      <>
        <Btn tone="primary" onClick={onRestart}>
          {again}
        </Btn>
        {once}
      </>
    );
  }
  return (
    <>
      <Btn onClick={onRestart}>{again}</Btn>
      {once}
      <Btn tone="quiet" onClick={onBack}>
        {t('starpass.card.cancel')}
      </Btn>
    </>
  );
});

const Steps = memo(function Steps({ paying, relinked }: { paying: boolean; relinked: boolean }) {
  const { t } = useTranslation();
  return (
    <>
      <ol className="flex list-none flex-col gap-2 p-0">
        {(paying ? [1, 2] : [1]).map((n) => (
          <li key={n} className="flex gap-2.5 text-[13px] text-ink-75">
            <span className="grid size-[18px] shrink-0 place-items-center rounded-full bg-accent/15 text-[10px] font-bold text-accent">
              {n}
            </span>
            {t(`starpass.bind.sbp.step.${n}`)}
          </li>
        ))}
      </ol>
      {relinked && (
        <p className="mt-3 text-[12px] leading-relaxed text-ink-50">
          {t('starpass.bind.sbp.relinkNote')}
        </p>
      )}
      <p className="mt-3 text-[12px] leading-relaxed text-ink-45">
        {t('starpass.bind.sbp.cameraHelp')}
      </p>
    </>
  );
});

const QrBox = memo(function QrBox({ stage }: { stage: SbpStage }) {
  const qr = stage.kind === 'waiting' ? stage.qr : null;
  if (qr && !qr.png.startsWith(PNG_PREFIX)) {
    return <QrCode payload={qr.uri} size={QR_SIZE} margin={10} />;
  }
  return (
    <div
      className="grid shrink-0 place-items-center rounded-[18px] p-3"
      style={{
        width: QR_SIZE + 24,
        height: QR_SIZE + 24,
        background: qr ? '#fff' : 'rgb(var(--ink) / 0.04)',
        boxShadow: qr ? undefined : 'inset 0 0 0 1px rgb(var(--ink) / 0.10)',
      }}
    >
      {qr ? (
        <img src={qr.png} alt="" width={QR_SIZE} height={QR_SIZE} draggable={false} />
      ) : (
        <AccentSpinner />
      )}
    </div>
  );
});
