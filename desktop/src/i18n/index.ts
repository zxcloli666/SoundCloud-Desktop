import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { useSettingsStore } from '../stores/settings';

const FALLBACK_LANGUAGE = 'en';
const localeLoaders = {
  en: () => import('./locales/en.json'),
  ru: () => import('./locales/ru.json'),
  tr: () => import('./locales/tr.json'),
} as const;

type AppLanguage = keyof typeof localeLoaders;

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

export async function ensureLocaleLoaded(language: string) {
  const normalized = normalizeLanguage(language);
  await initPromise;

  if (loadedLanguages.has(normalized)) {
    return normalized;
  }

  const module = await localeLoaders[normalized]();
  i18n.addResourceBundle(normalized, 'translation', module.default, true, true);
  loadedLanguages.add(normalized);
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
