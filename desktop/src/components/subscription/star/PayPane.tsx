import { openUrl } from '@tauri-apps/plugin-opener';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type ConfirmAction, useChargeConfirm } from '../../../lib/charge-confirm';
import { ExternalLink } from '../../../lib/icons';
import type { Order } from '../../../lib/pay-client';
import { passSerial } from '../../../lib/star-format';
import { QrCode } from '../../auth/QrCode';
import type { MethodTile } from '../methods';
import type { PayPhase } from '../PayStatus';
import { AccentSpinner } from './AccentSpinner';
import { GhostBtn, LinkBtn, PrimaryBtn, Ttl } from './StarConsole';

const QR_REFRESHES = 3;
const KNOWN_REASONS = ['declined', 'relink', 'aborted', 'expired', 'confirm_closed'];

export const PayPane = memo(function PayPane({
  first,
  order,
  tile,
  phase,
  onChangeMethod,
  onRefresh,
  onOnce,
  onRelink,
}: {
  first: Order;
  order: Order;
  tile: MethodTile;
  phase: PayPhase;
  onChangeMethod: () => void;
  onRefresh: () => void;
  onOnce: (() => void) | null;
  onRelink: () => void;
}) {
  const { t } = useTranslation();
  const serial = passSerial(order.order_id);
  const title = `${t(`starpass.method.${tile.i18n}.title`)} · ${serial}`;
  const action = phase === 'waiting' ? order.action : null;
  const qrFlow = first.action?.type === 'qr';

  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    if (phase !== 'waiting') return;
    const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, [phase]);
  const secsLeft = Math.max(0, order.expires_at - nowSec);
  const timed = action?.type === 'qr' || action?.type === 'open';
  const expired = phase === 'waiting' && secsLeft === 0 && timed;
  const mmss = `${Math.floor(secsLeft / 60)}:${String(secsLeft % 60).padStart(2, '0')}`;

  const [refreshes, setRefreshes] = useState(0);
  const willRefresh = qrFlow && (expired || phase === 'failed') && refreshes < QR_REFRESHES;
  useEffect(() => {
    if (!willRefresh) return;
    setRefreshes((n) => n + 1);
    onRefresh();
  }, [willRefresh, onRefresh]);

  if (willRefresh) {
    return (
      <div>
        <Ttl>{title}</Ttl>
        <p className="text-[12.5px] leading-relaxed text-ink-60">{t('starpass.qrRefreshing')}</p>
      </div>
    );
  }

  if (phase === 'failed' || expired) {
    const reason = expired ? 'expired' : (order.reason ?? '');
    const known = KNOWN_REASONS.includes(reason);
    return (
      <div data-ui="star-pay-failed">
        <Ttl>{title}</Ttl>
        <p className="text-[12.5px] leading-relaxed text-ink-80">
          {t(known ? `starpass.order.reason.${reason}` : 'starpass.status.failedHint')}
        </p>
        <div className="mt-3.5 flex flex-wrap items-center gap-x-5 gap-y-2.5">
          {reason === 'relink' ? (
            <PrimaryBtn onClick={onRelink}>{t('starpass.bind.relink')}</PrimaryBtn>
          ) : (
            <PrimaryBtn onClick={onChangeMethod}>{t('starpass.retry')}</PrimaryBtn>
          )}
          {onOnce && <LinkBtn onClick={onOnce}>{t('starpass.bind.payOnce')}</LinkBtn>}
          <LinkBtn onClick={onChangeMethod}>{t('starpass.changeMethod')}</LinkBtn>
        </div>
      </div>
    );
  }

  if (action?.type === 'confirm') {
    return <ConfirmPane title={title} action={action} onChangeMethod={onChangeMethod} />;
  }

  if (action?.type === 'wait' || (!action && phase === 'waiting')) {
    return (
      <div>
        <Ttl>{title}</Ttl>
        <div className="flex items-center gap-3">
          <AccentSpinner />
          <p className="text-[12.5px] leading-relaxed text-ink-60">
            {t(action ? 'starpass.bind.charging' : 'starpass.status.waiting')}
          </p>
        </div>
      </div>
    );
  }

  if (action?.type === 'qr') {
    return (
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="shrink-0 self-center rounded-[13px] bg-white p-2.5">
          <QrCode payload={action.qr} size={160} margin={12} />
        </div>
        <div className="min-w-0 flex-1">
          <Ttl>
            {title} · {mmss}
          </Ttl>
          <ol className="flex list-none flex-col gap-2 p-0">
            {[1, 2, 3].map((n) => (
              <li key={n} className="flex gap-2.5 text-[12.5px] text-ink-60">
                <span className="min-w-[16px] font-mono text-[11px] text-accent">
                  {String(n).padStart(2, '0')}
                </span>
                {t(`starpass.sbpStep.${n}`)}
              </li>
            ))}
          </ol>
          <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
            {action.url && (
              <GhostBtn onClick={() => void openUrl(action.url as string).catch(() => {})}>
                {t('starpass.openInBrowser')}
                <ExternalLink size={13} />
              </GhostBtn>
            )}
            <LinkBtn onClick={onChangeMethod}>{t('starpass.changeMethod')}</LinkBtn>
          </div>
        </div>
      </div>
    );
  }

  if (action?.type === 'open') {
    return (
      <OpenPane
        title={`${title} · ${mmss}`}
        url={action.url}
        alt={action.alt}
        onChangeMethod={onChangeMethod}
      />
    );
  }

  return null;
});

