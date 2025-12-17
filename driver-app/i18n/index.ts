import * as Localization from 'expo-localization';
import en from './en.json';

type TranslationKeys = typeof en;
type NestedKeyOf<ObjectType extends object> = {
  [Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
    ? `${Key}.${NestedKeyOf<ObjectType[Key]>}`
    : `${Key}`;
}[keyof ObjectType & (string | number)];

type TranslationKey = NestedKeyOf<TranslationKeys>;

// Supported languages
const translations: { [key: string]: typeof en } = {
  en,
  // Add more languages here:
  // es: require('./es.json'),
  // fr: require('./fr.json'),
};

// Get device language
const getDeviceLanguage = (): string => {
  const locale = Localization.getLocales()[0];
  const languageCode = locale?.languageCode || 'en';
  
  // Check if we support this language, otherwise fall back to English
  return translations[languageCode] ? languageCode : 'en';
};

// Current language state
let currentLanguage = getDeviceLanguage();

// Get translation for a key
export const t = (key: TranslationKey, params?: { [key: string]: string | number }): string => {
  const keys = key.split('.');
  let translation: any = translations[currentLanguage];

  // Navigate through nested keys
  for (const k of keys) {
    if (translation && typeof translation === 'object' && k in translation) {
      translation = translation[k];
    } else {
      console.warn(`Translation missing for key: ${key}`);
      return key;
    }
  }

  // If we have a final translation string
  if (typeof translation === 'string') {
    // Replace placeholders like {{count}}, {{name}}, etc.
    if (params) {
      return Object.entries(params).reduce((str, [paramKey, value]) => {
        return str.replace(new RegExp(`{{${paramKey}}}`, 'g'), String(value));
      }, translation);
    }
    return translation;
  }

  console.warn(`Translation for key ${key} is not a string`);
  return key;
};

// Change language
export const setLanguage = (lang: string) => {
  if (translations[lang]) {
    currentLanguage = lang;
  } else {
    console.warn(`Language ${lang} not supported`);
  }
};

// Get current language
export const getCurrentLanguage = (): string => currentLanguage;

// Get all available languages
export const getAvailableLanguages = (): string[] => Object.keys(translations);

// Pluralization helper
export const plural = (
  key: TranslationKey,
  count: number,
  params?: { [key: string]: string | number }
): string => {
  const pluralKey = count === 1 ? `${key}_one` : `${key}_other`;
  return t(pluralKey as TranslationKey, { ...params, count });
};

// Export everything
export default {
  t,
  setLanguage,
  getCurrentLanguage,
  getAvailableLanguages,
  plural,
};

