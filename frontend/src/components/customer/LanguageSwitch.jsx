import { useTranslation } from 'react-i18next';

import { useSessionStore } from '../../store/sessionStore';
import { toast } from '../../store/toastStore';

const LANGUAGES = [
  { code: 'en', short: 'EN' },
  { code: 'fil', short: 'FIL' },
  { code: 'bis', short: 'BIS' },
];

export default function LanguageSwitch() {
  const { t, i18n } = useTranslation();
  const setLanguage = useSessionStore((state) => state.setLanguage);

  return (
    <div className="lang-toggle" role="group" aria-label={t('language.label')}>
      {LANGUAGES.map((lang, index) => (
        <span key={lang.code} className="lang-toggle-item">
          <button
            type="button"
            className={`lang-toggle-btn${i18n.language === lang.code ? ' lang-toggle-active' : ''}`}
            aria-pressed={i18n.language === lang.code}
            onClick={() => setLanguage(lang.code).catch((error) => toast.error(error.message))}
          >
            {lang.short}
          </button>
          {index < LANGUAGES.length - 1 ? (
            <span className="lang-toggle-sep" aria-hidden="true">|</span>
          ) : null}
        </span>
      ))}
    </div>
  );
}
