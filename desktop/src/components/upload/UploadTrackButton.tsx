import React from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Upload } from '../../lib/icons';
import { useTrackUploadStore } from '../../stores/track-upload';

export const UploadTrackButton = React.memo(function UploadTrackButton() {
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
      className="relative inline-flex h-11 cursor-pointer items-center gap-2 overflow-hidden rounded-full bg-accent px-5 text-[12.5px] font-semibold text-accent-contrast transition-colors hover:bg-accent-hover"
    >
      {busy && (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 bg-shade-15 transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      )}
      <span className="relative inline-flex items-center gap-2">
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        {busy ? t('upload.buttonBusy', { percent }) : t('upload.button')}
      </span>
    </button>
  );
});
