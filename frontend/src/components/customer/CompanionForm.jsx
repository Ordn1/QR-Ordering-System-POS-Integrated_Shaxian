import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useCartStore } from '../../store/cartStore';
import { useSessionStore } from '../../store/sessionStore';
import { toast } from '../../store/toastStore';
import Button from '../shared/Button';
import Modal from '../shared/Modal';
import TextInput from '../shared/TextInput';

const STATUSES = ['senior', 'pwd'];

export default function CompanionForm({ onClose }) {
  const { t } = useTranslation();
  const addCompanion = useSessionStore((state) => state.addCompanion);
  const setOrderingFor = useCartStore((state) => state.setOrderingFor);
  const [name, setName] = useState('');
  const [status, setStatus] = useState('senior');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function save() {
    if (!name.trim()) {
      setError(t('people.nameRequired'));
      return;
    }
    setSaving(true);
    try {
      const session = await addCompanion(name.trim(), status);
      const added = session.companions[session.companions.length - 1];
      setOrderingFor(added.device_id);
      toast.success(t('people.added', { name: added.display_name }));
      onClose();
    } catch (failure) {
      toast.error(failure.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={t('people.addTitle')}
      size="small"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" data-modal-cancel="true" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" loading={saving} onClick={save}>
            {t('people.addConfirm')}
          </Button>
        </>
      }
    >
      <p className="declaration-prompt">{t('people.addPrompt')}</p>
      <div className="stack-4">
        <TextInput
          label={t('people.nameLabel')}
          required
          maxLength={30}
          inputClass="alphanumeric"
          hint={t('people.nameHint')}
          value={name}
          error={error}
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
        />
        <fieldset className="stack-2 people-status">
          <legend className="display-legend">{t('people.statusLabel')}</legend>
          {STATUSES.map((option) => (
            <label className="radio-field" key={option}>
              <input
                type="radio"
                name="companion-status"
                value={option}
                checked={status === option}
                onChange={() => setStatus(option)}
              />
              {t(`priority.${option}`)}
            </label>
          ))}
        </fieldset>
      </div>
      <div className="declaration-id-note">
        <ShieldCheck size={18} strokeWidth={1.75} aria-hidden="true" />
        <p>{t('people.idNote')}</p>
      </div>
    </Modal>
  );
}
