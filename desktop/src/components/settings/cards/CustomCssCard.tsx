import { openUrl } from '@tauri-apps/plugin-opener';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DOCS_URL } from '../../../lib/constants';
import { customCssHotkeyLabel, sanitizeCustomCss } from '../../../lib/custom-css';
import { BookOpen, Braces } from '../../../lib/icons';
import { useSettingsStore } from '../../../stores/settings';
import { Card, Toggle } from '../primitives';
import { CustomCssAssets } from './CustomCssAssets';
import { CustomCssEditor } from './CustomCssEditor';

const HOOKS = ['app', 'titlebar', 'sidebar', 'main', 'player', 'queue', 'lyrics', 'card', 'tray'];
const VARIABLES = ['--color-accent', '--bg-primary', '--font-sans', '--glass-blur'];

const EXAMPLE = `:root {
  --color-accent: #8b5cf6 !important;
  --bg-primary: #0b0614 !important;
}

[data-ui="sidebar"] {
  background: linear-gradient(180deg, rgba(139, 92, 246, 0.08), transparent);
}

[data-ui="card"] {
  border-radius: 18px;
}
`;

function guideUrl(language: string): string {
  return `${DOCS_URL}/${language.startsWith('ru') ? 'CUSTOM_CSS.ru.md' : 'CUSTOM_CSS.md'}`;
}

function Chip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2 py-1 rounded-lg font-mono text-[11px] text-white/50 bg-white/[0.03] border border-white/[0.06] hover:text-white/90 hover:border-[var(--color-accent-glow)] hover:bg-white/[0.06] transition-all duration-200 cursor-pointer"
    >
      {label}
    </button>
  );
}

function ChipRow({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-[86px] shrink-0 pt-1.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-white/30">
        {title}
      </span>
      <div className="flex flex-wrap gap-1.5 min-w-0">{children}</div>
    </div>
  );
}

function Hotkey() {
  return (
    <span className="inline-flex items-center gap-1">
      {customCssHotkeyLabel().map((key) => (
        <kbd
          key={key}
          className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-md bg-white/[0.07] border border-white/[0.1] font-mono text-[10.5px] font-semibold text-white/65"
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}

export function CustomCssCard() {
  const { t, i18n } = useTranslation();
  const customCss = useSettingsStore((s) => s.customCss);
  const enabled = useSettingsStore((s) => s.customCssEnabled);
  const setCustomCss = useSettingsStore((s) => s.setCustomCss);
  const setEnabled = useSettingsStore((s) => s.setCustomCssEnabled);
  const [draft, setDraft] = useState(customCss);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const { blocked } = useMemo(() => sanitizeCustomCss(draft), [draft]);

  useEffect(() => {
    if (draft === customCss) return;
    const timer = window.setTimeout(() => setCustomCss(draft), 300);
    return () => window.clearTimeout(timer);
  }, [draft, customCss, setCustomCss]);

  useEffect(
    () => () => {
      if (draftRef.current !== useSettingsStore.getState().customCss)
        setCustomCss(draftRef.current);
    },
    [setCustomCss],
  );

  const insert = (text: string) => {
    const el = editorRef.current;
    const start = el?.selectionStart ?? draft.length;
    const end = el?.selectionEnd ?? draft.length;
    setDraft(draft.slice(0, start) + text + draft.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + text.length, start + text.length);
    });
  };

  return (
    <Card
      title={t('settings.customCssTitle')}
      desc={t('settings.customCssDesc')}
      icon={<Braces size={17} />}
      action={<Toggle checked={enabled} onChange={() => setEnabled(!enabled)} />}
    >
      <div className="space-y-4">
        <CustomCssEditor
          ref={editorRef}
          value={draft}
          live={enabled}
          blocked={blocked}
          onChange={setDraft}
          onInsert={insert}
          onExample={() => setDraft(EXAMPLE)}
        />
        <div className="space-y-2">
          <ChipRow title={t('settings.customCssHooks')}>
            {HOOKS.map((hook) => (
              <Chip key={hook} label={hook} onClick={() => insert(`[data-ui="${hook}"] `)} />
            ))}
          </ChipRow>
          <ChipRow title={t('settings.customCssVariables')}>
            {VARIABLES.map((name) => (
              <Chip key={name} label={name} onClick={() => insert(`var(${name})`)} />
            ))}
          </ChipRow>
        </div>
        <CustomCssAssets />
        <div className="flex items-center justify-between gap-4 pt-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-white/35 leading-snug">
            <span>{t('settings.customCssRescue')}</span>
            <Hotkey />
          </p>
          <button
            type="button"
            onClick={() => openUrl(guideUrl(i18n.language))}
            className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-semibold bg-white/[0.06] text-white/75 hover:bg-white/[0.1] hover:text-white border border-white/[0.06] hover:border-white/[0.12] transition-all duration-200 cursor-pointer"
          >
            <BookOpen size={12} />
            {t('settings.customCssGuide')}
          </button>
        </div>
      </div>
    </Card>
  );
}
