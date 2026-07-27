import { useTranslation } from 'react-i18next';

import { useSessionStore } from '../../store/sessionStore';
import { toast } from '../../store/toastStore';

const LANGUAGES = ['en', 'fil', 'bis'];

export default function LanguageSwitch() {
  const { t, i18n } = useTranslation();
  const setLanguage = useSessionStore((state) => state.setLanguage);

  return (
    <div className="language-switch" role="group" aria-label={t('language.label')}>
      {LANGUAGES.map((code) => (
        <button
          key={code}
          type="button"
          className="lang-btn"
          aria-pressed={i18n.language === code}
          onClick={() => setLanguage(code).catch((error) => toast.error(error.message))}
        >
          {t(`language.${code}`)}
        </button>
      ))}
    </div>
  );
}
