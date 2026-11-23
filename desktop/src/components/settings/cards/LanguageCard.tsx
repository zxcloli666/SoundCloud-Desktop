import { openUrl } from '@tauri-apps/plugin-opener';
import { useTranslation } from 'react-i18next';
import { changeAppLanguage } from '../../../i18n';
import { REQUEST_LANGUAGE_URL } from '../../../lib/constants';
import { ExternalLink, Globe } from '../../../lib/icons';
import { Card } from '../primitives';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Русский' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'ko', label: '한국어' },
  { code: 'pt', label: 'Português' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
] as const;

export function LanguageCard() {
  const { t, i18n } = useTranslation();
  return (
    <Card title={t('settings.language')} icon={<Globe size={17} />}>
      <div data-ui="segmented" role="radiogroup" className="set-seg set-lang">
        {LANGUAGES.map((lang) => {
          const active = i18n.language === lang.code;
          return (
            <button
              key={lang.code}
              type="button"
              role="radio"
              aria-checked={active}
              data-ui="segment"
              data-active={active ? 'true' : 'false'}
              onClick={() => void changeAppLanguage(lang.code)}
              className="set-seg-item"
            >
              {lang.label}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => void openUrl(REQUEST_LANGUAGE_URL)}
        className="flex w-fit max-w-full cursor-pointer items-center gap-1.5 text-left text-[12px] text-ink-45 transition-colors duration-150 hover:text-ink"
      >
        <ExternalLink size={12} className="shrink-0" />
        <span className="truncate">{t('settings.languageRequest')}</span>
      </button>
    </Card>
  );
}
