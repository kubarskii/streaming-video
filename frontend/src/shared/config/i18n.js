// i18n Configuration
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import enTranslations from '../../locales/en/translation.json';
import ruTranslations from '../../locales/ru/translation.json';

// Initialize i18n with automatic language detection
i18n
  .use(LanguageDetector) // Detect user language
  .use(initReactI18next) // Pass i18n instance to react-i18next
  .init({
    resources: {
      en: {
        translation: enTranslations
      },
      ru: {
        translation: ruTranslations
      }
    },
    fallbackLng: 'en', // Default language if detection fails
    supportedLngs: ['en', 'ru'], // Supported languages
    
    // Language detection configuration
    detection: {
      // Order of detection methods
      order: ['localStorage', 'navigator', 'htmlTag'],
      
      // Keys to lookup language from
      lookupLocalStorage: 'i18nextLng',
      
      // Cache user language preference
      caches: ['localStorage'],
      
      // Optional: exclude certain languages from detection
      excludeCacheFor: ['cimode'],
    },
    
    interpolation: {
      escapeValue: false // React already escapes values
    },
    
    // Load translations synchronously
    react: {
      useSuspense: false
    }
  });

export default i18n;

