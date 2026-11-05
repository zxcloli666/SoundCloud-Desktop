import { memo, type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { chatBridge } from '../../../lib/chat/bridge';
import { resetWhereText } from '../../../lib/chat/gate';
import { MonitorSmartphone } from '../../../lib/chat/icons';
import type { ResetPlan } from '../../../lib/chat/types';
import { Clock, Cloud, EyeOff, KeyRound, Loader2, RotateCcw, Trash2 } from '../../../lib/icons';
import { desktopOs } from '../../../lib/platform';
import { Modal, ModalContent, ModalTitle } from '../../ui/Modal';
import { useStableClose } from '../storage/focus-later';

const BUTTON =
  'flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl text-[13px] font-semibold outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-accent/60 disabled:cursor-default';

function usePlan(open: boolean): ResetPlan | null {
  const [plan, setPlan] = useState<ResetPlan | null>(null);
  useEffect(() => {
    if (!open) return;
    let live = true;
    chatBridge.keysResetPlan().then(
      (next) => live && setPlan(next),
      () => live && setPlan('file'),
    );
    return () => {
      live = false;
    };
  }, [open]);
  return plan;
}

function Line({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-left text-[12.5px] leading-snug text-ink-65">
      <span className="mt-px flex size-[18px] shrink-0 items-center justify-center">{icon}</span>
      <span>{children}</span>
    </li>
  );
}

export const ResetKeysDialog = memo(function ResetKeysDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const plan = usePlan(open);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const close = () => {
    if (busy) return;
    setFailed(false);
    onClose();
  };
  const onOpenChange = useStableClose(close);

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await chatBridge.keysReset();
      setBusy(false);
      onClose();
    } catch {
      setBusy(false);
      setFailed(true);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent size="sm" showClose={false}>
        <div
          data-ui="chat-keys-reset"
          data-state={busy ? 'working' : failed ? 'failed' : 'ready'}
          className="flex flex-col items-center gap-4 px-6 pt-7 pb-6 text-center"
        >
          <div className="flex size-12 items-center justify-center rounded-2xl border border-bad/25 bg-bad/10 text-bad">
            <RotateCcw size={20} />
          </div>
          <ModalTitle>{t('chat.relogin.keychain.reset.title')}</ModalTitle>
          <div className="flex w-full items-start gap-3 rounded-xl border border-bad/20 bg-bad/[0.07] px-3.5 py-3 text-left text-[12.5px] leading-snug text-ink-80">
            <Trash2 size={15} className="mt-px shrink-0 text-bad" />
            <span>{t('chat.relogin.keychain.reset.lost')}</span>
          </div>
          <ul className="flex w-full flex-col gap-2.5 px-0.5">
            <Line icon={<Cloud size={15} className="text-ok" />}>
              {t('chat.relogin.keychain.reset.back')}
            </Line>
            <Line icon={<Clock size={15} className="text-ink-45" />}>
              {t('chat.relogin.keychain.reset.history')}
            </Line>
            <Line icon={<EyeOff size={15} className="text-ink-45" />}>
              {t('chat.relogin.keychain.reset.hidden')}
            </Line>
            <Line icon={<MonitorSmartphone size={15} className="text-ink-45" />}>
              {t('chat.relogin.keychain.reset.others')}
            </Line>
            <Line icon={<KeyRound size={15} className="text-amber-300" />}>
              <span data-ui="chat-keys-reset-where" className={plan ? undefined : 'invisible'}>
                {t(resetWhereText(plan ?? 'file', desktopOs()))}
              </span>
            </Line>
          </ul>
          {failed && (
            <p role="alert" className="text-[12px] font-medium text-bad">
              {t('chat.relogin.keychain.reset.failed')}
            </p>
          )}
          <div className="flex w-full flex-col gap-2">
            <button
              type="button"
              data-ui="chat-keys-reset-confirm"
              disabled={busy || !plan}
              aria-busy={busy}
              onClick={() => void confirm()}
              className={`${BUTTON} bg-bad text-paper hover:brightness-110 ${busy ? '' : 'disabled:opacity-45'}`}
            >
              {busy && <Loader2 size={14} className="animate-spin" />}
              {t(
                busy
                  ? 'chat.relogin.keychain.reset.working'
                  : 'chat.relogin.keychain.reset.confirm',
              )}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={close}
              className={`${BUTTON} bg-ink/[0.06] text-ink-70 hover:bg-ink/[0.1] disabled:opacity-45`}
            >
              {t('chat.relogin.keychain.reset.cancel')}
            </button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
});