const OpenPane = memo(function OpenPane({
  title,
  url,
  alt,
  onChangeMethod,
}: {
  title: string;
  url: string;
  alt: { kind: string; url: string }[];
  onChangeMethod: () => void;
}) {
  const { t } = useTranslation();
  const opened = useRef(false);
  const open = useCallback(() => void openUrl(url).catch(() => {}), [url]);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    open();
  }, [open]);
  return (
    <div>
      <Ttl>{title}</Ttl>
      <p className="text-[12.5px] leading-relaxed text-ink-60">{t('starpass.externalHint')}</p>
      <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
        {alt.length > 1 ? (
          alt.map((target) => (
            <GhostBtn key={target.kind} onClick={() => void openUrl(target.url).catch(() => {})}>
              {t(`starpass.openIn.${target.kind}`)}
              <ExternalLink size={13} />
            </GhostBtn>
          ))
        ) : (
          <PrimaryBtn onClick={open}>
            {t('starpass.openCheckout')}
            <ExternalLink size={14} />
          </PrimaryBtn>
        )}
        <LinkBtn onClick={onChangeMethod}>{t('starpass.changeMethod')}</LinkBtn>
      </div>
    </div>
  );
});

const ConfirmPane = memo(function ConfirmPane({
  title,
  action,
  onChangeMethod,
}: {
  title: string;
  action: ConfirmAction;
  onChangeMethod: () => void;
}) {
  const { t } = useTranslation();
  const { state, reopen } = useChargeConfirm(action);
  return (
    <div data-ui="star-pay-confirm">
      <Ttl>{title}</Ttl>
      <div className="flex items-center gap-3">
        {state !== 'failed' && <AccentSpinner />}
        <p className="text-[12.5px] leading-relaxed text-ink-60">
          {t(`starpass.confirm.${state}`)}
        </p>
      </div>
      <div className="mt-3.5 flex flex-wrap items-center gap-x-5 gap-y-2.5">
        {(state === 'closed' || state === 'failed') && (
          <PrimaryBtn onClick={() => void reopen()}>{t('starpass.confirm.reopen')}</PrimaryBtn>
        )}
        <LinkBtn onClick={onChangeMethod}>{t('starpass.changeMethod')}</LinkBtn>
      </div>
    </div>
  );
});
