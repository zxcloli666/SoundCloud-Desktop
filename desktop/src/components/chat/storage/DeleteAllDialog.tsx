import { memo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, TriangleAlert } from '../../../lib/icons';
import { Modal, ModalContent, ModalTitle } from '../../ui/Modal';
import { useFormatSize } from './bytes';
import { useCooldown } from './cooldown';
import { restoreWindowS, useDeleteStore } from './delete-store';
import { errorText } from './error-text';
import { useFocusLater, useStableClose } from './focus-later';
import { useStorageStore } from './storage-store';

const BUTTON =
  'h-10 w-full cursor-pointer rounded-xl text-[13px] font-semibold outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-accent/60 disabled:cursor-default disabled:opacity-45';

export const DeleteAllDialog = memo(function DeleteAllDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const format = useFormatSize();
  const busy = useDeleteStore((state) => state.busy);
  const live = useStorageStore((state) => state.usage);
  const shown = useRef(live);
  const wasOpen = useRef(false);
  if (open && !wasOpen.current) shown.current = live;
  wasOpen.current = open;
  const usage = shown.current;
  const error = useDeleteStore((state) => state.error);
  const [typed, setTyped] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useFocusLater(input, open);

  const word = t('chat.storage.deleteAll.word');
  const lang = i18n.resolvedLanguage ?? 'en';
  const matches = typed.trim().toLocaleUpperCase(lang) === word.toLocaleUpperCase(lang);

  const close = () => {
    if (useDeleteStore.getState().busy) return;
    setTyped('');
    useDeleteStore.getState().clearError();
    onClose();
  };
  const onOpenChange = useStableClose(close);
  const wait = useCooldown(error);

  const confirm = async () => {
    if (!matches || busy || wait > 0) return;
    if (await useDeleteStore.getState().removeAll()) {
      setTyped('');
      onClose();
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent size="sm" showClose={false}>
        <form
          data-ui="chat-storage-delete-all"
          className="flex flex-col items-center gap-4 px-6 pt-7 pb-6 text-center"
          onSubmit={(event) => {
            event.preventDefault();
            void confirm();
          }}
        >
          <div className="flex size-12 items-center justify-center rounded-2xl border border-bad/25 bg-bad/10 text-bad">
            <TriangleAlert size={20} />
          </div>
          <ModalTitle>{t('chat.storage.deleteAll.title')}</ModalTitle>
          {usage && (
            <div className="flex items-center gap-2 text-[13px] font-semibold tabular-nums text-ink-80">
              <span>{t('chat.storage.files', { count: usage.files })}</span>
              <span className="text-ink-30">·</span>
              <span>{format(usage.bytes + usage.reserved)}</span>
            </div>
          )}
          <p className="text-[12.5px] leading-snug text-ink-55">
            {t('chat.storage.deleteAll.warn', { seconds: restoreWindowS() })}
          </p>
          <label className="flex w-full flex-col gap-1.5 text-left">
            <span className="text-[11.5px] font-medium text-ink-50">
              {t('chat.storage.deleteAll.type', { word })}
            </span>
            <input
              ref={input}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              spellCheck={false}
              autoComplete="off"
              aria-invalid={typed.length > 0 && !matches}
              className={`h-10 w-full rounded-xl border bg-ink/[0.04] px-3 text-[14px] font-semibold tracking-[0.12em] text-ink-90 outline-none transition-colors placeholder:text-ink-25 focus:bg-ink/[0.06] ${
                matches ? 'border-bad/50' : 'border-ink/[0.1] focus:border-ink/25'
              }`}
              placeholder={word}
            />
          </label>
          {error && (
            <p role="alert" className="text-[12px] font-medium text-bad">
              {errorText(error, t)}
            </p>
          )}
          <div className="flex w-full flex-col gap-2">
            <button
              type="submit"
              disabled={!matches || busy || wait > 0}
              className={`${BUTTON} flex items-center justify-center gap-2 bg-bad text-paper hover:brightness-110`}
            >
              {busy && <Loader2 size={14} className="animate-spin" />}
              {wait > 0
                ? t('chat.storage.retryIn', { count: wait })
                : t('chat.storage.deleteAll.confirm')}
            </button>
            <button
              type="button"
              onClick={close}
              className={`${BUTTON} bg-ink/[0.06] text-ink-70 hover:bg-ink/[0.1]`}
            >
              {t('chat.storage.cancel')}
            </button>
          </div>
        </form>
      </ModalContent>
    </Modal>
  );
});
