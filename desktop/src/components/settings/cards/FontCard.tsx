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
import { useSettingsStore } from '../../../stores/settings';
import { Card } from '../primitives';

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

const ACTIVE_STYLE = {
  background:
    'linear-gradient(180deg, var(--color-accent-glow), transparent), rgba(255,255,255,0.05)',
  borderColor: 'var(--color-accent)',
  boxShadow: '0 0 16px var(--color-accent-glow)',
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
    <button
      type="button"
      onClick={onSelect}
      className={`group rounded-2xl border overflow-hidden transition-all duration-200 cursor-pointer hover:scale-[1.03] active:scale-[0.97] ${
        active ? '' : 'border-white/[0.06] bg-white/[0.02] hover:border-white/15'
      }`}
      style={active ? ACTIVE_STYLE : undefined}
    >
      <div
        className={`h-14 flex items-center justify-center text-[22px] font-semibold tracking-tight ${
          active ? 'text-white' : 'text-white/70 group-hover:text-white/85'
        }`}
        style={{ fontFamily: family }}
      >
        {SAMPLE}
      </div>
      <div
        className={`px-2 pb-2 text-[11.5px] font-medium truncate ${active ? 'text-white/90' : 'text-white/45'}`}
      >
        {label}
      </div>
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
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] animate-fade-in-up">
      <div className="min-w-0 flex-1">
        <div
          className="text-[14px] text-white/85 truncate"
          style={{ fontFamily: `"${family}", var(--font-sans)` }}
        >
          {family}
        </div>
        <div className="text-[11px] text-white/35 truncate">{fileName}</div>
      </div>
      <button
        type="button"
        onClick={removeFile}
        title={t('settings.fontRemoveFile')}
        aria-label={t('settings.fontRemoveFile')}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/[0.08] transition-all cursor-pointer"
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
      <button
        type="button"
        onClick={() => fileInput.current?.click()}
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[12.5px] font-medium text-white/60 hover:text-white/85 hover:bg-white/[0.07] transition-all cursor-pointer"
      >
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
          className="w-full px-4 py-2.5 pr-10 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[13px] text-white/80 placeholder:text-white/20 focus:border-white/[0.12] focus:bg-white/[0.06] transition-all duration-200 outline-none"
          style={clean ? { fontFamily: `"${clean}", var(--font-sans)` } : undefined}
        />
        {installed !== null && (
          <span
            className={`absolute right-3 top-1/2 -translate-y-1/2 ${
              installed ? 'text-emerald-400/80' : 'text-amber-400/80'
            }`}
          >
            {installed ? <Check size={15} /> : <X size={15} />}
          </span>
        )}
      </div>
      <p
        className={`text-[11.5px] leading-snug ${installed === false ? 'text-amber-300/60' : 'text-white/35'}`}
      >
        {installed === false
          ? t('settings.fontNotFound')
          : installed
            ? t('settings.fontFound')
            : t('settings.fontCustomHint')}
      </p>
      {uploadButton}
      {uploadFailed && (
        <p className="text-[11.5px] leading-snug text-amber-300/60">
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

  useEffect(() => {
    for (const font of FONT_OPTIONS) void loadBundledFont(font);
  }, []);

  const customFamily = fontFamilyOf('custom', customFontName);

  return (
    <Card title={t('settings.fontTitle')} desc={t('settings.fontDesc')} icon={<Type size={17} />}>
      <div className="space-y-4">
        <div className="grid grid-cols-5 gap-2.5">
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
      </div>
    </Card>
  );
}
