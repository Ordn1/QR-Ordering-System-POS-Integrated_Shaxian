import { CheckCircle2, Printer, RefreshCw, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { transmit } from '../../api/pos';
import { settlePayment } from '../../api/queue';
import { peso, queueLabel } from '../../lib/format';
import { toCentavos } from '../../lib/registerCodes';
import { claimLabel } from '../../lib/shareLabel';
import { tenderReady } from '../../lib/tender';
import { toast } from '../../store/toastStore';
import RegisterReceipt from '../admin/RegisterReceipt';
import Badge from '../shared/Badge';
import Button from '../shared/Button';
import Modal from '../shared/Modal';
import TextInput from '../shared/TextInput';
import RegisterCodeList from './RegisterCodeList';
import TenderPicker from './TenderPicker';

const LAST4_PARTIAL = /^[0-9]{1,3}$/;

const BLANK_CHECK = {
  discount_eligible: true,
  id_last4: '',
  cardholder_name: '',
  issuing_lgu: '',
};

function checkPayload(claim, check) {
  const kept = (value) => (check.discount_eligible && value.trim() !== '' ? value.trim() : null);
  return {
    log_id: claim.log_id,
    discount_eligible: check.discount_eligible,
    id_last4: kept(check.id_last4),
    cardholder_name: kept(check.cardholder_name),
    issuing_lgu: kept(check.issuing_lgu),
  };
}

function IdCheck({ claim, check, onChange }) {
  const { t } = useTranslation();
  const set = (key) => (event) => onChange({ ...check, [key]: event.target.value });

  return (
    <fieldset className="cash-id-check">
      <legend className="cash-id-legend">
        <span className="eyebrow">{t('staff.idCheckTitle')}</span>
        <span className="cash-id-person">{claimLabel(claim, t)}</span>
        <Badge value={claim.declared_status} />
      </legend>

      <p className="cash-id-prompt">{t('staff.idLookPrompt')}</p>

      <label className="switch-field">
        <input
          type="checkbox"
          role="switch"
          checked={check.discount_eligible}
          onChange={(event) => onChange({ ...check, discount_eligible: event.target.checked })}
        />
        <span>
          {check.discount_eligible
            ? t('staff.idDiscountEligible')
            : t('staff.idNotEligible', { amount: peso(claim.delta_if_invalid) })}
        </span>
      </label>

      {check.discount_eligible ? (
        <div className="cash-id-fields">
          <TextInput
            label={t('staff.idLast4')}
            inputClass="numeric"
            inputMode="numeric"
            maxLength={4}
            value={check.id_last4}
            error={LAST4_PARTIAL.test(check.id_last4) ? t('staff.idLast4Error') : null}
            onChange={set('id_last4')}
          />
          <TextInput
            label={t('staff.idCardholder')}
            inputClass="alpha"
            maxLength={80}
            value={check.cardholder_name}
            onChange={set('cardholder_name')}
          />
          <TextInput
            label={t('staff.idLgu')}
            inputClass="alpha"
            maxLength={50}
            hint="Davao City"
            value={check.issuing_lgu}
            onChange={set('issuing_lgu')}
          />
          <p className="cash-id-optional">{t('staff.idOptional')}</p>
        </div>
      ) : null}
    </fieldset>
  );
}

export default function CashierConfirmModal({ entry, showBarcodes = false, onSettled, onClose }) {
  const { t } = useTranslation();
  const claims = entry.pending_verifications ?? [];
  const [checks, setChecks] = useState(() =>
    Object.fromEntries(claims.map((claim) => [claim.log_id, BLANK_CHECK])),
  );
  const [tender, setTender] = useState('cash');
  const [cash, setCash] = useState(null);
  const [busy, setBusy] = useState(false);
  const [settled, setSettled] = useState(null);
  const [resending, setResending] = useState(false);

  const owing = Number(entry.unpaid_amount) > 0 ? entry.unpaid_amount : entry.net_amount;
  const due =
    claims.reduce(
      (total, claim) =>
        total +
        toCentavos(
          checks[claim.log_id].discount_eligible ? claim.delta_if_valid : claim.delta_if_invalid,
        ),
      toCentavos(owing),
    ) / 100;
  const cashValue = cash ?? due.toFixed(2);
  const claimDevices = new Map(
    claims.map((claim) => [claim.device_id, checks[claim.log_id].discount_eligible]),
  );
  const isDiscounted = (item) => claimDevices.get(item.device_id) ?? item.is_discounted;
  const detailsValid = claims.every((claim) => !LAST4_PARTIAL.test(checks[claim.log_id].id_last4));
  const ready = detailsValid && tenderReady(tender, cashValue, due);

  async function settle() {
    setBusy(true);
    try {
      const result = await settlePayment(entry.txn_id, {
        tender,
        cash_tendered: tender === 'cash' ? Number(cashValue).toFixed(2) : null,
        checks: claims.map((claim) => checkPayload(claim, checks[claim.log_id])),
      });
      setSettled(result);
      toast.success(t('staff.markedPaid', { queue: queueLabel(entry.queue_number) }));
      onSettled?.(result);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setResending(true);
    try {
      const transmission = await transmit(entry.txn_id);
      setSettled((current) => ({ ...current, transmission }));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setResending(false);
    }
  }

  if (settled) {
    const acknowledged = settled.transmission?.status === 'acknowledged';
    return (
      <Modal
        title={t('staff.settledTitle', { queue: queueLabel(entry.queue_number) })}
        size="small"
        onClose={onClose}
        footer={
          <>
            <Button variant="secondary" icon={Printer} onClick={() => window.print()}>
              {t('staff.printSlip')}
            </Button>
            <Button variant="primary" data-modal-cancel="true" onClick={onClose}>
              {t('common.done')}
            </Button>
          </>
        }
      >
        <div className={`cash-ack${acknowledged ? '' : ' cash-ack-failed'}`} role="status">
          {acknowledged ? <CheckCircle2 size={18} /> : <TriangleAlert size={18} />}
          <span>{t(acknowledged ? 'staff.slipAcknowledged' : 'staff.slipFailed')}</span>
          {acknowledged ? null : (
            <Button variant="secondary" icon={RefreshCw} loading={resending} onClick={resend}>
              {t('staff.slipRetry')}
            </Button>
          )}
        </div>
        <RegisterReceipt transmission={settled.transmission} showBarcodes={showBarcodes} />
      </Modal>
    );
  }

  return (
    <Modal
      title={t('staff.settleTitle', { queue: queueLabel(entry.queue_number) })}
      size="small"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" data-modal-cancel="true" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" loading={busy} disabled={!ready} onClick={settle}>
            {t('staff.settleConfirm', { amount: peso(due), tender: t(`pos.tender_${tender}`) })}
          </Button>
        </>
      }
    >
      <div className="cash-meta">
        <Badge value={entry.declared_priority_status} />
        <span>{t('staff.tableNumber', { number: entry.table_number })}</span>
        <span>{t('staff.itemCount', { count: entry.item_count })}</span>
      </div>

      <p className="eyebrow">{t('staff.keyIntoColumbia')}</p>
      <RegisterCodeList
        items={entry.items ?? []}
        isDiscounted={isDiscounted}
        showBarcodes={showBarcodes}
      />

      {claims.map((claim) => (
        <IdCheck
          key={claim.log_id}
          claim={claim}
          check={checks[claim.log_id]}
          onChange={(next) => setChecks((current) => ({ ...current, [claim.log_id]: next }))}
        />
      ))}

      <p className="cash-due-label eyebrow">{t('checkout.net')}</p>
      <p className="cash-due numeric">{peso(due)}</p>

      <TenderPicker
        due={due}
        tender={tender}
        cash={cashValue}
        onTenderChange={setTender}
        onCashChange={setCash}
      />
    </Modal>
  );
}
