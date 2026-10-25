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
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [saving, setSaving] = useState(false);

  const isDiscountable = choice === 'senior' || choice === 'pwd';

  async function confirm() {
    setSaving(true);
    try {
      await declare(choice);
      onClose();
      if (isDiscountable) {
        toast.success(
          'Priority discount applied. Please have your physical ID ready for staff verification later.',
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
            border: '1px solid var(--border, #d6d3cd)',
            background: 'var(--surface, #f7f5f0)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--space-2)',
          }}
        >
          <ShieldCheck size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          <p style={{ margin: 0, fontSize: 'var(--font-sm)' }}>
            {t('priority.idVerificationReminder', {
              defaultValue:
                'Your 20% discount + VAT exemption is applied automatically. Staff will verify your physical OSCA/PWD ID when serving or settling.',
            })}
          </p>
        </div>
      ) : null}

      <p className="declaration-note">
        {choice === 'pregnant' ? t('priority.pregnantNote') : t('priority.discountNote')}
      </p>

      <div style={{ marginTop: 'var(--space-3)' }}>
        <Button
          variant="ghost"
          onClick={() => setShowPrivacy((prev) => !prev)}
        >
          {showPrivacy
            ? t('priority.hidePrivacyNotice', { defaultValue: 'Hide Data Privacy Notice (RA 10173)' })
            : t('priority.showPrivacyNotice', { defaultValue: 'View Data Privacy Notice (RA 10173)' })}
        </Button>

        {showPrivacy ? (
          <div
            className="stack-2"
            style={{
              marginTop: 'var(--space-2)',
              padding: 'var(--space-3)',
              border: '1px solid var(--border, #d6d3cd)',
              background: 'var(--surface, #fafafa)',
              fontSize: 'var(--font-sm)',
            }}
          >
            <strong>
              {t('priority.privacyHeading', {
                defaultValue: 'Data Privacy Act of 2012 (Republic Act No. 10173)',
              })}
            </strong>
            <p>
              {t('priority.privacyBody1', {
                defaultValue:
                  'This system operates without cameras, facial recognition, or biometric tracking. Priority status is voluntary and self-declared.',
              })}
            </p>
            <p>
              {t('priority.privacyBody2', {
                defaultValue:
                  'When a Senior Citizen (RA 9994) or PWD (RA 10754) discount is verified by staff, the restaurant records your ID number, cardholder name, and issuing LGU strictly for BIR statutory tax-audit compliance.',
              })}
            </p>
            <p>
              {t('priority.privacyBody3', {
                defaultValue:
                  'ID numbers and names are masked on staff screens by default and retained only for the statutory audit period.',
              })}
            </p>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}