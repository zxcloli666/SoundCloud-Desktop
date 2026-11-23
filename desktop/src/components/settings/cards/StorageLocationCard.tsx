import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  FolderInput,
  FolderOpen,
  HardDrive,
  Loader2,
  RotateCcw,
  TriangleAlert,
} from '../../../lib/icons';
import {
  getStorageLocation,
  openStorageFolder,
  pickStorageFolder,
  relocateErrorKey,
  relocateStorage,
  restartApp,
  type StorageLocationInfo,
} from '../../../lib/storage-location';
import { Skeleton } from '../../ui/Skeleton';
import { Card } from '../primitives';
import { type RelocateTarget, StorageRelocateDialog } from './StorageRelocateDialog';

const SECONDARY_BUTTON = 'set-btn';

function UnavailableNotice({ path, onForget }: { path: string; onForget: () => Promise<void> }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const act = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      toast.error(t(relocateErrorKey(error)));
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-[12px] bg-amber-400/[0.08] px-3.5 py-3">
      <div className="flex gap-3">
        <TriangleAlert size={15} className="mt-0.5 shrink-0 text-amber-400" />
        <div className="min-w-0">
          <p className="text-[12.5px] font-semibold text-ink-90">
            {t('settings.storageUnavailable')}
          </p>
          <p className="text-[11.5px] text-ink-45 font-mono truncate mt-0.5" title={path}>
            {path}
          </p>
          <p className="text-[11.5px] text-ink-40 mt-1 leading-snug">
            {t('settings.storageUnavailableDesc')}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 pl-7">
        <button
          type="button"
          disabled={busy}
          onClick={() => void act(restartApp)}
          className={SECONDARY_BUTTON}
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
          {t('settings.storageRestart')}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void act(onForget)}
          className={SECONDARY_BUTTON}
        >
          {t('settings.storageForget')}
        </button>
      </div>
    </div>
  );
}

export function StorageLocationCard() {
  const { t } = useTranslation();
  const [info, setInfo] = useState<StorageLocationInfo | null>(null);
  const [target, setTarget] = useState<RelocateTarget | null>(null);

  useEffect(() => {
    void getStorageLocation()
      .then(setInfo)
      .catch(() => {});
  }, []);

  const choose = useCallback(async () => {
    if (!info) return;
    try {
      const picked = await pickStorageFolder(info.path);
      if (picked) setTarget({ picked, display: picked });
    } catch (error) {
      toast.error(String(error));
    }
  }, [info]);

  const forget = useCallback(async () => {
    await relocateStorage(null, false);
    await restartApp();
  }, []);

  const openFolder = useCallback(() => {
    void openStorageFolder().catch((error) => toast.error(String(error)));
  }, []);

  return (
    <Card
      title={t('settings.storageLocation')}
      desc={t('settings.storageLocationDesc')}
      icon={<HardDrive size={17} />}
      action={
        info && (
          <span className={`set-chip ${info.isDefault ? '' : 'text-[var(--color-accent)]'}`}>
            {info.isDefault ? t('settings.storageDefault') : t('settings.storageCustom')}
          </span>
        )
      }
    >
      <div className="space-y-3">
        {info?.unavailablePath && (
          <UnavailableNotice path={info.unavailablePath} onForget={forget} />
        )}

        <button
          type="button"
          onClick={openFolder}
          disabled={!info}
          title={t('settings.storageOpenFolder')}
          className="group/path flex h-10 w-full cursor-pointer items-center gap-3 rounded-[10px] border border-[color:var(--set-line)] bg-[var(--set-well)] px-3 text-left transition-colors duration-150 hover:border-[color:var(--shell-line-hi)]"
        >
          <FolderOpen
            size={16}
            className="shrink-0 text-ink-40 group-hover/path:text-[var(--color-accent)] transition-colors"
          />
          {info ? (
            <span className="min-w-0 flex-1 text-[12.5px] text-ink-80 font-mono truncate" dir="rtl">
              <bdi>{info.path}</bdi>
            </span>
          ) : (
            <Skeleton className="h-[16px] flex-1" />
          )}
        </button>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!info}
            onClick={() => void choose()}
            className={SECONDARY_BUTTON}
          >
            <FolderInput size={13} />
            {t('settings.storageChange')}
          </button>
          {info && !info.isDefault && (
            <button
              type="button"
              onClick={() => setTarget({ picked: null, display: info.defaultPath })}
              className={SECONDARY_BUTTON}
            >
              <RotateCcw size={13} />
              {t('settings.storageReset')}
            </button>
          )}
        </div>

        <p className="text-[12px] leading-snug text-ink-45">{t('settings.storageApplyHint')}</p>
      </div>

      <StorageRelocateDialog
        from={info?.path ?? ''}
        target={target}
        onClose={() => setTarget(null)}
      />
    </Card>
  );
}
