import { Camera, CheckCircle2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { scanPriorityId } from '../../api/sessions';
import { useSessionStore } from '../../store/sessionStore';
import { toast } from '../../store/toastStore';
import Button from '../shared/Button';
import Modal from '../shared/Modal';
import TextInput from '../shared/TextInput';

const OPTIONS = ['standard', 'senior', 'pwd', 'pregnant'];

function compressImageToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected photo.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => resolve(reader.result);
      img.onload = () => {
        const maxDim = 1280;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function PriorityDeclaration({ onClose }) {
  const { t } = useTranslation();
  const session = useSessionStore((state) => state.session);
  const declare = useSessionStore((state) => state.declare);
  const fileInputRef = useRef(null);

  const [choice, setChoice] = useState(session.declared_priority_status);
  const [idLast4, setIdLast4] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [issuingLgu, setIssuingLgu] = useState('Davao City');
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const needsIdDetails = choice === 'senior' || choice === 'pwd';

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    setScanning(true);
    setErrors({});
    try {
      const base64 = await compressImageToBase64(file);
      const result = await scanPriorityId(session.session_id, choice, base64);
      if (result.detected_status === 'senior' || result.detected_status === 'pwd') {
        setChoice(result.detected_status);
      }
      setIdLast4(result.id_last4 || '');
      setCardholderName(result.cardholder_name || '');
      setIssuingLgu(result.issuing_lgu || 'Davao City');
      setScanNote(result.confidence_note || 'ID scanned. Tap Save to apply your discount.');
      setShowManual(true);
      toast.success('ID card scanned and details filled automatically.');
    } catch (error) {
      setShowManual(true);
      toast.error(error.message);
    } finally {
      setScanning(false);
    }
  }

  async function confirm() {
    if (needsIdDetails) {
      const nextErrors = {};
      if (!/^[0-9]{4}$/.test(idLast4.trim())) {
        nextErrors.idLast4 = 'Scan your ID card above or enter the last 4 digits.';
      }
      if (cardholderName.trim().length < 2) {
        nextErrors.cardholderName = 'Scan your ID card above or enter the cardholder name.';
      }
      if (issuingLgu.trim().length < 2) {
        nextErrors.issuingLgu = 'Enter the issuing city or municipality.';
      }
      if (Object.keys(nextErrors).length > 0) {
        setShowManual(true);
        setErrors(nextErrors);
        return;
      }
    }

    setErrors({});
    setSaving(true);
    try {
      await declare(
        choice,
        needsIdDetails
          ? {
            id_last4: idLast4.trim(),
            cardholder_name: cardholderName.trim(),
            issuing_lgu: issuingLgu.trim(),
          }
          : {},
      );
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
          <Button variant="primary" loading={saving} disabled={scanning} onClick={confirm}>
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
              onChange={() => {
                setChoice(option);
                setErrors({});
              }}
            />
            {t(`priority.${option}`)}
          </label>
        ))}
      </div>

      {needsIdDetails ? (
        <div className="stack-3" style={{ marginTop: 'var(--space-4)' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          <Button
            variant="secondary"
            loading={scanning}
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera size={18} />
            {idLast4 ? 'Rescan Senior / PWD ID Card' : 'Take Photo of Senior / PWD ID Card'}
          </Button>

          {scanNote ? (
            <p
              className="declaration-note"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                color: 'var(--color-jade, #1f7a4c)',
                fontWeight: 600,
              }}
            >
              <CheckCircle2 size={16} />
              <span>{scanNote}</span>
            </p>
          ) : null}

          {!showManual && !idLast4 ? (
            <button
              type="button"
              className="link-button"
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                textAlign: 'left',
                textDecoration: 'underline',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
              }}
              onClick={() => setShowManual(true)}
            >
              Or type ID details manually instead
            </button>
          ) : null}

          {showManual || idLast4 ? (
            <div className="stack-3">
              <TextInput
                label="Last 4 digits of OSCA / PWD ID"
                required
                inputClass="numeric"
                inputMode="numeric"
                maxLength={4}
                hint="e.g. 4821"
                value={idLast4}
                error={errors.idLast4}
                onChange={(event) => setIdLast4(event.target.value)}
              />
              <TextInput
                label="Cardholder full name"
                required
                inputClass="alpha"
                maxLength={80}
                hint="Name printed on ID card"
                value={cardholderName}
                error={errors.cardholderName}
                onChange={(event) => setCardholderName(event.target.value)}
              />
              <TextInput
                label="Issuing LGU (City / Municipality)"
                required
                inputClass="alpha"
                maxLength={50}
                hint="e.g. Davao City"
                value={issuingLgu}
                error={errors.issuingLgu}
                onChange={(event) => setIssuingLgu(event.target.value)}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <p className="declaration-note">
        {choice === 'pregnant' ? t('priority.pregnantNote') : t('priority.discountNote')}
      </p>
    </Modal>
  );
}