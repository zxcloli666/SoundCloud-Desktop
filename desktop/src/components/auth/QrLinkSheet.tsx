import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, RefreshCw, Smartphone, X } from '../../lib/icons';
import { encodeQrPayload } from '../../lib/qr-link';
import { Modal, ModalClose, ModalContent, ModalTitle } from '../ui/Modal';
import { QrCode } from './QrCode';
import { useQrLink } from './useQrLink';

interface QrLinkSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'pull' | 'push';
  onSuccess?: (sessionId: string) => void;
}

export const QrLinkSheet = React.memo(
  ({ open, onOpenChange, mode, onSuccess }: QrLinkSheetProps) => {
    const { t } = useTranslation();
    const { state, start, reset } = useQrLink(mode, onSuccess);
    const [now, setNow] = useState(Date.now());

    // Auto-start when opened, reset when closed.
    useEffect(() => {
      if (open) start();
      else reset();
    }, [open, start, reset]);

    // Tick every second to update remaining-time.
    useEffect(() => {
      if (state.status !== 'pending') return;
      const id = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(id);
    }, [state.status]);

    const remainingSec = state.expiresAt
      ? Math.max(0, Math.floor((state.expiresAt.getTime() - now) / 1000))
      : 0;

    const titleKey = mode === 'pull' ? 'qrLink.pullTitle' : 'qrLink.pushTitle';
    const subtitleKey = mode === 'pull' ? 'qrLink.pullSubtitle' : 'qrLink.pushSubtitle';

    return (
      <Modal open={open} onOpenChange={onOpenChange}>
        <ModalContent size="sm" showClose={false} zClass="z-[100]">
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-24 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse, var(--color-accent-glow) 0%, transparent 70%)',
              transform: 'translateZ(0)',
            }}
          />

          <div className="relative p-7" style={{ isolation: 'isolate' }}>
            <ModalClose className="absolute top-4 right-4 p-1.5 rounded-lg text-white/20 hover:text-white/60 hover:bg-white/[0.06] transition-colors cursor-pointer">
              <X size={14} />
            </ModalClose>

            <div className="flex flex-col items-center text-center mb-5">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
                  border: '0.5px solid rgba(255,255,255,0.08)',
                }}
              >
                <Smartphone size={20} className="text-white/60" />
              </div>
              <ModalTitle className="text-lg font-bold text-white/90 tracking-tight">
                {t(titleKey)}
              </ModalTitle>
              <p className="text-[12.5px] text-white/40 mt-1.5 leading-relaxed max-w-[320px]">
                {t(subtitleKey)}
              </p>
            </div>

            {(state.status === 'creating' || state.status === 'idle') && (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-white/[0.06] border-t-accent animate-spin" />
                <p className="text-[11.5px] text-white/30">{t('qrLink.preparing')}</p>
              </div>
            )}

            {state.status === 'pending' && state.claimToken && (
              <div className="flex flex-col items-center gap-4">
                <QrCode payload={encodeQrPayload(state.claimToken, mode)} size={260} />
                <div className="flex items-center gap-1.5 text-[11px] text-white/35">
                  <span>
                    {t('qrLink.expiresIn', {
                      seconds: remainingSec,
                    })}
                  </span>
                </div>
              </div>
            )}

            {state.status === 'claimed' && (
              <div className="flex flex-col items-center gap-3 py-8">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(52,199,89,0.2), rgba(52,199,89,0.05))',
                    border: '0.5px solid rgba(52,199,89,0.3)',
                  }}
                >
                  <Check size={24} className="text-emerald-400" />
                </div>
                <p className="text-[13px] text-white/70">
                  {mode === 'pull' ? t('qrLink.pullSuccess') : t('qrLink.pushSuccess')}
                </p>
              </div>
            )}

            {(state.status === 'failed' || state.status === 'expired') && (
              <div className="flex flex-col items-center gap-3 py-6">
                <p className="text-[12.5px] text-red-400/80 text-center max-w-[280px]">
                  {state.error || t('qrLink.failed')}
                </p>
                <button
                  type="button"
                  onClick={() => start()}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.06] text-[12px] text-white/60 hover:text-white/85 transition-all cursor-pointer"
                >
                  <RefreshCw size={12} />
                  {t('qrLink.retry')}
                </button>
              </div>
            )}
          </div>
        </ModalContent>
      </Modal>
    );
  },
);
QrLinkSheet.displayName = 'QrLinkSheet';
