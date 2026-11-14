import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type SbpFail, type SbpStage, useSbpLink } from '../../../../lib/boosty-sbp';
import { Check } from '../../../../lib/icons';
import { QrCode } from '../../../auth/QrCode';
import { AccentSpinner } from '../AccentSpinner';
import { GhostBtn, LinkBtn, PrimaryBtn, Ttl } from '../StarConsole';

const LINKED_HOLD_MS = 1200;
const QR_SIZE = 160;
const PNG_PREFIX = 'data:image/png;base64,';

export const SbpPane = memo(function SbpPane({
  onLinked,
  onOnce,
  onBack,
}: {
  onLinked: () => void;
  onOnce: (() => void) | null;
  onBack: () => void;
}) {
  const { stage, restart, relink } = useSbpLink();
  const [relinked, setRelinked] = useState(false);

  useEffect(() => {
    if (stage.kind !== 'linked') return;
    const timer = setTimeout(onLinked, LINKED_HOLD_MS);
    return () => clearTimeout(timer);
  }, [stage.kind, onLinked]);

  return (
    <SbpStageView
      stage={stage}
      relinked={relinked}
      onRestart={restart}
      onRelink={() => {
        setRelinked(true);
        relink();
      }}
      onOnce={onOnce}
      onBack={onBack}
    />
  );
});

export const SbpStageView = memo(function SbpStageView({
  stage,
  relinked,
  onRestart,
  onRelink,
  onOnce,
  onBack,
}: {
  stage: SbpStage;
  relinked: boolean;
  onRestart: () => void;
  onRelink: () => void;
  onOnce: (() => void) | null;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const once = onOnce && <LinkBtn onClick={onOnce}>{t('starpass.bind.payOnce')}</LinkBtn>;

  if (stage.kind === 'linked') {
    return (
      <div>
        <Ttl>{t('starpass.bind.sbp.title')}</Ttl>
        <div className="flex items-center gap-3.5">
          <span
            className="grid size-[26px] place-items-center rounded-full"
            style={{ background: 'var(--color-accent)' }}
          >
            <Check size={15} strokeWidth={3} className="text-accent-contrast" />
          </span>
          <span className="text-[14px] font-medium text-ink">{t('starpass.bind.sbp.linked')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      {(stage.kind === 'starting' || stage.kind === 'waiting') && <QrBox stage={stage} />}
      <div className="min-w-0 flex-1">
        <Ttl>
          {t('starpass.bind.sbp.title')}
          {stage.kind === 'waiting' && (
            <>
              {' · '}
              <Countdown until={stage.expiresAt} />
            </>
          )}
        </Ttl>
        {stage.kind === 'failed' ? (
          <Failure reason={stage.reason} />
        ) : stage.kind === 'expired' ? (
          <p className="text-[12.5px] text-ink-80">{t('starpass.bind.sbp.expired')}</p>
        ) : (
          <Steps relinked={relinked} />
        )}
        <div className="mt-3.5 flex flex-wrap items-center gap-x-5 gap-y-2.5">
          <Actions
            stage={stage}
            onRestart={onRestart}
            onRelink={onRelink}
            onBack={onBack}
            once={once}
          />
        </div>
      </div>
    </div>
  );
});

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
  once: React.ReactNode;
}) {
  const { t } = useTranslation();
  const again = t('starpass.bind.sbp.showAgain');
  if (stage.kind === 'failed' && stage.reason === 'exists') {
    return (
      <>
        <PrimaryBtn onClick={onRelink}>{t('starpass.bind.sbp.relink')}</PrimaryBtn>
        {once}
      </>
    );
  }
  if (stage.kind === 'failed' && (stage.reason === 'limit' || stage.reason === 'unavailable')) {
    return (
      <>
        <GhostBtn onClick={onBack}>{t('starpass.back')}</GhostBtn>
        {once}
      </>
    );
  }
  if (stage.kind === 'failed' || stage.kind === 'expired') {
    return (
      <>
        <PrimaryBtn onClick={onRestart}>{again}</PrimaryBtn>
        {once}
      </>
    );
  }
  return (
    <>
      <GhostBtn onClick={onRestart}>{again}</GhostBtn>
      {once}
      <LinkBtn onClick={onBack}>{t('starpass.card.cancel')}</LinkBtn>
    </>
  );
});

const Steps = memo(function Steps({ relinked }: { relinked: boolean }) {
  const { t } = useTranslation();
  return (
    <>
      <ol className="flex list-none flex-col gap-2 p-0">
        {[1, 2].map((n) => (
          <li key={n} className="flex gap-2.5 text-[12.5px] text-ink-60">
            <span className="min-w-[16px] font-mono text-[11px] text-accent">
              {String(n).padStart(2, '0')}
            </span>
            {t(`starpass.bind.sbp.step.${n}`)}
          </li>
        ))}
      </ol>
      {relinked && (
        <p className="mt-2.5 text-[11.5px] leading-relaxed text-ink-45">
          {t('starpass.bind.sbp.relinkNote')}
        </p>
      )}
      <p className="mt-2.5 text-[11.5px] leading-relaxed text-ink-45">
        {t('starpass.bind.sbp.cameraHelp')}
      </p>
    </>
  );
});

const Failure = memo(function Failure({ reason }: { reason: SbpFail }) {
  const { t } = useTranslation();
  return (
    <p className="text-[12.5px] leading-relaxed text-ink-80">
      {t(`starpass.bind.sbp.fail.${reason}`)}
    </p>
  );
});

const QrBox = memo(function QrBox({ stage }: { stage: SbpStage }) {
  const qr = stage.kind === 'waiting' ? stage.qr : null;
  if (qr && !qr.png.startsWith(PNG_PREFIX)) {
    return (
      <div className="shrink-0 self-center">
        <QrCode payload={qr.uri} size={QR_SIZE} margin={8} />
      </div>
    );
  }
  return (
    <div
      className="grid shrink-0 place-items-center self-center rounded-[13px] p-2.5"
      style={{
        width: QR_SIZE + 20,
        height: QR_SIZE + 20,
        background: qr ? '#fff' : 'rgb(var(--ink) / 0.04)',
        border: qr ? undefined : '1px dashed rgb(var(--ink) / 0.14)',
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

const Countdown = memo(function Countdown({ until }: { until: number }) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, until - now);
  return <>{`${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`}</>;
});
