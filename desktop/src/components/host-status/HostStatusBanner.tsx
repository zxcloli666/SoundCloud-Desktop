import React from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/shallow';
import { useHostStatusStore } from '../../lib/host-status';
import { useFailoverUi } from './useFailoverUi';

export const HostStatusBanner = React.memo(() => {
  const { t } = useTranslation();
  const ui = useFailoverUi();
  const { incidentId, modalDismissedIncidentId } = useHostStatusStore(
    useShallow((state) => ({
      incidentId: state.incidentId,
      modalDismissedIncidentId: state.modalDismissedIncidentId,
    })),
  );
  const reopenModal = useHostStatusStore((state) => state.reopenModal);

  if (ui !== 'all-down' || modalDismissedIncidentId !== incidentId) return null;

  return (
    <div className="pointer-events-auto fixed top-12 left-1/2 z-[60] flex max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-2 rounded-full border border-white/[0.12] bg-[#121216]/95 py-1.5 pr-2 pl-3.5 shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
      <span className="min-w-0 truncate text-[11.5px] font-medium text-white/85">
        {t('hostStatus.banner.outage')}
      </span>
      <button
        type="button"
        onClick={reopenModal}
        className="shrink-0 cursor-pointer rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[11px] font-semibold text-white/70 transition-colors hover:bg-white/[0.12] hover:text-white"
      >
        {t('hostStatus.banner.details')}
      </button>
    </div>
  );
});
