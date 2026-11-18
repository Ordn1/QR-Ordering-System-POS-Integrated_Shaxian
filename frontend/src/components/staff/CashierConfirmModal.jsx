import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { peso, queueLabel } from '../../lib/format';
import Badge from '../shared/Badge';
import Button from '../shared/Button';
import Modal from '../shared/Modal';
import TextInput from '../shared/TextInput';

const EMPTY_CHECK = { id_last4: '', cardholder_name: '', issuing_lgu: '' };

function IdCheck({ claim, busy, onRecord }) {
  const { t } = useTranslation();
  const [check, setCheck] = useState(EMPTY_CHECK);
  const [error, setError] = useState(null);

  const update = (field) => (event) => {
    setError(null);
    setCheck((current) => ({ ...current, [field]: event.target.value }));
  };

  function verify() {
    const filled = {
      id_last4: check.id_last4.trim(),
      cardholder_name: check.cardholder_name.trim(),
      issuing_lgu: check.issuing_lgu.trim(),
    };
    if (!/^[0-9]{4}$/.test(filled.id_last4) || !filled.cardholder_name || !filled.issuing_lgu) {
      setError(t('staff.idMissing'));
      return;
    }
    onRecord(claim, { outcome: 'verified', ...filled });
  }

  return (
    <fieldset className="cash-id-check">
      <legend className="cash-id-legend">
        <span className="eyebrow">{t('staff.idCheckTitle')}</span>
        <Badge value={claim.declared_status} />
      </legend>

      <TextInput
        label={t('staff.idLast4')}
        required
        inputMode="numeric"
        inputClass="numeric"
        maxLength={4}
        value={check.id_last4}
        onChange={update('id_last4')}
        error={error}
      />
      <TextInput
        label={t('staff.idCardholder')}
        required
        inputClass="alpha"
        maxLength={80}
        value={check.cardholder_name}
        onChange={update('cardholder_name')}
      />
      <TextInput
        label={t('staff.idLgu')}
        required
        inputClass="alphanumeric"
        maxLength={50}
        value={check.issuing_lgu}
        onChange={update('issuing_lgu')}
      />

      <div className="cash-id-actions">
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => onRecord(claim, { outcome: 'rejected' })}
        >
          {t('staff.idRejected')}
        </Button>
        <Button variant="primary" loading={busy} onClick={verify}>
          {t('staff.idVerified')}
        </Button>
      </div>
    </fieldset>
  );
}

export default function CashierConfirmModal({ entry, busy, onConfirm, onVerify, onClose }) {
  const { t } = useTranslation();
  const pending = entry.pending_verifications ?? [];

  return (
    <Modal
      title={t('staff.cashTitle')}
      size="small"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" data-modal-cancel onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            loading={busy}
            disabled={pending.length > 0}
            onClick={() => onConfirm(entry)}
          >
            {t('staff.cashConfirm')}
          </Button>
        </>
      }
    >
      <p className="cash-queue numeric">{queueLabel(entry.queue_number)}</p>

      <div className="cash-meta">
        <Badge value={entry.declared_priority_status} />
        <span>{t('staff.tableNumber', { number: entry.table_number })}</span>
        <span>{t('staff.itemCount', { count: entry.item_count })}</span>
      </div>

      {pending.map((claim) => (
        <IdCheck
          key={claim.log_id}
          claim={claim}
          busy={busy}
          onRecord={(target, check) => onVerify(entry, target, check)}
        />
      ))}

      <dl className="detail-list cash-totals">
        <dt className="eyebrow">{t('checkout.gross')}</dt>
        <dd className="numeric">{peso(entry.gross_amount)}</dd>
        {Number(entry.discount_amount) > 0 ? (
          <>
            <dt className="eyebrow">{t('checkout.discount')}</dt>
            <dd className="numeric">−{peso(entry.discount_amount)}</dd>
          </>
        ) : (
          <>
            <dt className="eyebrow">{t('checkout.vat')}</dt>
            <dd className="numeric">{peso(entry.vat_amount)}</dd>
          </>
        )}
      </dl>

      <p className="cash-due-label eyebrow">{t('checkout.net')}</p>
      <p className="cash-due numeric">{peso(entry.net_amount)}</p>

      {pending.length > 0 ? <p className="cash-id-needed">{t('staff.idNeeded')}</p> : null}
    </Modal>
  );
}
