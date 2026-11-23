import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  addCssAsset,
  CSS_ASSET_ACCEPT,
  CSS_ASSET_MAX_BYTES,
  cssAssetHttpUrl,
  cssAssetSnippet,
  listCssAssets,
  removeCssAsset,
} from '../../../lib/css-assets';
import { Copy, Trash2, Upload } from '../../../lib/icons';

const ICON_BUTTON =
  'flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-[9px] text-ink-45 transition-colors hover:bg-ink/[0.07] hover:text-ink';

function AssetRow({
  name,
  onCopy,
  onRemove,
}: {
  name: string;
  onCopy: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const src = cssAssetHttpUrl(name);
  return (
    <div className="flex items-center gap-3 rounded-[10px] bg-[var(--set-well)] py-1.5 pr-1.5 pl-2 animate-fade-in-up">
      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-[7px] bg-ink/[0.05]">
        {src && <img src={src} alt="" className="w-full h-full object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] text-ink-85 truncate">{name}</div>
        <div className="truncate font-mono text-[11.5px] text-ink-40">{cssAssetSnippet(name)}</div>
      </div>
      <button
        type="button"
        onClick={onCopy}
        title={t('settings.customCssAssetCopy')}
        aria-label={t('settings.customCssAssetCopy')}
        className={ICON_BUTTON}
      >
        <Copy size={14} />
      </button>
      <button
        type="button"
        onClick={onRemove}
        title={t('settings.customCssAssetRemove')}
        aria-label={t('settings.customCssAssetRemove')}
        className={ICON_BUTTON}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export function CustomCssAssets() {
  const { t } = useTranslation();
  const [names, setNames] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    void listCssAssets().then(setNames);
  }, []);

  useEffect(refresh, [refresh]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const { result } = await addCssAsset(file);
    if (result === 'type') toast.error(t('settings.customCssAssetType'));
    if (result === 'size')
      toast.error(t('settings.customCssAssetSize', { mb: CSS_ASSET_MAX_BYTES / 1024 / 1024 }));
    if (result === 'failed') toast.error(t('settings.customCssAssetFailed'));
    refresh();
  };

  const copy = (name: string) => {
    void navigator.clipboard
      .writeText(cssAssetSnippet(name))
      .then(() => toast(t('settings.customCssAssetCopied')))
      .catch(() => {});
  };

  const remove = async (name: string) => {
    await removeCssAsset(name);
    refresh();
  };

  return (
    <div data-ui="settings-row" className="set-row space-y-2.5 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13.5px] font-medium text-ink-90">{t('settings.customCssAssets')}</p>
          <p className="mt-0.5 text-[12px] leading-snug text-ink-45">
            {t('settings.customCssAssetsHint')}
          </p>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept={CSS_ASSET_ACCEPT}
          className="hidden"
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <button type="button" onClick={() => fileInput.current?.click()} className="set-btn">
          <Upload size={13} />
          {t('settings.customCssAssetAdd')}
        </button>
      </div>
      {names.map((name) => (
        <AssetRow
          key={name}
          name={name}
          onCopy={() => copy(name)}
          onRemove={() => void remove(name)}
        />
      ))}
    </div>
  );
}
