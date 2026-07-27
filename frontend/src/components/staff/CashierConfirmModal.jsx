import { useTranslation } from 'react-i18next';

import { peso, queueLabel } from '../../lib/format';
import Badge from '../shared/Badge';
import Button from '../shared/Button';
import Modal from '../shared/Modal';

/**
 * Cash settlement needs a deliberate step, not a single click on a queue row: the
 * crew member has to read back what the diner owes and why before the transaction
 * is marked paid. Shows the statutory discount separately so a senior can see it
 * was applied at the counter.
 */
export default function CashierConfirmModal({ entry, busy, onConfirm, onClose }) {
  const { t } = useTranslation();

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
          <Button variant="primary" loading={busy} onClick={() => onConfirm(entry)}>
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
    </Modal>
  );
}
