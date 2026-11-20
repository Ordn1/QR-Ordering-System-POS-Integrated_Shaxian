import { useTranslation } from 'react-i18next';

import { useSessionStore } from '../../store/sessionStore';
import { toast } from '../../store/toastStore';
import { MENU_SIZES, useUiStore } from '../../store/uiStore';
import Button from '../shared/Button';
import Modal from '../shared/Modal';

export default function DisplaySheet({ onClose }) {
  const { t } = useTranslation();
  const display = useUiStore((state) => state.display);
  const setDisplay = useSessionStore((state) => state.setDisplay);

  function change(changes) {
    setDisplay(changes, 'button').catch((error) => toast.error(error.message));
  }

  return (
    <Modal
      sheet
      title={t('display.title')}
      onClose={onClose}
      footer={
        <Button variant="primary" onClick={onClose}>
          {t('display.done')}
        </Button>
      }
    >
      <fieldset className="display-sizes">
        <legend className="display-legend">{t('display.size')}</legend>
        <div className="display-size-options">
          {MENU_SIZES.map((size) => (
            <label key={size} className="display-size-option">
              <input
                type="radio"
                name="menu-size"
                value={size}
                checked={display.menuSize === size}
                onChange={() => change({ menuSize: size })}
              />
              <span className={`display-size-sample display-size-sample-${size}`} aria-hidden="true">
                Aa
              </span>
              <span className="display-size-name">{t(`display.sizes.${size}`)}</span>
            </label>
          ))}
        </div>
        <p className="display-hint">{t('display.pinchHint')}</p>
      </fieldset>

      <div className="display-toggles">
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={display.highContrast}
            onChange={(event) => change({ highContrast: event.target.checked })}
          />
          <span>
            {t('display.contrast')}
            <span className="display-hint">{t('display.contrastHint')}</span>
          </span>
        </label>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={display.steadyTaps}
            onChange={(event) => change({ steadyTaps: event.target.checked })}
          />
          <span>
            {t('display.steadyTaps')}
            <span className="display-hint">{t('display.steadyTapsHint')}</span>
          </span>
        </label>
      </div>
    </Modal>
  );
}
