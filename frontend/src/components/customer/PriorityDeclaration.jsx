import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useSessionStore } from '../../store/sessionStore';
import { toast } from '../../store/toastStore';
import Button from '../shared/Button';
import Modal from '../shared/Modal';

const OPTIONS = ['standard', 'senior', 'pwd', 'pregnant'];

export default function PriorityDeclaration({ onClose }) {
  const { t } = useTranslation();
  const session = useSessionStore((state) => state.session);
  const declare = useSessionStore((state) => state.declare);
  const [choice, setChoice] = useState(session.declared_priority_status);
  const [saving, setSaving] = useState(false);

  async function confirm() {
    setSaving(true);
    try {
      await declare(choice);
      onClose();
      toast.success(t('priority.saved'));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={t('priority.title')}
      size="small"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" data-modal-cancel="true" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" loading={saving} onClick={confirm}>
            {t('priority.save')}
          </Button>
        </>
      }
    >
      <p className="declaration-prompt">{t('priority.prompt')}</p>
      <div className="stack-4">
        {OPTIONS.map((option) => (
          <label className="radio-field" key={option}>
            <input
              type="radio"
              name="priority"
              value={option}
              checked={choice === option}
              onChange={() => setChoice(option)}
            />
            {t(`priority.${option}`)}
          </label>
        ))}
      </div>
      <p className="declaration-note">
        {choice === 'pregnant' ? t('priority.pregnantNote') : t('priority.discountNote')}
      </p>
    </Modal>
  );
}
