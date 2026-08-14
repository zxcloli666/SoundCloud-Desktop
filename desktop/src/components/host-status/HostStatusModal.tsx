import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { requestProbe, useHostStatusStore } from '../../lib/host-status';
import { Download, RefreshCw, WifiOff, X } from '../../lib/icons';
import { useAppStatusStore } from '../../stores/app-status';
import { useAuthRecoveryStore } from '../../stores/auth-recovery';
import { Modal, ModalClose, ModalContent, ModalTitle } from '../ui/Modal';
import { useFailoverUi } from './useFailoverUi';

function IconTile({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex size-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
      {children}
    </div>
  );
}

export const HostStatusModal = React.memo(() => {
  const { t } = useTranslation();
  const ui = useFailoverUi();
  const incidentId = useHostStatusStore((state) => state.incidentId);
  const modalDismissedIncidentId = useHostStatusStore((state) => state.modalDismissedIncidentId);
  const dismissModal = useHostStatusStore((state) => state.dismissModal);
  const probing = useHostStatusStore((state) => state.probing);
  const recoveryPhase = useAuthRecoveryStore((state) => state.phase);
  const navigate = useNavigate();

  const open =
    ui === 'all-down' && recoveryPhase !== 'modal' && modalDismissedIncidentId !== incidentId;

  const goOfflineLibrary = () => {
    useAppStatusStore.getState().setOfflineBypass(true);
    dismissModal();
    navigate('/offline', { replace: true });
  };

  return (
    <Modal open={open} onOpenChange={(nextOpen) => !nextOpen && dismissModal()}>
      <ModalContent size="sm" zClass="z-[95]" showClose={false}>
        <div className="relative p-7" style={{ isolation: 'isolate' }}>
          <ModalClose className="absolute top-4 right-4 cursor-pointer rounded-lg p-1.5 text-white/20 transition-colors hover:bg-white/[0.06] hover:text-white/60">
            <X size={14} />
          </ModalClose>

          <div className="mb-6 flex flex-col items-center text-center">
            <IconTile>
              <WifiOff size={24} className="text-white/60" />
            </IconTile>
            <ModalTitle className="text-lg font-bold tracking-tight text-white/90">
              {t('hostStatus.allDown.title')}
            </ModalTitle>
            <p className="mt-1.5 max-w-[300px] text-[12.5px] leading-relaxed text-white/35">
              {t('hostStatus.allDown.body')}
            </p>
          </div>

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={goOfflineLibrary}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent py-3 text-[13px] font-semibold text-accent-contrast shadow-[0_0_30px_var(--color-accent-glow),0_2px_8px_rgba(0,0,0,0.3)] transition-all duration-200 hover:bg-accent-hover active:scale-[0.97]"
            >
              <Download size={14} />
              {t('hostStatus.actions.offlineLibrary')}
            </button>
            <button
              type="button"
              onClick={() => requestProbe({ force: true })}
              disabled={probing}
              className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.04] py-2.5 text-[12.5px] text-white/55 transition-all hover:bg-white/[0.08] hover:text-white/80 disabled:cursor-default disabled:opacity-50"
            >
              <RefreshCw size={12} className={probing ? 'animate-spin' : undefined} />
              {t('hostStatus.actions.retry')}
            </button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
});
