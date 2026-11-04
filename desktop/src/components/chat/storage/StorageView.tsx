import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { MyMedia } from '../../../lib/chat/media-types';
import { ChevronLeft } from '../../../lib/icons';
import { useChatStore } from '../../../stores/chat';
import { selectMediaStar } from '../../../stores/chat/media';
import { CacheCard } from './CacheCard';
import { ChatUsageList } from './ChatUsageList';
import { DeleteAllCard } from './DeleteAllCard';
import { DeleteConfirm } from './DeleteConfirm';
import { GridToolbar } from './GridToolbar';
import { STORAGE_KEYFRAMES } from './keyframes';
import { MediaGrid } from './MediaGrid';
import { StarPreview } from './StarPreview';
import { StorageHero } from './StorageHero';
import { GridEmpty, GridSkeleton, StorageError, StorageSkeleton } from './StorageStates';
import { useSelectionStore } from './selection-store';
import { useStorageStore } from './storage-store';
import { UndoToast } from './UndoToast';
import { useStorageKeys } from './useStorageKeys';

function Header() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <header className="mb-5 flex items-center gap-3">
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/chats'))}
        aria-label={t('chat.storage.back')}
        className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full bg-ink/[0.05] text-ink-70 outline-none transition-colors hover:bg-ink/[0.09] hover:text-ink-90 focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        <ChevronLeft size={18} />
      </button>
      <h1 className="text-[24px] font-bold tracking-tight text-ink-92">
        {t('chat.storage.title')}
      </h1>
    </header>
  );
}

function ItemsArea({ onDelete }: { onDelete: (items: MyMedia[]) => void }) {
  const items = useStorageStore((state) => state.items);
  const itemsLoad = useStorageStore((state) => state.itemsLoad);
  const itemsError = useStorageStore((state) => state.itemsError);
  const origin = useStorageStore((state) => state.origin);
  const loadItems = useStorageStore((state) => state.loadItems);

  const openConfirm = useCallback(() => {
    const picked = useSelectionStore.getState().picked;
    const chosen = useStorageStore.getState().items.filter((item) => picked.has(item.id));
    if (chosen.length > 0) onDelete(chosen);
  }, [onDelete]);

  useStorageKeys(items, openConfirm);

  useEffect(() => {
    useSelectionStore.getState().keepOnly(items.map((item) => item.id));
  }, [items]);

  let body = <MediaGrid items={items} />;
  if (itemsLoad === 'failed')
    body = <StorageError error={itemsError} onRetry={() => void loadItems()} />;
  else if (itemsLoad !== 'ready' && items.length === 0) body = <GridSkeleton />;
  else if (items.length === 0) body = <GridEmpty filtered={origin !== null} />;

  return (
    <section className="min-w-0">
      <GridToolbar items={items} onDelete={openConfirm} />
      {body}
    </section>
  );
}

function FullView({ lapsed }: { lapsed: boolean }) {
  const files = useStorageStore((state) => state.usage?.files ?? 0);
  const [confirm, setConfirm] = useState<MyMedia[] | null>(null);
  return (
    <div className="grid items-start gap-x-5 gap-y-4 [grid-template-areas:'side'_'main'_'tools'] @min-[900px]:grid-cols-[320px_minmax(0,1fr)] @min-[900px]:grid-rows-[auto_1fr] @min-[900px]:[grid-template-areas:'side_main'_'tools_main']">
      <aside className="flex min-w-0 flex-col gap-4 [grid-area:side]">
        <StorageHero lapsed={lapsed} />
        <ChatUsageList />
      </aside>
      <div className="min-w-0 [grid-area:main]">
        <ItemsArea onDelete={setConfirm} />
      </div>
      <div className="flex min-w-0 flex-col gap-4 [grid-area:tools]">
        <CacheCard />
        <DeleteAllCard disabled={files === 0} />
      </div>
      <DeleteConfirm items={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}

function LockedView() {
  return (
    <div className="flex flex-col gap-4">
      <StarPreview />
      <div className="grid gap-4 @min-[720px]:grid-cols-2">
        <CacheCard />
      </div>
    </div>
  );
}

export const StorageView = memo(function StorageView() {
  const star = useChatStore(selectMediaStar);
  const usage = useStorageStore((state) => state.usage);
  const usageLoad = useStorageStore((state) => state.usageLoad);
  const usageError = useStorageStore((state) => state.usageError);
  const itemsLoad = useStorageStore((state) => state.itemsLoad);
  const empty = useStorageStore((state) => state.items.length === 0);

  useEffect(() => {
    void useStorageStore.getState().reload();
    return () => useSelectionStore.getState().clear();
  }, []);

  let body = <StorageSkeleton />;
  if (!usage && usageLoad === 'failed') {
    body = (
      <StorageError error={usageError} onRetry={() => void useStorageStore.getState().reload()} />
    );
  } else if (
    usage &&
    !star &&
    usage.files === 0 &&
    usage.reserved === 0 &&
    empty &&
    itemsLoad !== 'loading'
  ) {
    body = <LockedView />;
  } else if (usage) {
    body = <FullView lapsed={!star} />;
  }

  return (
    <div className="@container">
      <style>{STORAGE_KEYFRAMES}</style>
      <Header />
      {body}
      <UndoToast />
    </div>
  );
});
