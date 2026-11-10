import { memo, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { MediaId, MediaRef, MyMedia } from '../../../lib/chat/media-types';
import { ChevronLeft, Images, Upload } from '../../../lib/icons';
import { useChatMediaStore } from '../../../stores/chat/media';
import { ModalTitle } from '../../ui/Modal';
import { GridSkeleton, StorageError, StorageNote } from '../storage/StorageStates';
import { StoredGrid } from './StoredGrid';
import { storedChoices } from './stored-list';
import { useStoredStore } from './stored-store';

const FOCUS = 'outline-none focus-visible:ring-2 focus-visible:ring-accent/60';
const HEIGHT = 'clamp(8rem, calc(85vh - 17.5rem), 22rem)';

export const SheetTitle = memo(function SheetTitle({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const back = useRef<HTMLButtonElement>(null);
  useEffect(() => back.current?.focus(), []);
  return (
    <div className="-ml-1.5 flex items-center gap-1.5 pr-8">
      <button
        ref={back}
        type="button"
        data-stored-back
        aria-label={t('chat.storage.back')}
        onClick={onBack}
        className={`grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-ink-60 transition-colors hover:bg-ink/[0.08] hover:text-ink-90 ${FOCUS}`}
      >
        <ChevronLeft size={18} />
      </button>
      <ModalTitle>{t('chat.backdrop.stored')}</ModalTitle>
    </div>
  );
});

function Empty({ onPhoto }: { onPhoto: () => void }) {
  const { t } = useTranslation();
  return (
    <StorageNote
      ui="chat-backdrop-stored-empty"
      icon={<Images size={22} />}
      title={t('chat.backdrop.storedEmpty')}
      line={t('chat.backdrop.storedEmptyLine')}
      action={
        <button
          type="button"
          onClick={onPhoto}
          className={`flex cursor-pointer items-center gap-1.5 rounded-xl bg-ink/[0.07] px-3.5 py-2 text-[12.5px] font-semibold text-ink-80 transition-colors hover:bg-ink/[0.11] ${FOCUS}`}
        >
          <Upload size={12} />
          {t('chat.backdrop.photo')}
        </button>
      }
    />
  );
}

export const StoredSheet = memo(function StoredSheet({
  current,
  onPick,
  onPreview,
  onPhoto,
}: {
  current: MediaId | null;
  onPick: (source: MediaRef) => void;
  onPreview: (item: MyMedia) => void;
  onPhoto: () => void;
}) {
  const items = useStoredStore((state) => state.items);
  const known = useStoredStore((state) => state.known);
  const cursor = useStoredStore((state) => state.cursor);
  const load = useStoredStore((state) => state.load);
  const error = useStoredStore((state) => state.error);
  const reload = useStoredStore((state) => state.reload);
  const gone = useChatMediaStore((state) => state.shown);
  const choices = useMemo(
    () => storedChoices(items, { known, gone, current }),
    [items, known, gone, current],
  );
  useEffect(() => {
    void useStoredStore.getState().reload();
    return () => useStoredStore.getState().leave();
  }, []);

  let body = <StoredGrid items={choices} onPick={onPick} onPreview={onPreview} />;
  if (load === 'failed') body = <StorageError error={error} onRetry={() => void reload()} />;
  else if (load !== 'ready') body = <GridSkeleton count={6} />;
  else if (choices.length === 0 && !cursor) body = <Empty onPhoto={onPhoto} />;

  return (
    <div
      data-ui="chat-backdrop-stored-sheet"
      data-scroll-root
      className="-mx-1 overflow-y-auto overscroll-contain px-1 py-1 backdrop-motion animate-[backdrop-in_0.3s_var(--ease-apple)_both]"
      style={{ height: HEIGHT }}
    >
      {body}
    </div>
  );
});
