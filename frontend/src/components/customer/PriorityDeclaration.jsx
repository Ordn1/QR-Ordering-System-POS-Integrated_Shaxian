import { ShieldCheck } from 'lucide-react';
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

  const isDiscountable = choice === 'senior' || choice === 'pwd';

  async function confirm() {
    setSaving(true);
    try {
      await declare(choice);
      onClose();
      if (isDiscountable) {
        toast.success(
          'Priority discount applied! Please have your physical ID ready for staff verification later.',
        );
      } else {
        toast.success(t('priority.saved'));
      }
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
        <div
          style={{
            marginTop: 'var(--space-4)',
            padding: 'var(--space-3)',
            border: '1px solid var(--color-border, #d6d3cd)',
            background: 'var(--color-surface-subtle, #f7f5f0)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--space-2)',
          }}
        >
          <ShieldCheck size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          <p style={{ margin: 0, fontSize: 'var(--text-sm)' }}>
            <strong>Staff ID Verification:</strong> No form needed on your phone. Please have your physical OSCA or PWD ID card ready—our staff will verify it later when serving your order or at the counter.
          </p>
        </div>
      ) : null}

      <p className="declaration-note">
        {choice === 'pregnant' ? t('priority.pregnantNote') : t('priority.discountNote')}
      </p>
    </Modal>
  );
}