import * as Dialog from '@radix-ui/react-dialog';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useDeleteTrack } from '../../lib/hooks';
import { AlertCircle, X } from '../../lib/icons';
import type { Track } from '../../stores/player';

export const DeleteTrackDialog = React.memo(function DeleteTrackDialog({
  track,
  open,
  onOpenChange,
  onDeleted,
}: {
  track: Track;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  const { t } = useTranslation();
  const remove = useDeleteTrack();

  const confirm = () => {
    remove.mutate(track.urn, {
      onSuccess: () => {
        toast.success(t('track.deleted'));
        onOpenChange(false);
        onDeleted?.();
      },
    });
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-fade-in" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[400px] max-w-[calc(100vw-32px)] rounded-2xl glass border border-white/[0.08] shadow-2xl animate-fade-in-up p-6 space-y-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
              <AlertCircle size={20} className="text-red-400" />
            </div>
            <Dialog.Title className="text-[15px] font-bold text-white/90">
              {t('track.delete')}
            </Dialog.Title>
            <Dialog.Close
              className="ml-auto w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/[0.08] transition-all cursor-pointer"
              aria-label={t('common.close')}
            >
              <X size={14} />
            </Dialog.Close>
          </div>
          <p className="text-[13px] text-white/50 leading-relaxed">
            {t('track.deleteConfirm', { title: track.title })}
          </p>
          <div className="flex items-center justify-end gap-2.5 pt-1">
            <Dialog.Close className="px-4 py-2 rounded-xl text-[13px] font-medium text-white/50 hover:text-white/80 hover:bg-white/[0.06] transition-all cursor-pointer">
              {t('common.cancel')}
            </Dialog.Close>
            <button
              type="button"
              onClick={confirm}
              disabled={remove.isPending}
              className="px-4 py-2 rounded-xl text-[13px] font-semibold bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {remove.isPending ? t('common.loading') : t('track.deleteAction')}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
});
