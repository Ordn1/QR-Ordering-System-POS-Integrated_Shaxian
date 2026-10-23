import { CheckCircle2, Printer } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { peso, queueLabel } from '../../lib/format';
import Badge from '../shared/Badge';
import Button from '../shared/Button';
import Modal from '../shared/Modal';
import TextInput from '../shared/TextInput';

const BILLS = [100, 200, 500, 1000];

export default function CashierConfirmModal({ entry, busy, onConfirm, onClose }) {
  const { t } = useTranslation();
  const amountDue =
    Number(entry.unpaid_amount) > 0
      ? Number(entry.unpaid_amount)
      : Number(entry.net_amount ?? 0);
  const [tendered, setTendered] = useState(amountDue.toFixed(2));
  const [settled, setSettled] = useState(null);
  const [error, setError] = useState(null);

  const numericTendered = Number(tendered);
  const validTender = Number.isFinite(numericTendered) && numericTendered >= amountDue;
  const changeDue = validTender ? Math.max(0, numericTendered - amountDue) : 0;

  async function handleSettle() {
    if (!validTender) {
      setError(`Cash tendered must be at least ${peso(amountDue)}.`);
      return;
    }
    setError(null);
    const result = await onConfirm(entry, numericTendered.toFixed(2));
    if (result) {
      setSettled({
        receipt_no:
          result.receipt_no ||
          `OR-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(entry.queue_number).padStart(4, '0')}`,
        cash_tendered: result.cash_tendered ?? numericTendered,
        change_due: result.change_due ?? changeDue,
      });
    }
  }

  if (settled) {
    return (
      <Modal
        title={`POS Official Receipt · ${settled.receipt_no}`}
        size="small"
        onClose={onClose}
        footer={
          <>
            <Button variant="secondary" icon={Printer} onClick={() => window.print()}>
              Print Official Receipt
            </Button>
            <Button variant="primary" data-modal-cancel="true" onClick={onClose}>
              Done
            </Button>
          </>
        }
      >
        <div className="register-slip">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
            <CheckCircle2 size={20} className="text-green" />
            <strong>POS Sale Settled & Transmitted</strong>
          </div>
          <p className="register-store">{t('auth.brand')}</p>
          <p className="register-branch">SXN-SASA-01 · REG-01</p>
          <p className="register-receipt-no numeric">{settled.receipt_no}</p>

          <dl className="register-head">
            <dt>{t('pos.queue')}</dt>
            <dd className="numeric">{queueLabel(entry.queue_number)}</dd>
            <dt>{t('staff.tableNumber', { number: entry.table_number })}</dt>
            <dd>{entry.declared_priority_status}</dd>
          </dl>

          {entry.items && entry.items.length > 0 ? (
            <ul className="register-lines">
              {entry.items.map((item, idx) => (
                <li key={idx}>
                  <span>
                    {item.qty} × {item.name}
                  </span>
                  <span className="numeric">{peso(item.unit_price * item.qty)}</span>
                </li>
              ))}
            </ul>
          ) : null}

          <dl className="register-totals">
            <dt>{t('checkout.gross')}</dt>
            <dd className="numeric">{peso(entry.gross_amount)}</dd>
            {Number(entry.discount_amount) > 0 ? (
              <>
                <dt>{t('checkout.discount')}</dt>
                <dd className="numeric">−{peso(entry.discount_amount)}</dd>
              </>
            ) : (
              <>
                <dt>{t('checkout.vat')}</dt>
                <dd className="numeric">{peso(entry.vat_amount)}</dd>
              </>
            )}
            <dt className="register-net">{t('checkout.net')}</dt>
            <dd className="register-net numeric">{peso(amountDue)}</dd>
            <dt>Cash Tendered</dt>
            <dd className="numeric">{peso(settled.cash_tendered)}</dd>
            <dt style={{ fontWeight: 700 }}>Change Due</dt>
            <dd className="numeric" style={{ fontWeight: 700 }}>
              {peso(settled.change_due)}
            </dd>
          </dl>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title={`POS Cash Register · ${queueLabel(entry.queue_number)}`}
      size="small"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" data-modal-cancel="true" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            loading={busy}
            disabled={!validTender}
            onClick={handleSettle}
          >
            Complete POS Sale · {peso(amountDue)}
          </Button>
        </>
      }
    >
      <div className="cash-meta" style={{ marginBottom: 'var(--space-3)' }}>
        <Badge value={entry.declared_priority_status} />
        <span>{t('staff.tableNumber', { number: entry.table_number })}</span>
        <span>{t('staff.itemCount', { count: entry.item_count })}</span>
      </div>

      {entry.items && entry.items.length > 0 ? (
        <ul className="register-lines" style={{ marginBottom: 'var(--space-3)' }}>
          {entry.items.map((item, idx) => (
            <li key={idx}>
              <span>
                {item.qty} × {item.name}
              </span>
              <span className="numeric">{peso(item.unit_price * item.qty)}</span>
            </li>
          ))}
        </ul>
      ) : null}

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
      <p className="cash-due numeric">{peso(amountDue)}</p>

      <div className="stack-3" style={{ marginTop: 'var(--space-3)' }}>
        <TextInput
          label="Cash Tendered (₱)"
          required
          inputClass="currency"
          inputMode="decimal"
          maxLength={9}
          value={tendered}
          error={error}
          onChange={(event) => {
            setTendered(event.target.value);
            setError(null);
          }}
        />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          <Button
            variant="secondary"
            onClick={() => setTendered(amountDue.toFixed(2))}
          >
            Exact ({peso(amountDue)})
          </Button>
          {BILLS.filter((bill) => bill >= amountDue).map((bill) => (
            <Button
              key={bill}
              variant="secondary"
              onClick={() => setTendered(bill.toFixed(2))}
            >
              ₱{bill}
            </Button>
          ))}
        </div>

        <div
          style={{
            padding: 'var(--space-3)',
            border: '1px solid var(--color-border, #d6d3cd)',
            background: 'var(--color-surface-subtle, #f7f5f0)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span className="eyebrow" style={{ margin: 0 }}>
            Change Due
          </span>
          <strong className="numeric" style={{ fontSize: 'var(--text-lg)' }}>
            {validTender ? peso(changeDue) : 'Insufficient cash'}
          </strong>
        </div>
      </div>
    </Modal>
  );
}