import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import bis from '../locales/bis.json';
import en from '../locales/en.json';
import fil from '../locales/fil.json';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fil: { translation: fil },
    bis: { translation: bis },
  },
  lng: 'en',
  fallbackLng: false,
  interpolation: { escapeValue: false },
});

export default i18n;
