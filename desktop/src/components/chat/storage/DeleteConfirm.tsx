import { memo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { MyMedia } from '../../../lib/chat/media-types';
import { Loader2, TriangleAlert } from '../../../lib/icons';
import { Modal, ModalContent, ModalTitle } from '../../ui/Modal';
import { useFormatSize } from './bytes';
import { useDeleteStore } from './delete-store';
import { errorText } from './error-text';
import { useFocusLater } from './focus-later';
import { ThumbFan } from './ThumbFan';

const BUTTON =
  'h-10 w-full cursor-pointer rounded-xl text-[13px] font-semibold outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-accent/60 disabled:cursor-default disabled:opacity-45';

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-2xl bg-ink/[0.045] px-2 py-2.5">
      <span className="text-[15px] font-bold tabular-nums text-ink-90">{value}</span>
      <span className="truncate text-[11px] font-medium text-ink-45">{label}</span>
    </div>
  );
}

export const DeleteConfirm = memo(function DeleteConfirm({
  items,
  onClose,
}: {
  items: MyMedia[] | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const format = useFormatSize();
  const busy = useDeleteStore((state) => state.busy);
  const error = useDeleteStore((state) => state.error);
  const confirmRef = useRef<HTMLButtonElement>(null);
  useFocusLater(confirmRef, items !== null);

  const list = items ?? [];
  const bytes = list.reduce((sum, item) => sum + item.bytes, 0);
  const origins = new Set(list.map((item) => item.conversation_id)).size;
  const reach = list.reduce((most, item) => Math.max(most, item.chats), origins);
  const forwarded = reach > origins;

  const close = () => {
    if (busy) return;
    useDeleteStore.getState().clearError();
    onClose();
  };

  const confirm = async () => {
    if (await useDeleteStore.getState().remove(list.map((item) => item.id))) onClose();
  };

  return (
    <Modal open={items !== null} onOpenChange={(next) => !next && close()}>
      <ModalContent size="sm" showClose={false}>
        <div
          data-ui="chat-storage-confirm"
          className="flex flex-col items-center gap-4 px-6 pt-6 pb-6 text-center"
        >
          <ThumbFan items={list} />
          <ModalTitle>{t('chat.storage.delete.title', { count: list.length })}</ModalTitle>
          <div className="flex w-full gap-2">
            <Stat
              value={String(list.length)}
              label={t('chat.storage.delete.count', { count: list.length })}
            />
            <Stat value={format(bytes)} label={t('chat.storage.delete.size')} />
            <Stat
              value={forwarded ? `${reach}+` : String(origins)}
              label={t('chat.storage.delete.chats', { count: forwarded ? reach : origins })}
            />
          </div>
          <div className="flex w-full items-start gap-2.5 rounded-2xl border border-bad/25 bg-bad/[0.08] px-3.5 py-3 text-left">
            <TriangleAlert size={15} className="mt-px shrink-0 text-bad" />
            <span className="text-[12.5px] font-medium leading-snug text-ink-80">
              {t('chat.storage.delete.warn', { count: list.length })}
            </span>
          </div>
          {error && (
            <p role="alert" className="text-[12px] font-medium text-bad">
              {errorText(error, t)}
            </p>
          )}
          <div className="flex w-full flex-col gap-2">
            <button
              ref={confirmRef}
              type="button"
              disabled={busy || list.length === 0}
              onClick={() => void confirm()}
              className={`${BUTTON} flex items-center justify-center gap-2 bg-bad text-paper hover:brightness-110`}
            >
              {busy && <Loader2 size={14} className="animate-spin" />}
              {error ? t('chat.storage.retry') : t('chat.storage.delete.confirm')}
            </button>
            <button
              type="button"
              onClick={close}
              className={`${BUTTON} bg-ink/[0.06] text-ink-70 hover:bg-ink/[0.1]`}
            >
              {t('chat.storage.cancel')}
            </button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
});
