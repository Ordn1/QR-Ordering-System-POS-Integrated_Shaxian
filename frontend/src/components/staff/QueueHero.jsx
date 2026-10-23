import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ban, ChefHat, Clock, CheckCircle2, CreditCard, ShieldCheck } from 'lucide-react';

import * as queueApi from '../../api/queue';
import { voidTransaction } from '../../api/transactions';
import { peso, queueLabel } from '../../lib/format';
import { toast } from '../../store/toastStore';
import Badge from '../shared/Badge';
import Button from '../shared/Button';
import Modal from '../shared/Modal';
import TextInput from '../shared/TextInput';

const NEXT = { pending: 'preparing', preparing: 'ready', ready: 'completed' };
const ACTION_KEY = {
  pending: 'staff.startPreparing',
  preparing: 'staff.markReady',
  ready: 'staff.markCompleted',
};

function elapsed(since, now) {
  const seconds = Math.max(0, Math.floor(((now || Date.now()) - new Date(since).getTime()) / 1000));
  const pad = (v) => String(v).padStart(2, '0');
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`;
}

function elapsedMinutes(since, now) {
  const mins = Math.max(0, Math.floor(((now || Date.now()) - new Date(since).getTime()) / 60000));
  return mins;
}

export default function QueueHero({ entry, busy, onAdvance, onConfirmPayment }) {
  const { t } = useTranslation();
  const since = entry?.prep_started_at ?? entry?.entered_queue_at;
  const [now, setNow] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const [idLast4, setIdLast4] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [issuingLgu, setIssuingLgu] = useState('Davao City');
  const [errors, setErrors] = useState({});
  const [savingVerif, setSavingVerif] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [localVerified, setLocalVerified] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [voidReason, setVoidReason] = useState('Customer cancelled before preparation.');
  const [voidBusy, setVoidBusy] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setLocalVerified(Boolean(entry?.id_verified));
    setIdLast4(entry?.id_last4 || '');
    setCardholderName(entry?.cardholder_name || '');
    setIssuingLgu(entry?.issuing_lgu || 'Davao City');
    setErrors({});
  }, [entry?.txn_id, entry?.id_verified, entry?.id_last4, entry?.cardholder_name, entry?.issuing_lgu]);

  const clock = since ? elapsed(since, now) : '00:00:00';
  const mins = since ? elapsedMinutes(since, now) : 0;
  const isLate = mins >= 10;

  if (!entry) {
    return (
      <section className="queue-hero queue-hero-idle">
        <span className="queue-hero-idle-icon" aria-hidden="true">
          <ChefHat size={40} />
        </span>
        <p className="queue-hero-idle-title">{t('staff.nowPreparing')}</p>
        <p className="queue-hero-idle-text">{t('staff.queueEmpty')}</p>
      </section>
    );
  }

  const awaitingCash =
    entry.payment_status === 'pending' ||
    (entry.payment_method === 'cashier' && entry.payment_status !== 'paid');

  const needsIdCheck =
    entry.declared_priority_status === 'senior' ||
    entry.declared_priority_status === 'pwd';

  const statusStage = entry.status === 'preparing'
    ? t('staff.nowPreparing')
    : entry.status === 'ready'
      ? t('staff.stageReady')
      : t('staff.upNext');

  async function submitVerification() {
    const nextErrors = {};
    if (!/^[0-9]{4}$/.test(idLast4.trim())) {
      nextErrors.idLast4 = 'Enter the last 4 digits of the presented ID.';
    }
    if (cardholderName.trim().length < 2) {
      nextErrors.cardholderName = 'Enter the cardholder name from the ID.';
    }
    if (issuingLgu.trim().length < 2) {
      nextErrors.issuingLgu = 'Enter the issuing city or municipality.';
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setSavingVerif(true);
    try {
      await queueApi.verifyPriorityId(entry.txn_id, {
        id_last4: idLast4.trim(),
        cardholder_name: cardholderName.trim(),
        issuing_lgu: issuingLgu.trim(),
      });
      setLocalVerified(true);
      setVerifying(false);
      toast.success(`Verified ${entry.declared_priority_status.toUpperCase()} ID for ${queueLabel(entry.queue_number)}.`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSavingVerif(false);
    }
  }

  async function handleRevokeDiscount() {
    setRevoking(true);
    try {
      await queueApi.revokePriorityDiscount(entry.txn_id);
      setVerifying(false);
      toast.success(`Reverted ${queueLabel(entry.queue_number)} to standard price (no valid ID presented).`);
      window.location.reload();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setRevoking(false);
    }
  }

  async function handleVoidOrder() {
    if (!voidReason.trim()) {
      toast.error('Please enter a reason for voiding this order.');
      return;
    }
    setVoidBusy(true);
    try {
      await voidTransaction(entry.txn_id, voidReason.trim());
      setVoiding(false);
      toast.success(`Voided ${queueLabel(entry.queue_number)}.`);
      window.location.reload();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setVoidBusy(false);
    }
  }

  return (
    <section className="queue-hero">
      <div className="queue-hero-eyebrow">
        <span className="queue-hero-stage-label">{statusStage}</span>
        {isLate && (
          <span className="queue-hero-late-badge">⚠ Late</span>
        )}
      </div>

      <p className="queue-hero-number numeric">{queueLabel(entry.queue_number)}</p>

      <div className="queue-hero-meta">
        <Badge value={entry.declared_priority_status} />
        {needsIdCheck ? (
          <Badge
            value={localVerified ? 'available' : 'pending'}
            label={localVerified ? 'ID Verified' : 'ID Unverified'}
          />
        ) : null}
        <span className="queue-hero-chip">🪑 {t('staff.tableNumber', { number: entry.table_number })}</span>
        <span className="queue-hero-chip">🍽 {t('staff.itemCount', { count: entry.item_count })}</span>
        {entry.payment_method && (
          <span className="queue-hero-chip">
            <CreditCard size={12} />
            {entry.payment_method === 'cashier' ? 'Pay at counter' : 'Online'}
          </span>
        )}
      </div>

      <div className={`queue-hero-timer-block${isLate ? ' queue-hero-timer-block--late' : ''}`}>
        <span className="queue-hero-timer-label-text">
          <Clock size={13} />
          {entry.prep_started_at ? t('staff.cookingFor') : t('staff.waitingFor')}
        </span>
        <p className="queue-hero-timer numeric">{clock}</p>
      </div>

      {entry.items && entry.items.length > 0 && (
        <ul className="queue-hero-items">
          {entry.items.map((item, idx) => (
            <li key={idx} className="queue-hero-item-row">
              <span className="queue-hero-item-qty">{item.qty}×</span>
              <span className="queue-hero-item-name">{typeof item.name === 'object' ? item.name?.en ?? Object.values(item.name)[0] : item.name}</span>
              <span className="queue-hero-item-price numeric">{peso(item.unit_price * item.qty)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="queue-hero-total">
        <span>Total</span>
        <span className="numeric">{peso(entry.net_amount)}</span>
      </div>

      <div className="queue-hero-actions">
        <Button variant="primary" loading={busy} onClick={() => onAdvance(entry, NEXT[entry.status])}>
          {entry.status === 'ready' ? <CheckCircle2 size={16} /> : <ChefHat size={16} />}
          {t(ACTION_KEY[entry.status])}
        </Button>
        {awaitingCash ? (
          <Button variant="secondary" loading={busy} onClick={() => onConfirmPayment(entry)}>
            {t('staff.confirmCash')}
          </Button>
        ) : null}
        {needsIdCheck ? (
          <Button variant="secondary" onClick={() => setVerifying(true)}>
            <ShieldCheck size={16} />
            {localVerified ? 'Update Verified ID' : 'Verify Senior / PWD ID'}
          </Button>
        ) : null}
        {entry.status === 'pending' ? (
          <Button variant="ghost" onClick={() => setVoiding(true)}>
            <Ban size={16} />
            Void Order
          </Button>
        ) : null}
      </div>

      {verifying ? (
        <Modal
          title={`Verify ${entry.declared_priority_status.toUpperCase()} ID · ${queueLabel(entry.queue_number)}`}
          size="small"
          onClose={() => setVerifying(false)}
          footer={
            <>
              <Button variant="secondary" data-modal-cancel="true" onClick={() => setVerifying(false)}>
                {t('common.cancel')}
              </Button>
              <Button variant="secondary" loading={revoking} onClick={handleRevokeDiscount}>
                No Valid ID — Revert Price
              </Button>
              <Button variant="primary" loading={savingVerif} onClick={submitVerification}>
                Save Verification
              </Button>
            </>
          }
        >
          <div className="stack-3">
            <TextInput
              label="Last 4 digits of presented OSCA / PWD ID"
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
              hint="Name printed on physical ID card"
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
        </Modal>
      ) : null}

      {voiding ? (
        <Modal
          title={`Void ${queueLabel(entry.queue_number)} · Table ${entry.table_number}`}
          size="small"
          destructive
          onClose={() => setVoiding(false)}
          footer={
            <>
              <Button variant="wide-delete" loading={voidBusy} onClick={handleVoidOrder}>
                Confirm Void
              </Button>
              <Button variant="secondary" data-modal-cancel="true" onClick={() => setVoiding(false)}>
                {t('common.cancel')}
              </Button>
            </>
          }
        >
          <TextInput
            label="Reason for voiding"
            required
            inputClass="freetext"
            maxLength={120}
            value={voidReason}
            onChange={(event) => setVoidReason(event.target.value)}
          />
        </Modal>
      ) : null}
    </section>
  );
}