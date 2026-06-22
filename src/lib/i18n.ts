import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import fr from '../locales/fr.json';
import en from '../locales/en.json';
import ar from '../locales/ar.json';

const savedLang = typeof window !== 'undefined' ? localStorage.getItem('pg_language') : null;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
      ar: { translation: ar },
    },
    lng: savedLang || 'fr',
    fallbackLng: 'fr',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'pg_language',
      caches: ['localStorage'],
    },
  });

if (savedLang) {
  const dir = savedLang.startsWith('ar') ? 'rtl' : 'ltr';
  document.documentElement.dir = dir;
}

export default i18n;
