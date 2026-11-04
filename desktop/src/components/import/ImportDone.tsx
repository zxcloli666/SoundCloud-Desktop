import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { proxiedAssetUrl } from '../../lib/asset-url';
import { Check } from '../../lib/icons';
import { useImportStore } from '../../stores/import';
import { ImportPending } from './ImportPending';
import { ImportSyncSwitch } from './ImportSyncSwitch';

export function ImportDone() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const result = useImportStore((s) => s.result);
  const closeDialog = useImportStore((s) => s.closeDialog);
  const discard = useImportStore((s) => s.discard);
  const history = useImportStore((s) =>
    s.history.find((entry) => entry.id === s.result?.historyId),
  );

  if (!result) return null;
  const playlist = result.playlist;
  const cover = playlist?.artwork_url ? proxiedAssetUrl(playlist.artwork_url) : null;

  const open = () => {
    if (!playlist) return;
    closeDialog();
    navigate(`/playlist/${encodeURIComponent(playlist.urn)}`);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-ink/[0.08] bg-ink/[0.03] backdrop-blur-xl">
      <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-transparent" />
      <div className="relative flex items-center gap-4 p-5">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-ink/[0.06] bg-ink/[0.06]">
          {cover ? (
            <img src={cover} alt="" className="size-full object-cover" />
          ) : (
            <Check size={26} className="text-accent/70" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold text-ink-90">
            {playlist?.title ?? t(`importer.mode.${result.mode}`)}
          </p>
          <p className="mt-0.5 text-[12px] text-ink-40">
            {t('importer.savedCount', { count: result.count })}
          </p>
          <div className="mt-0.5">
            <ImportPending live />
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          {playlist && (
            <button
              type="button"
              onClick={open}
              className="rounded-xl border border-accent/10 bg-accent/20 px-4 py-2 text-[13px] font-semibold text-accent transition-all hover:bg-accent/30 cursor-pointer"
            >
              {t('importer.openPlaylist')}
            </button>
          )}
          <button
            type="button"
            onClick={discard}
            className="rounded-xl border border-ink/[0.08] bg-ink/[0.05] px-4 py-2 text-[13px] font-semibold text-ink-72 transition-all hover:bg-ink/[0.09] cursor-pointer"
          >
            {t('importer.again')}
          </button>
        </div>
      </div>
      {history?.sync && (
        <div className="relative border-t border-ink/[0.06] px-5 py-3">
          <ImportSyncSwitch history={history} />
        </div>
      )}
    </div>
  );
}
