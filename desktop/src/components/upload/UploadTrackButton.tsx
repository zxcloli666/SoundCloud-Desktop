import React from 'react';
import { useTranslation } from 'react-i18next';
import { type Aura, auraRgba } from '../../lib/aura';
import { Loader2, Upload } from '../../lib/icons';
import { useTrackUploadStore } from '../../stores/track-upload';

export const UploadTrackButton = React.memo(function UploadTrackButton({ aura }: { aura: Aura }) {
  const { t } = useTranslation();
  const phase = useTrackUploadStore((s) => s.phase);
  const sent = useTrackUploadStore((s) => s.sent);
  const total = useTrackUploadStore((s) => s.total);
  const setOpen = useTrackUploadStore((s) => s.setDialogOpen);
  const busy = phase === 'sending' || phase === 'processing';
  const percent = total > 0 ? Math.round((sent / total) * 100) : 0;

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="relative inline-flex items-center gap-2 h-11 px-5 rounded-full text-[12.5px] font-semibold text-white/90 overflow-hidden transition-all duration-300 ease-[var(--ease-apple)] hover:scale-[1.03] cursor-pointer"
      style={{
        background: auraRgba(aura, 0.18),
        border: `0.5px solid ${auraRgba(aura, 0.4)}`,
        boxShadow: `0 8px 24px ${auraRgba(aura, 0.18)}`,
      }}
    >
      {busy && (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 transition-[width] duration-300"
          style={{ width: `${percent}%`, background: auraRgba(aura, 0.22) }}
        />
      )}
      <span className="relative inline-flex items-center gap-2">
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        {busy ? t('upload.buttonBusy', { percent }) : t('upload.button')}
      </span>
    </button>
  );
});
