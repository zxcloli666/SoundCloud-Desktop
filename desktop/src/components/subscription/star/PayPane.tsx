import { openUrl } from '@tauri-apps/plugin-opener';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink } from '../../../lib/icons';
import type { CheckoutResp } from '../../../lib/pay-client';
import { passSerial } from '../../../lib/star-format';
import { QrCode } from '../../auth/QrCode';
import type { PayPhase } from '../PayStatus';
import type { ActivationOption } from '../providers';
import { GhostBtn, LinkBtn, PrimaryBtn, Ttl } from './StarConsole';

const QR_REFRESHES = 3;

/** Pay step — SBP QR with steps, or an external/crypto checkout opened in browser. */
export const PayPane = memo(function PayPane({
  checkout,
  option,
  phase,
  onChangeMethod,
  onRefresh,
}: {
  checkout: CheckoutResp;
  option: ActivationOption;
  phase: PayPhase;
  onChangeMethod: () => void;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();
  const serial = passSerial(checkout.order_id);
  const targets = checkout.pay_targets ?? [];
  const isSbp = option.method === 'sbp' && !!checkout.sbp_qr;

  const openedRef = useRef(false);
  const open = useCallback(() => {
    if (checkout.pay_url) void openUrl(checkout.pay_url).catch(() => {});
  }, [checkout.pay_url]);
  useEffect(() => {
    if (!isSbp && !openedRef.current && checkout.pay_url) {
      openedRef.current = true;
      open();
    }
  }, [isSbp, checkout.pay_url, open]);

  // The order lives PAY_ORDER_TTL_SECS server-side (env, not hardcoded). Mirror
  // that here so we don't present a dead QR/checkout: tick once a second while
  // waiting, show the time left, and switch to an "expired" state at zero — the
  // reaper only flips the status to `expired` every ~60s, too slow for the UI.
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    if (phase !== 'waiting') return;
    const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, [phase]);
  const secsLeft = Math.max(0, checkout.expires_at - nowSec);
  const expired = phase === 'waiting' && secsLeft === 0;
  const mmss = `${Math.floor(secsLeft / 60)}:${String(secsLeft % 60).padStart(2, '0')}`;

  // A QR the bank never scanned dies after a few minutes; while the user is still
  // here, quietly swap in a fresh one instead of failing the purchase.
  const [refreshes, setRefreshes] = useState(0);
  const deadQr = option.method === 'sbp' && (expired || phase === 'failed');
  const willRefresh = deadQr && refreshes < QR_REFRESHES;
  useEffect(() => {
    if (!willRefresh) return;
    setRefreshes((n) => n + 1);
    onRefresh();
  }, [willRefresh, onRefresh]);

  if (willRefresh) {
    return (
      <div>
        <Ttl>
          {t(`starpass.method.${option.i18n}.title`)} · {serial}
        </Ttl>
        <p className="text-[12.5px] leading-relaxed text-white/60">{t('starpass.qrRefreshing')}</p>
      </div>
    );
  }

  if (expired) {
    return (
      <div>
        <Ttl>
          {t(`starpass.method.${option.i18n}.title`)} · {serial}
        </Ttl>
        <p className="text-[12.5px] leading-relaxed text-white/60">{t('starpass.qrExpired')}</p>
        <div className="mt-3.5">
          <PrimaryBtn onClick={onChangeMethod}>{t('starpass.retry')}</PrimaryBtn>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      {isSbp ? (
        <div className="shrink-0 self-center rounded-[13px] bg-white p-2.5">
          <QrCode payload={checkout.sbp_qr as string} size={160} margin={12} />
        </div>
      ) : null}

      <div className="min-w-0 flex-1">
        <Ttl>
          {t(`starpass.method.${option.i18n}.title`)} · {option.tag} · {serial}
          {phase === 'waiting' && ` · ${mmss}`}
        </Ttl>
        {isSbp ? (
          <ol className="flex list-none flex-col gap-2 p-0">
            {[1, 2, 3].map((n) => (
              <li key={n} className="flex gap-2.5 text-[12.5px] text-white/60">
                <span className="min-w-[16px] font-mono text-[11px] text-accent">
                  {String(n).padStart(2, '0')}
                </span>
                {t(`starpass.sbpStep.${n}`)}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-[12.5px] leading-relaxed text-white/60">
            {t('starpass.externalHint')}
          </p>
        )}

        <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
          {!isSbp &&
            (targets.length > 1 ? (
              targets.map((tg) => (
                <GhostBtn key={tg.kind} onClick={() => void openUrl(tg.url).catch(() => {})}>
                  {t(`starpass.openIn.${tg.kind}`)}
                  <ExternalLink size={13} />
                </GhostBtn>
              ))
            ) : (
              <PrimaryBtn onClick={open}>
                {t('starpass.openCheckout')}
                <ExternalLink size={14} />
              </PrimaryBtn>
            ))}
          {isSbp && checkout.pay_url && (
            <GhostBtn onClick={open}>
              {t('starpass.openInBrowser')}
              <ExternalLink size={13} />
            </GhostBtn>
          )}
          {phase === 'failed' && (
            <PrimaryBtn onClick={onChangeMethod}>{t('starpass.retry')}</PrimaryBtn>
          )}
          <LinkBtn onClick={onChangeMethod}>{t('starpass.changeMethod')}</LinkBtn>
        </div>
      </div>
    </div>
  );
});
