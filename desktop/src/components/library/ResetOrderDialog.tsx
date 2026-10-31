import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { RotateCcw } from '../../lib/icons';
import { Modal, ModalClose, ModalContent, ModalDescription, ModalTitle } from '../ui/Modal';

export function ResetOrderDialog({
  open,
  onOpenChange,
  text,
  onReset,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  text: string;
  onReset: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [pending, setPending] = useState(false);

  const confirm = () => {
    setPending(true);
    onReset()
      .then(() => {
        onOpenChange(false);
        toast.success(t('likesOrder.resetDone'));
      })
      .catch(() => toast.error(t('likesOrder.resetFailed')))
      .finally(() => setPending(false));
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent size="sm" showClose={false}>
        <div className="flex flex-col gap-4 p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-ink/[0.06] flex items-center justify-center shrink-0">
              <RotateCcw size={18} className="text-ink-60" />
            </div>
            <ModalTitle>{t('likesOrder.resetTitle')}</ModalTitle>
          </div>
          <ModalDescription className="text-[13px] text-ink-50 leading-relaxed">
            {t(text)}
          </ModalDescription>
          <div className="flex items-center justify-end gap-2.5 pt-1">
            <ModalClose className="px-4 py-2 rounded-xl text-[13px] font-medium text-ink-50 hover:text-ink-80 hover:bg-ink/[0.06] transition-all cursor-pointer">
              {t('common.cancel')}
            </ModalClose>
            <button
              type="button"
              onClick={confirm}
              disabled={pending}
              className="px-4 py-2 rounded-xl text-[13px] font-semibold bg-accent/15 text-accent hover:bg-accent/25 border border-accent/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {pending ? t('common.loading') : t('likesOrder.resetAction')}
            </button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
