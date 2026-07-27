import { Power } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';

import i18n from '../../lib/i18n';
import { useUiStore } from '../../store/uiStore';
import Button from './Button';

const LANGUAGES = [
  { value: 'en', label: 'EN' },
  { value: 'fil', label: 'FIL' },
  { value: 'bis', label: 'BIS' },
];

export default function Navbar({ links, identity, onSignOut }) {
  const { t } = useTranslation();
  const language = useUiStore((state) => state.language);
  const setLanguage = useUiStore((state) => state.setLanguage);

  return (
    <nav className="navbar">
      <span className="navbar-brand">
        <img className="navbar-logo" src="/logos/ShaxianIcon.png" alt="" />
        沙县 Shaxian
      </span>

      <div className="navbar-nav">
        {links.map((link) => (
          <NavLink key={link.to} to={link.to} className="navbar-btn" end={link.end}>
            {t(link.labelKey)}
          </NavLink>
        ))}
      </div>

      <div className="navbar-right">
        {LANGUAGES.map((option) => (
          <Button
            key={option.value}
            variant="lang"
            onClick={() => {
              setLanguage(option.value);
              i18n.changeLanguage(option.value);
            }}
            aria-pressed={language === option.value}
          >
            {option.label}
          </Button>
        ))}
        {identity ? <span className="navbar-identity">{identity}</span> : null}
        {onSignOut ? (
          <button
            type="button"
            className="icon-view-btn"
            aria-label={t('common.signOut')}
            onClick={onSignOut}
          >
            <Power size={20} strokeWidth={1.75} />
          </button>
        ) : null}
      </div>
    </nav>
  );
}
