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
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-white/45 hover:text-white/85 hover:bg-white/[0.06] transition-all duration-200 cursor-pointer"
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
        live ? 'text-[var(--color-accent)]' : 'text-white/35 bg-white/[0.04]'
      }`}
      style={live ? { background: 'var(--color-accent-glow)' } : undefined}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${live ? 'bg-[var(--color-accent)]' : 'bg-white/30'}`}
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
    <div className="rounded-2xl border border-white/[0.07] bg-black/30 overflow-hidden focus-within:border-white/[0.14] transition-colors duration-200">
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-white/[0.05] bg-white/[0.02]">
        <div className="flex items-center gap-2.5 min-w-0 pl-1">
          <span className="font-mono text-[11.5px] text-white/55 truncate">custom.css</span>
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
        className="block w-full min-h-[240px] max-h-[520px] resize-y bg-transparent px-4 py-3 font-mono text-[12.5px] leading-[1.65] text-white/85 placeholder:text-white/20 outline-none"
        style={{ tabSize: 2, caretColor: 'var(--color-accent)' }}
      />
      <div className="flex items-center justify-between gap-3 px-4 py-2 border-t border-white/[0.05] text-[11px]">
        <span className="text-white/30 tabular-nums">
          {t('settings.customCssLines', { count: lines })}
        </span>
        {blocked > 0 && (
          <span className="flex items-center gap-1.5 text-amber-300/70 min-w-0">
            <AlertCircle size={12} />
            <span className="truncate">{t('settings.customCssBlocked', { count: blocked })}</span>
          </span>
        )}
      </div>
    </div>
  );
});
