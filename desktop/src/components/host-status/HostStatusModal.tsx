import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { BOOSTY_URL, DISCORD_URL } from '../../lib/constants';
import { requestProbe, useHostStatusStore } from '../../lib/host-status';
import { Download, ExternalLink, RefreshCw, Star, WifiOff, X } from '../../lib/icons';
import { useAppStatusStore } from '../../stores/app-status';
import { useAuthStore } from '../../stores/auth';
import { useAuthRecoveryStore } from '../../stores/auth-recovery';
import { Modal, ModalClose, ModalContent, ModalTitle } from '../ui/Modal';
import { useFailoverUi } from './useFailoverUi';

function LinkButton({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-accent/80 hover:text-accent transition-colors cursor-pointer"
      style={{
        background: 'linear-gradient(135deg, var(--color-accent-glow), transparent)',
        border: '0.5px solid var(--color-accent-glow)',
      }}
    >
      {label}
      <ExternalLink size={10} />
    </a>
  );
}

function IconTile({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
        border: '0.5px solid rgba(255,255,255,0.08)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      }}
    >
      {children}
    </div>
  );
}

export const HostStatusModal = React.memo(() => {
  const { t } = useTranslation();
  const ui = useFailoverUi();
  const incidentId = useHostStatusStore((s) => s.incidentId);
  const modalDismissedIncidentId = useHostStatusStore((s) => s.modalDismissedIncidentId);
  const dismissModal = useHostStatusStore((s) => s.dismissModal);
  const probing = useHostStatusStore((s) => s.probing);
  const routeBlocked = useHostStatusStore((s) => s.routeBlocked);
  const recoveryPhase = useAuthRecoveryStore((s) => s.phase);
  const hasSession = useAuthStore((s) => s.hasSession);
  const navigate = useNavigate();

  const open =
    (ui === 'star-offer' || ui === 'all-down') &&
    // Взаимоисключение с SessionRecoveryModal: гейт по рендеру, не по z-index.
    recoveryPhase !== 'modal' &&
    modalDismissedIncidentId !== incidentId;

  const allDown = ui === 'all-down';
  const copy = allDown ? (routeBlocked ? 'blocked' : 'allDown') : 'starOffer';

  const goOfflineLibrary = () => {
    if (!hasSession) useAppStatusStore.getState().setOfflineBypass(true);
    dismissModal();
    navigate('/offline', { replace: true });
  };

  // Main is down but star is up: the user can buy STAR right now — pay grants it
  // via the star backend, so they keep using the app on star without waiting for
  // main to recover.
  const goBuyStar = () => {
    dismissModal();
    navigate('/star');
  };

  return (
    <Modal open={open} onOpenChange={(o) => !o && dismissModal()}>
      <ModalContent size="sm" zClass="z-[95]" showClose={false}>
        <div className="relative p-7" style={{ isolation: 'isolate' }}>
          <ModalClose className="absolute top-4 right-4 p-1.5 rounded-lg text-white/20 hover:text-white/60 hover:bg-white/[0.06] transition-colors cursor-pointer">
            <X size={14} />
          </ModalClose>

          <div className="flex flex-col items-center text-center mb-6">
            <IconTile>
              {allDown ? (
                <WifiOff size={24} className="text-white/60" />
              ) : (
                <span
                  className="text-amber-400"
                  style={{ filter: 'drop-shadow(0 0 6px rgba(168,85,247,0.5))' }}
                >
                  <Star size={24} fill="currentColor" />
                </span>
              )}
            </IconTile>
            <ModalTitle className="text-lg font-bold text-white/90 tracking-tight">
              {t(`hostStatus.${copy}.title`)}
            </ModalTitle>
            <p className="text-[12.5px] text-white/35 mt-1.5 leading-relaxed max-w-[300px]">
              {t(`hostStatus.${copy}.body`)}
            </p>
            {copy === 'blocked' && (
              <p className="text-[11.5px] text-white/45 mt-3 leading-relaxed max-w-[300px]">
                {t('hostStatus.blocked.rule')}
              </p>
            )}
            {!allDown && (
              <p className="text-[11.5px] text-white/45 mt-3">{t('hostStatus.starOffer.how')}</p>
            )}
            <div className="flex items-center justify-center gap-2 mt-2.5">
              {!allDown && <LinkButton href={BOOSTY_URL} label={t('star.goBoosty')} />}
              <LinkButton href={DISCORD_URL} label={t('star.goDiscord')} />
            </div>
          </div>

          <div className="space-y-2.5">
            {!allDown && hasSession && (
              <button
                type="button"
                onClick={goBuyStar}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-accent text-accent-contrast font-semibold text-[13px] hover:bg-accent-hover active:scale-[0.97] transition-all duration-200 cursor-pointer shadow-[0_0_30px_var(--color-accent-glow),0_2px_8px_rgba(0,0,0,0.3)]"
              >
                <Star size={14} fill="currentColor" />
                {t('hostStatus.actions.buyStar')}
              </button>
            )}
            <button
              type="button"
              onClick={goOfflineLibrary}
              className={
                allDown
                  ? 'w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-accent text-accent-contrast font-semibold text-[13px] hover:bg-accent-hover active:scale-[0.97] transition-all duration-200 cursor-pointer shadow-[0_0_30px_var(--color-accent-glow),0_2px_8px_rgba(0,0,0,0.3)]'
                  : 'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-[12.5px] text-white/55 hover:text-white/80 transition-all cursor-pointer'
              }
            >
              <Download size={14} />
              {t('hostStatus.actions.offlineLibrary')}
            </button>
            <button
              type="button"
              onClick={() => requestProbe({ force: true })}
              disabled={probing}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-[12.5px] text-white/55 hover:text-white/80 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-default"
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
