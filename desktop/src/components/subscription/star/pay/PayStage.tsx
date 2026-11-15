import { openUrl } from '@tauri-apps/plugin-opener';
import { memo, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, RefreshCw, X } from '../../../../lib/icons';
import type { Order } from '../../../../lib/pay-client';
import { QrCode } from '../../../auth/QrCode';
import { tileOf } from '../../methods';
import { AccentSpinner } from '../AccentSpinner';
import { purchaseNow, useCurrentOrder, useEnv, useFlowApi, useSel } from '../flow/derive';
import type { PayPhase } from '../flow/phase';
import { canOnceOf } from '../flow/select';
import { useFlowStore } from '../flow/store';
import { Btn } from '../ui/Btn';
import { MethodBadge } from '../ui/MethodBadge';
import { Orb } from '../ui/Orb';
import { Confirm } from './Confirm';
import { StageLayout } from './StageLayout';
import { TimeRing } from './TimeRing';
import { usePayStage } from './usePayStage';

const open = (url: string) => void openUrl(url).catch(() => {});

export const PayStage = memo(function PayStage() {
  const { first, order, phase } = useCurrentOrder();
  const api = useFlowApi();
  const granted = phase === 'granted' && order ? order : null;
  useEffect(() => {
    if (granted) api.granted(granted);
  }, [granted, api]);
  if (!first || !order) return null;
  return <StageBody first={first} order={order} phase={phase} />;
});

function usePayOnce(): (() => void) | null {
  const once = useSel(canOnceOf);
  const store = useFlowStore();
  const env = useEnv();
  const api = useFlowApi();
  const run = useCallback(() => {
    const purchase = purchaseNow(store.getState(), env);
    if (purchase) api.payOnce(purchase);
  }, [store, env, api]);
  return once ? run : null;
}

const StageBody = memo(function StageBody({
  first,
  order,
  phase,
}: {
  first: Order;
  order: Order;
  phase: PayPhase;
}) {
  const { t } = useTranslation();
  const api = useFlowApi();
  const payOnce = usePayOnce();
  const view = usePayStage(first, order, phase, api.retryLast);
  const title = t(`starpass.method.${tileOf(first.method).i18n}.title`);
  const other = (
    <Btn tone="quiet" onClick={api.goMethod}>
      {t('starpass.changeMethod')}
    </Btn>
  );

  switch (view.kind) {
    case 'refreshing':
      return (
        <StageLayout
          ui="star-pay-wait"
          visual={
            <Orb tone="wait">
              <RefreshCw size={22} />
            </Orb>
          }
          title={t('starpass.qrRefreshing')}
        />
      );
    case 'failed':
      return (
        <StageLayout
          ui="star-pay-failed"
          visual={
            <Orb tone="bad">
              <X size={24} />
            </Orb>
          }
          title={t('starpass.status.failed')}
          hint={t(
            view.reason ? `starpass.order.reason.${view.reason}` : 'starpass.status.failedHint',
          )}
        >
          {view.relink ? (
            <Btn tone="primary" onClick={api.relinkAndPay}>
              {t('starpass.bind.relink')}
            </Btn>
          ) : (
            <Btn tone="primary" onClick={api.goMethod}>
              <RefreshCw size={14} />
              {t('starpass.retry')}
            </Btn>
          )}
          {payOnce && <Btn onClick={payOnce}>{t('starpass.bind.payOnce')}</Btn>}
          {other}
        </StageLayout>
      );
    case 'confirm':
      return <Confirm action={view.action} onChangeMethod={api.goMethod} />;
    case 'wait':
      return (
        <StageLayout
          ui="star-pay-wait"
          visual={
            <Orb tone="wait">
              <AccentSpinner />
            </Orb>
          }
          title={t(view.charging ? 'starpass.bind.charging' : 'starpass.status.waiting')}
          aside={<MethodBadge kind={first.method} linked size={28} />}
        />
      );
    case 'qr':
      return (
        <StageLayout
          ui="star-pay-qr"
          visual={<QrCode payload={view.action.qr} size={184} margin={12} />}
          title={title}
          aside={<TimeRing until={order.expires_at} />}
          hint={
            <ol className="flex list-none flex-col gap-1.5 p-0 text-left">
              {[1, 2, 3].map((n) => (
                <li key={n} className="flex gap-2.5">
                  <span className="grid size-[18px] shrink-0 place-items-center rounded-full bg-accent/15 text-[10px] font-bold text-accent">
                    {n}
                  </span>
                  {t(`starpass.sbpStep.${n}`)}
                </li>
              ))}
            </ol>
          }
        >
          {view.action.url && (
            <Btn onClick={() => view.action.url && open(view.action.url)}>
              {t('starpass.openInBrowser')}
              <ExternalLink size={13} />
            </Btn>
          )}
          {other}
        </StageLayout>
      );
    case 'open':
      return (
        <StageLayout
          ui="star-pay-open"
          visual={
            <Orb tone="wait">
              <ExternalLink size={22} />
            </Orb>
          }
          title={title}
          aside={<TimeRing until={order.expires_at} />}
          hint={t('starpass.externalHint')}
        >
          <AutoOpen url={view.action.url} />
          {view.action.alt.length > 1 ? (
            view.action.alt.map((target) => (
              <Btn key={target.kind} onClick={() => open(target.url)}>
                {t(`starpass.openIn.${target.kind}`)}
                <ExternalLink size={13} />
              </Btn>
            ))
          ) : (
            <Btn tone="primary" onClick={() => open(view.action.url)}>
              {t('starpass.openCheckout')}
              <ExternalLink size={14} />
            </Btn>
          )}
          {other}
        </StageLayout>
      );
    default:
      return null;
  }
});

const AutoOpen = memo(function AutoOpen({ url }: { url: string }) {
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    open(url);
  }, [url]);
  return null;
});
