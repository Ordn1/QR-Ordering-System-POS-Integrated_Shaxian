import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useSessionStore } from '../../store/sessionStore';
import { toast } from '../../store/toastStore';
import Button from '../shared/Button';
import Modal from '../shared/Modal';

const OPTIONS = ['standard', 'senior', 'pwd', 'pregnant'];

const SAVED_TOAST = {
  standard: 'priority.savedNone',
  senior: 'priority.savedDiscount',
  pwd: 'priority.savedDiscount',
  pregnant: 'priority.saved',
};

export default function PriorityDeclaration({ onClose }) {
  const { t } = useTranslation();
  const session = useSessionStore((state) => state.session);
  const declare = useSessionStore((state) => state.declare);
  const [choice, setChoice] = useState(session.declared_priority_status);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [saving, setSaving] = useState(false);

  const isDiscountable = choice === 'senior' || choice === 'pwd';

  async function confirm() {
    setSaving(true);
    try {
      await declare(choice);
      onClose();
      toast.success(t(SAVED_TOAST[choice]));
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

      {isDiscountable ? (
        <div className="declaration-id-note">
          <ShieldCheck size={18} strokeWidth={1.75} aria-hidden="true" />
          <p>{t('priority.idVerificationReminder')}</p>
        </div>
      ) : null}

      <p className="declaration-note">
        {choice === 'pregnant' ? t('priority.pregnantNote') : t('priority.discountNote')}
      </p>

      <div className="declaration-privacy">
        <Button variant="ghost" onClick={() => setShowPrivacy((prev) => !prev)}>
          {showPrivacy ? t('priority.hidePrivacyNotice') : t('priority.showPrivacyNotice')}
        </Button>

        {showPrivacy ? (
          <div className="declaration-privacy-body stack-2">
            <strong>{t('priority.privacyHeading')}</strong>
            <p>{t('priority.privacyBody1')}</p>
            <p>{t('priority.privacyBody2')}</p>
            <p>{t('priority.privacyBody3')}</p>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
