import React from 'react';
import {useTranslation} from 'react-i18next';
import {useShallow} from 'zustand/shallow';
import {useHostStatusStore} from '../../lib/host-status';
import {Star, X} from '../../lib/icons';
import {outageCopy} from './outage-copy';
import {useFailoverUi} from './useFailoverUi';

// Плоский тёмный tint с фиолетовой подсветкой (в духе StarBadge), БЕЗ backdrop-filter.
const PILL_STYLE: React.CSSProperties = {
  background:
    'linear-gradient(135deg, rgba(139,92,246,0.28), rgba(88,28,135,0.12)), rgba(18,16,24,0.94)',
  border: '0.5px solid rgba(168,85,247,0.35)',
  boxShadow:
    'inset 0 0.5px 0 rgba(255,255,255,0.14), 0 8px 24px rgba(0,0,0,0.45), 0 0 16px rgba(139,92,246,0.22)',
};

export const HostStatusBanner = React.memo(() => {
  const { t } = useTranslation();
  const ui = useFailoverUi();
  const { incidentId, modalDismissedIncidentId, bannerDismissedIncidentId } = useHostStatusStore(
    useShallow((s) => ({
      incidentId: s.incidentId,
      modalDismissedIncidentId: s.modalDismissedIncidentId,
      bannerDismissedIncidentId: s.bannerDismissedIncidentId,
    })),
  );
  const routeBlocked = useHostStatusStore((s) => s.routeBlocked);
  const remote = useHostStatusStore((s) => s.remote);
  const dismissBanner = useHostStatusStore((s) => s.dismissBanner);
  const reopenModal = useHostStatusStore((s) => s.reopenModal);

  const starActive = ui === 'star-active' && bannerDismissedIncidentId !== incidentId;
  const outageDismissed =
    (ui === 'star-offer' || ui === 'all-down') && modalDismissedIncidentId === incidentId;
  if (!starActive && !outageDismissed) return null;

  return (
    <div
      className="fixed top-12 left-1/2 -translate-x-1/2 z-[60] pointer-events-auto flex items-center gap-2 max-w-[calc(100vw-32px)] rounded-full pl-3.5 pr-2 py-1.5"
      style={PILL_STYLE}
    >
      {starActive ? (
        <>
          <span
            className="text-amber-400 shrink-0"
            style={{ filter: 'drop-shadow(0 0 4px rgba(168,85,247,0.6))' }}
          >
            <Star size={12} fill="currentColor" />
          </span>
          <span
            className="min-w-0 truncate text-[11.5px] font-medium text-white/85"
            title={t('hostStatus.banner.viaStar')}
          >
            {t('hostStatus.banner.viaStar')}
          </span>
          <button
            type="button"
            aria-label="Close"
            onClick={dismissBanner}
            className="shrink-0 p-1 rounded-full text-white/40 hover:text-white/80 hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            <X size={12} />
          </button>
        </>
      ) : (
        <>
          <span className="min-w-0 truncate text-[11.5px] font-medium text-white/85">
            {ui === 'all-down' && outageCopy(routeBlocked, remote) === 'reachable'
              ? t('hostStatus.banner.network')
              : t('hostStatus.banner.outage')}
          </span>
          <button
            type="button"
            onClick={reopenModal}
            className="shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-purple-200/90 hover:text-white bg-white/[0.06] hover:bg-white/[0.12] transition-colors cursor-pointer"
          >
            {t('hostStatus.banner.details')}
          </button>
        </>
      )}
    </div>
  );
});
