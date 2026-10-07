import * as Dialog from '@radix-ui/react-dialog';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, X } from '../../lib/icons';
import { useTrackUploadStore } from '../../stores/track-upload';
import { UploadForm } from './UploadForm';
import { UploadStatus } from './UploadStatus';

export const UploadTrackDialog = React.memo(function UploadTrackDialog() {
  const { t } = useTranslation();
  const open = useTrackUploadStore((s) => s.dialogOpen);
  const setOpen = useTrackUploadStore((s) => s.setDialogOpen);
  const phase = useTrackUploadStore((s) => s.phase);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-fade-in" />
        <Dialog.Content
          aria-describedby={undefined}
          onInteractOutside={(e) => {
            if (phase === 'idle') e.preventDefault();
          }}
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[520px] max-w-[calc(100vw-32px)] max-h-[calc(100vh-48px)] overflow-y-auto rounded-2xl glass border border-white/[0.08] shadow-2xl animate-fade-in-up p-6 space-y-5"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
              <Upload size={17} className="text-accent" />
            </div>
            <div className="min-w-0">
              <Dialog.Title className="text-[15px] font-bold text-white/90">
                {t('upload.title')}
              </Dialog.Title>
              <p className="text-[11.5px] text-white/40">{t('upload.subtitle')}</p>
            </div>
            <Dialog.Close
              className="ml-auto w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/[0.08] transition-all cursor-pointer"
              aria-label={t('common.close')}
            >
              <X size={14} />
            </Dialog.Close>
          </div>
          {phase === 'idle' ? <UploadForm /> : <UploadStatus />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
});
