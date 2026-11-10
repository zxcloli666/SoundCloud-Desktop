import { useTranslation } from 'react-i18next';

interface Props {
  text: string;
  onText: (text: string) => void;
  disabled: boolean;
}

const FIELD =
  'w-full px-4 py-3 rounded-xl bg-ink/[0.04] border border-ink/[0.06] text-[13px] text-ink-80 placeholder:text-ink-20 focus:border-ink/[0.12] focus:bg-ink/[0.06] transition-all duration-200 outline-none disabled:opacity-50';

export function ImportTextTab({ text, onText, disabled }: Props) {
  const { t } = useTranslation();
  const lines = text.split('\n').filter((line) => line.trim() !== '').length;

  return (
    <div className="space-y-2">
      <textarea
        value={text}
        onChange={(e) => onText(e.target.value)}
        placeholder={t('importer.textPlaceholder')}
        disabled={disabled}
        rows={8}
        spellCheck={false}
        className={`${FIELD} resize-none font-mono text-[12px] leading-relaxed`}
      />
      <p className="min-h-[18px] text-right text-[12px] tabular-nums text-ink-40">
        {lines > 0 && t('importer.savedCount', { count: lines })}
      </p>
    </div>
  );
}
