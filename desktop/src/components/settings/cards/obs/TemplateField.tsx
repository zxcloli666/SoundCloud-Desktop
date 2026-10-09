import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { OBS_TOKENS } from '../../../../lib/obs/format';

const TOKEN_LABELS: Record<(typeof OBS_TOKENS)[number], string> = {
  '{artist}': 'settings.obsTokenArtist',
  '{title}': 'settings.obsTokenTitle',
};

export function TemplateField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);

  const insert = (token: string) => {
    const el = input.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + token + value.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  return (
    <div className="space-y-2">
      <input
        ref={input}
        value={value}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 font-mono text-[13px] text-white/85 outline-none transition-colors focus:border-accent"
      />
      <div className="flex flex-wrap gap-1.5">
        {OBS_TOKENS.map((token) => (
          <button
            key={token}
            type="button"
            onClick={() => insert(token)}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.04] px-2 py-1 text-[11.5px] text-white/55 transition-colors hover:bg-white/[0.08] hover:text-white/80"
          >
            <code className="font-mono text-accent">{token}</code>
            {t(TOKEN_LABELS[token])}
          </button>
        ))}
      </div>
    </div>
  );
}
