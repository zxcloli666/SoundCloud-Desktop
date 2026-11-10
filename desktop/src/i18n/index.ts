import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { useSettingsStore } from '../stores/settings';

const FALLBACK_LANGUAGE = 'en';
const localeLoaders = {
  en: () => import('./locales/en.json'),
  ru: () => import('./locales/ru.json'),
  tr: () => import('./locales/tr.json'),
  ko: () => import('./locales/ko.json'),
  pt: () => import('./locales/pt.json'),
} as const;

const voiceLoaders = {
  en: () => import('./locales/voice/en.json'),
  ru: () => import('./locales/voice/ru.json'),
  tr: () => import('./locales/voice/tr.json'),
  ko: () => import('./locales/voice/ko.json'),
  pt: () => import('./locales/voice/pt.json'),
} as const;

type AppLanguage = keyof typeof localeLoaders;

const chatLocaleLoaders = import.meta.glob<Record<string, unknown>>('./locales/chat/*.json', {
  import: 'default',
});

async function loadChatLocale(language: AppLanguage) {
  const suffix = `.${language}.json`;
  const areas = await Promise.all(
    Object.entries(chatLocaleLoaders)
      .filter(([path]) => path.endsWith(suffix))
      .map(async ([path, load]) => {
        const area = path.slice(path.lastIndexOf('/') + 1, -suffix.length);
        return [area, await load()] as const;
      }),
  );
  return Object.fromEntries(areas);
}

function normalizeLanguage(language: string | undefined | null): AppLanguage {
  const code = language?.split('-')[0];
  return code && code in localeLoaders ? (code as AppLanguage) : FALLBACK_LANGUAGE;
}

const loadedLanguages = new Set<string>();

const initPromise = i18n.use(initReactI18next).init({
  resources: {},
  lng: normalizeLanguage(navigator.language),
  fallbackLng: FALLBACK_LANGUAGE,
  interpolation: { escapeValue: false },
});

async function loadLanguage(language: AppLanguage) {
  if (loadedLanguages.has(language)) return;
  const [module, chat, voice] = await Promise.all([
    localeLoaders[language](),
    loadChatLocale(language),
    voiceLoaders[language](),
  ]);
  i18n.addResourceBundle(language, 'translation', module.default, true, true);
  i18n.addResourceBundle(language, 'translation', { chat }, true, true);
  i18n.addResourceBundle(language, 'translation', voice.default, true, true);
  loadedLanguages.add(language);
}

export async function ensureLocaleLoaded(language: string) {
  const normalized = normalizeLanguage(language);
  await initPromise;
  await Promise.all([loadLanguage(normalized), loadLanguage(FALLBACK_LANGUAGE)]);
  return normalized;
}

export async function changeAppLanguage(language: string) {
  const normalized = await ensureLocaleLoaded(language);
  if (i18n.language !== normalized) {
    await i18n.changeLanguage(normalized);
  }
  return normalized;
}

// Sync language changes back to settings store
i18n.on('languageChanged', (lng) => {
  const store = useSettingsStore.getState();
  if (store.language !== lng) {
    store.setLanguage(lng);
  }
});

export default i18n;
