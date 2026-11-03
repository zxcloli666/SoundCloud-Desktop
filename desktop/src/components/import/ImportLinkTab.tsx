import { useTranslation } from 'react-i18next';

const SOURCES = ['spotify', 'youtube', 'yandex'] as const;

interface Props {
  url: string;
  onUrl: (url: string) => void;
  detected: string | null;
  disabled: boolean;
}

export function ImportLinkTab({ url, onUrl, detected, disabled }: Props) {
  const { t } = useTranslation();
  const unknown = url.trim() !== '' && detected === null;

  return (
    <div className="space-y-4">
      <input
        type="text"
        value={url}
        onChange={(e) => onUrl(e.target.value)}
        placeholder={t('importer.linkPlaceholder')}
        disabled={disabled}
        className="w-full px-4 py-3 rounded-xl bg-ink/[0.04] border border-ink/[0.06] text-[13px] text-ink-80 placeholder:text-ink-20 focus:border-ink/[0.12] focus:bg-ink/[0.06] transition-all duration-200 outline-none disabled:opacity-50"
      />
      <div className="flex flex-wrap gap-2">
        {SOURCES.map((source) => (
          <span
            key={source}
            className={`rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
              detected === source
                ? 'border-accent/30 bg-accent/15 text-accent'
                : unknown
                  ? 'border-red-500/20 bg-red-500/[0.06] text-ink-40'
                  : 'border-ink/[0.08] bg-ink/[0.03] text-ink-40'
            }`}
          >
            {t(`importer.source.${source}`)}
          </span>
        ))}
      </div>
      {unknown && <p className="text-[12px] text-red-300/90">{t('importer.unknownLink')}</p>}
    </div>
  );
}
