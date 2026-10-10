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
  'w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/[0.08] transition-all cursor-pointer';

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
    <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] animate-fade-in-up">
      <div className="w-10 h-10 shrink-0 rounded-lg overflow-hidden bg-white/[0.05] border border-white/[0.06]">
        {src && <img src={src} alt="" className="w-full h-full object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] text-white/85 truncate">{name}</div>
        <div className="font-mono text-[11px] text-white/35 truncate">{cssAssetSnippet(name)}</div>
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
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-white/30">
            {t('settings.customCssAssets')}
          </span>
          <p className="text-[11.5px] text-white/35 leading-snug">
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
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[12.5px] font-medium text-white/60 hover:text-white/85 hover:bg-white/[0.07] transition-all cursor-pointer"
        >
          <Upload size={14} />
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
