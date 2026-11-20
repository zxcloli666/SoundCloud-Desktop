import { useTranslation } from 'react-i18next';
import { RefreshCw, Shield, X } from '../../lib/icons';
import { isFinal } from '../../lib/mobile-link/flow';
import { mobileLink, useMobileLinkState } from '../../stores/mobile-link';
import { Modal, ModalClose, ModalContent, ModalDescription, ModalTitle } from '../ui/Modal';
import { AccountChip } from './AccountChip';
import { LinkSteps } from './LinkSteps';
import { PasteFallback } from './PasteFallback';
import { PhaseStatus } from './PhaseStatus';
import { PRIMARY_BUTTON, QUIET_BUTTON } from './styles';

export function MobileLinkDialog() {
  const { t } = useTranslation();
  const view = useMobileLinkState();
  const { phase, account, dialogOpen } = view;
  const retryable = phase === 'mismatch' || phase === 'failed' || phase === 'expired';
  const pasteable = phase === 'waiting' || phase === 'failed' || phase === 'expired';

  const hint =
    phase === 'mismatch' && account
      ? t('mobileLink.hint.mismatch', { username: account.username })
      : phase === 'waiting' && view.browserFailed
        ? t('mobileLink.hint.browser')
        : phase === 'waiting'
          ? t('mobileLink.hint.minutes', { count: view.minutes })
          : undefined;

  return (
    <Modal open={dialogOpen} onOpenChange={(open) => !open && mobileLink.closeDialog()}>
      <ModalContent size="sm" showClose={false} zClass="z-[100]">
        <div data-ui="mobile-link" data-phase={phase} className="relative p-7">
          <ModalClose className="absolute top-4 right-4 p-1.5 rounded-lg text-ink-30 hover:text-ink-60 hover:bg-ink/[0.06] transition-colors cursor-pointer">
            <X size={14} />
            <span className="sr-only">{t('common.close')}</span>
          </ModalClose>

          <div className="flex flex-col items-center text-center mb-5">
            <span className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3 bg-ink/[0.05] border border-ink/[0.08] text-ink-60">
              <Shield size={19} />
            </span>
            <ModalTitle className="text-[17px] font-bold text-ink-90 tracking-tight">
              {t('mobileLink.dialogTitle')}
            </ModalTitle>
            <ModalDescription className="text-[12.5px] text-ink-40 mt-1.5 leading-relaxed max-w-[320px]">
              {t('mobileLink.dialogDesc')}
            </ModalDescription>
          </div>

          <div className="flex flex-col items-center gap-5">
            <AccountChip account={account} />
            <LinkSteps step={view.step} phase={phase} />
            <PhaseStatus phase={phase} hint={hint} />

            <div className="flex flex-wrap items-center justify-center gap-2">
              {phase === 'waiting' && view.canReopen && (
                <button
                  type="button"
                  onClick={mobileLink.reopen}
                  className={view.browserFailed ? PRIMARY_BUTTON : QUIET_BUTTON}
                >
                  {t('mobileLink.openAgain')}
                </button>
              )}
              {retryable && (
                <button
                  type="button"
                  autoFocus
                  onClick={() => void mobileLink.start()}
                  className={PRIMARY_BUTTON}
                >
                  <RefreshCw size={12} />
                  {t('mobileLink.retry')}
                </button>
              )}
              {phase === 'completed' && (
                <button
                  type="button"
                  autoFocus
                  onClick={() => mobileLink.closeDialog()}
                  className={PRIMARY_BUTTON}
                >
                  {t('mobileLink.done')}
                </button>
              )}
              {!isFinal(phase) && phase !== 'starting' && (
                <button
                  type="button"
                  onClick={() => mobileLink.closeDialog()}
                  className={QUIET_BUTTON}
                >
                  {t('common.cancel')}
                </button>
              )}
            </div>

            {pasteable && (
              <PasteFallback
                invalid={view.pasteInvalid}
                onApply={mobileLink.paste}
                onEdit={mobileLink.clearPasteError}
              />
            )}
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
