import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Type, Upload, X } from '../../../lib/icons';
import {
  FONT_FILE_ACCEPT,
  FONT_OPTIONS,
  fontFamilyOf,
  type InterfaceFont,
  importFontFile,
  isFontInstalled,
  loadBundledFont,
  removeUploadedFont,
  sanitizeFontName,
} from '../../../lib/interface-font';
import { activeLook } from '../../../lib/themes/records';
import { useSettingsStore } from '../../../stores/settings';
import { useThemesStore } from '../../../stores/themes';
import { Card } from '../primitives';
import { ThemeOverrideRow } from './ThemeOverrideRow';

const SAMPLE = 'Aa Бб';

const FONT_NAMES: Partial<Record<InterfaceFont, string>> = {
  inter: 'Inter',
  manrope: 'Manrope',
  onest: 'Onest',
  golos: 'Golos Text',
  montserrat: 'Montserrat',
  rubik: 'Rubik',
  nunito: 'Nunito',
  raleway: 'Raleway',
  comfortaa: 'Comfortaa',
};

function FontTile({
  label,
  family,
  active,
  onSelect,
}: {
  label: string;
  family: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button type="button" onClick={onSelect} data-active={active} className="set-tile">
      <span
        className="set-tile-art flex h-12 items-center justify-center text-[20px] font-semibold tracking-tight text-ink-85"
        style={{ fontFamily: family }}
      >
        {SAMPLE}
      </span>
      <span className="set-tile-label text-center">{label}</span>
    </button>
  );
}

function UploadedFontRow({ family, fileName }: { family: string; fileName: string }) {
  const { t } = useTranslation();
  const setCustomFontName = useSettingsStore((s) => s.setCustomFontName);
  const setCustomFontFile = useSettingsStore((s) => s.setCustomFontFile);

  const removeFile = () => {
    setCustomFontFile('');
    setCustomFontName('');
    void removeUploadedFont(fileName);
  };

  return (
    <div className="flex items-center gap-3 rounded-[10px] bg-[var(--set-well)] py-2 pr-1.5 pl-3 animate-fade-in-up">
      <div className="min-w-0 flex-1">
        <div
          className="text-[14px] text-ink-85 truncate"
          style={{ fontFamily: `"${family}", var(--font-sans)` }}
        >
          {family}
        </div>
        <div className="truncate text-[11.5px] text-ink-40">{fileName}</div>
      </div>
      <button
        type="button"
        onClick={removeFile}
        title={t('settings.fontRemoveFile')}
        aria-label={t('settings.fontRemoveFile')}
        className="set-btn w-8 px-0"
        data-tone="quiet"
      >
        <X size={15} />
      </button>
    </div>
  );
}

function CustomFontInput() {
  const { t } = useTranslation();
  const customFontName = useSettingsStore((s) => s.customFontName);
  const customFontFile = useSettingsStore((s) => s.customFontFile);
  const setCustomFontName = useSettingsStore((s) => s.setCustomFontName);
  const setCustomFontFile = useSettingsStore((s) => s.setCustomFontFile);
  const [draft, setDraft] = useState(customFontName);
  const [uploadFailed, setUploadFailed] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const clean = sanitizeFontName(draft);
  const installed = useMemo(() => (clean ? isFontInstalled(clean) : null), [clean]);

  useEffect(() => {
    if (customFontFile || clean === customFontName) return;
    const timer = window.setTimeout(() => setCustomFontName(clean), 400);
    return () => window.clearTimeout(timer);
  }, [clean, customFontName, customFontFile, setCustomFontName]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const imported = await importFontFile(file).catch(() => null);
    setUploadFailed(!imported);
    if (!imported) return;
    setDraft(imported.family);
    setCustomFontName(imported.family);
    setCustomFontFile(imported.fileName);
  };

  const uploadButton = (
    <>
      <input
        ref={fileInput}
        type="file"
        accept={FONT_FILE_ACCEPT}
        className="hidden"
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <button type="button" onClick={() => fileInput.current?.click()} className="set-btn">
        <Upload size={14} />
        {t('settings.fontUpload')}
      </button>
    </>
  );

  if (customFontFile) {
    return (
      <div className="space-y-2">
        <UploadedFontRow family={customFontName} fileName={customFontFile} />
        {uploadButton}
      </div>
    );
  }

  return (
    <div className="space-y-2 animate-fade-in-up">
      <div className="relative">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => setCustomFontName(clean)}
          onKeyDown={(e) => e.key === 'Enter' && setCustomFontName(clean)}
          placeholder={t('settings.fontCustomPlaceholder')}
          spellCheck={false}
          className="h-9 w-full rounded-[10px] border border-[color:var(--set-line)] bg-[var(--set-well)] pr-10 pl-3 text-[13px] text-ink-90 outline-none transition-colors duration-150 placeholder:text-ink-35 focus:border-accent"
          style={clean ? { fontFamily: `"${clean}", var(--font-sans)` } : undefined}
        />
        {installed !== null && (
          <span
            className={`absolute right-3 top-1/2 -translate-y-1/2 ${
              installed ? 'text-ok' : 'text-amber-400'
            }`}
          >
            {installed ? <Check size={15} /> : <X size={15} />}
          </span>
        )}
      </div>
      <p
        className={`text-[11.5px] leading-snug ${installed === false ? 'text-amber-400' : 'text-ink-40'}`}
      >
        {installed === false
          ? t('settings.fontNotFound')
          : installed
            ? t('settings.fontFound')
            : t('settings.fontCustomHint')}
      </p>
      {uploadButton}
      {uploadFailed && (
        <p className="text-[11.5px] leading-snug text-amber-400">
          {t('settings.fontUploadFailed')}
        </p>
      )}
    </div>
  );
}

export function FontCard() {
  const { t } = useTranslation();
  const interfaceFont = useSettingsStore((s) => s.interfaceFont);
  const customFontName = useSettingsStore((s) => s.customFontName);
  const setInterfaceFont = useSettingsStore((s) => s.setInterfaceFont);
  const look = useThemesStore(activeLook);

  useEffect(() => {
    for (const font of FONT_OPTIONS) void loadBundledFont(font);
  }, []);

  const customFamily = fontFamilyOf('custom', customFontName);

  return (
    <Card title={t('settings.fontTitle')} desc={t('settings.fontDesc')} icon={<Type size={17} />}>
      {look?.font && (
        <ThemeOverrideRow label={t('settings.themesFontFromTheme', { name: look.name })} />
      )}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(108px,1fr))] gap-2.5">
        {FONT_OPTIONS.map((font) => (
          <FontTile
            key={font}
            label={FONT_NAMES[font] ?? t('settings.fontSystem')}
            family={fontFamilyOf(font, '') ?? 'inherit'}
            active={interfaceFont === font}
            onSelect={() => setInterfaceFont(font)}
          />
        ))}
        <FontTile
          label={t('settings.fontCustom')}
          family={customFamily ? `${customFamily}, var(--font-sans)` : 'inherit'}
          active={interfaceFont === 'custom'}
          onSelect={() => setInterfaceFont('custom')}
        />
      </div>
      {interfaceFont === 'custom' && <CustomFontInput />}
    </Card>
  );
}
