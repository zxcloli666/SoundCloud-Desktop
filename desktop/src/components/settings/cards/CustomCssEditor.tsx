import { forwardRef, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Sparkles, Trash2 } from '../../../lib/icons';

function HeaderButton({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-ink-45 hover:text-ink-85 hover:bg-ink/[0.06] transition-all duration-200 cursor-pointer"
    >
      {icon}
      {label}
    </button>
  );
}

function StatusPill({ live }: { live: boolean }) {
  const { t } = useTranslation();
  return (
    <span
      className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-[0.08em] ${
        live ? 'text-[var(--color-accent)]' : 'text-ink-35 bg-ink/[0.04]'
      }`}
      style={live ? { background: 'var(--color-accent-glow)' } : undefined}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${live ? 'bg-[var(--color-accent)]' : 'bg-ink/30'}`}
        style={live ? { boxShadow: '0 0 8px var(--color-accent)' } : undefined}
      />
      {live ? t('settings.customCssLive') : t('settings.customCssOff')}
    </span>
  );
}

export const CustomCssEditor = forwardRef<
  HTMLTextAreaElement,
  {
    value: string;
    live: boolean;
    blocked: number;
    onChange: (value: string) => void;
    onInsert: (text: string) => void;
    onExample: () => void;
  }
>(({ value, live, blocked, onChange, onInsert, onExample }, ref) => {
  const { t } = useTranslation();
  const lines = value ? value.split('\n').length : 0;

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Tab' || e.shiftKey) return;
    e.preventDefault();
    onInsert('  ');
  };

  return (
    <div className="overflow-hidden rounded-[12px] border border-[color:var(--set-line)] bg-shade-30 transition-colors duration-150 focus-within:border-[color:var(--shell-line-hi)]">
      <div className="flex items-center justify-between gap-3 border-b border-[color:var(--set-rule)] bg-ink/[0.02] px-3 py-1.5">
        <div className="flex items-center gap-2.5 min-w-0 pl-1">
          <span className="font-mono text-[11.5px] text-ink-55 truncate">custom.css</span>
          {value.trim() && <StatusPill live={live} />}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {!value.trim() && (
            <HeaderButton
              icon={<Sparkles size={12} />}
              label={t('settings.customCssExample')}
              onClick={onExample}
            />
          )}
          {value && (
            <HeaderButton
              icon={<Trash2 size={12} />}
              label={t('settings.customCssClear')}
              onClick={() => onChange('')}
            />
          )}
        </div>
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={t('settings.customCssPlaceholder')}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        className="block w-full min-h-[240px] max-h-[520px] resize-y bg-transparent px-4 py-3 font-mono text-[12.5px] leading-[1.65] text-ink-85 placeholder:text-ink-20 outline-none"
        style={{ tabSize: 2, caretColor: 'var(--color-accent)' }}
      />
      <div className="flex items-center justify-between gap-3 border-t border-[color:var(--set-rule)] px-4 py-2 text-[11.5px]">
        <span className="text-ink-30 tabular-nums">
          {t('settings.customCssLines', { count: lines })}
        </span>
        {blocked > 0 && (
          <span className="flex min-w-0 items-center gap-1.5 text-amber-400">
            <AlertCircle size={12} />
            <span className="truncate">{t('settings.customCssBlocked', { count: blocked })}</span>
          </span>
        )}
      </div>
    </div>
  );
});
