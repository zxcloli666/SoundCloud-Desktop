import { openUrl } from '@tauri-apps/plugin-opener';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Download, ExternalLink, Info } from '../../lib/icons';
import { manualHintKey, pickReleaseAsset } from '../../lib/update-assets';
import type { GithubRelease } from '../../lib/update-check';
import type { UpdaterInfo } from '../../lib/updater';

const MB = 1024 * 1024;

export function ManualUpdate({
  release,
  info,
  failed,
  onDismiss,
}: {
  release: GithubRelease;
  info: UpdaterInfo | null;
  failed: boolean;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const asset = info ? pickReleaseAsset(release.assets, info) : null;
  const target = asset?.browser_download_url ?? release.html_url;

  return (
    <div className="px-5 pb-5">
      {failed && (
        <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-red-400/20 bg-red-400/[0.06] px-3.5 py-2.5">
          <AlertCircle size={14} className="mt-px shrink-0 text-red-300/90" />
          <p className="min-w-0 text-[11.5px] leading-snug text-white/65">
            {t('update.installFailed')}
          </p>
        </div>
      )}
      {info && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-3">
          <Info size={14} className="mt-px shrink-0 text-accent" />
          <div className="min-w-0">
            <p className="text-[11.5px] leading-relaxed text-white/60">{t(manualHintKey(info))}</p>
            {asset && (
              <p className="mt-2 truncate font-mono text-[11px] text-white/35" title={asset.name}>
                {asset.name} · {(asset.size / MB).toFixed(0)} MB
              </p>
            )}
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onDismiss}
          className="flex-1 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] text-[13px] text-white/50 font-medium transition-colors cursor-pointer"
        >
          {t('update.later')}
        </button>
        <button
          type="button"
          onClick={() => openUrl(target)}
          className="flex-1 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-[13px] text-accent-contrast font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-[0_0_20px_var(--color-accent-glow)]"
        >
          {t('update.download')}
          {asset ? <Download size={13} /> : <ExternalLink size={13} />}
        </button>
      </div>
      {asset && (
        <button
          type="button"
          onClick={() => openUrl(release.html_url)}
          className="mt-3 mx-auto flex items-center gap-1.5 text-[11.5px] text-white/35 hover:text-white/70 transition-colors cursor-pointer"
        >
          {t('update.openReleasePage')}
          <ExternalLink size={11} />
        </button>
      )}
    </div>
  );
}
