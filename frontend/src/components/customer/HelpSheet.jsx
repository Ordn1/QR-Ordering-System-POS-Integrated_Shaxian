import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import Button from '../shared/Button';
import Modal from '../shared/Modal';

export default function HelpSheet({ actions, onClose }) {
  const { t } = useTranslation();

  return (
    <Modal
      sheet
      title={t('help.title')}
      onClose={onClose}
      footer={
        <Button variant="secondary" data-modal-cancel="true" onClick={onClose}>
          {t('help.close')}
        </Button>
      }
    >
      <ul className="help-actions">
        {actions.map(({ key, icon: Icon, title, body, onSelect, disabled }) => (
          <li key={key}>
            <button
              type="button"
              className="help-action"
              disabled={disabled}
              onClick={() => {
                onClose();
                onSelect();
              }}
            >
              <Icon className="help-action-icon" size={24} strokeWidth={1.75} aria-hidden="true" />
              <span className="help-action-text">
                <span className="help-action-title">{title}</span>
                <span className="help-action-body">{body}</span>
              </span>
              <ChevronRight size={20} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
