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

const HOOKS = [
  'app',
  'titlebar',
  'sidebar',
  'nav-item',
  'search',
  'main',
  'page',
  'player',
  'play-button',
  'queue',
  'lyrics',
  'card',
  'track-card',
  'track-row',
  'playlist-card',
  'artwork',
  'modal',
  'context-menu',
  'button',
  'tab',
  'chip',
  'hero',
  'tray',
];
const VARIABLES = [
  '--color-accent',
  '--bg-primary',
  '--ink',
  '--paper',
  '--surface',
  '--font-sans',
  '--glass-blur',
];

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
      className="cursor-pointer rounded-[7px] border border-[color:var(--set-line)] bg-[var(--set-well)] px-2 py-1 font-mono text-[11.5px] text-ink-60 transition-colors duration-150 hover:border-accent hover:text-ink"
    >
      {label}
    </button>
  );
}

function ChipRow({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-[92px] shrink-0 pt-1 text-[12px] font-medium text-ink-50">{title}</span>
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
          className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-md bg-ink/[0.07] border border-ink/[0.1] font-mono text-[10.5px] font-semibold text-ink-65"
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
      action={
        <Toggle
          checked={enabled}
          onChange={() => setEnabled(!enabled)}
          label={t('settings.customCssTitle')}
        />
      }
    >
      <div className="set-group space-y-3 py-3.5">
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
      </div>
      <CustomCssAssets />
      <div className="set-row flex items-center justify-between gap-4 py-3">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] leading-snug text-ink-45">
          <span>{t('settings.customCssRescue')}</span>
          <Hotkey />
        </p>
        <button type="button" onClick={() => openUrl(guideUrl(i18n.language))} className="set-btn">
          <BookOpen size={13} />
          {t('settings.customCssGuide')}
        </button>
      </div>
    </Card>
  );
}
