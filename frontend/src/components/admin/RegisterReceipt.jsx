import { useTranslation } from 'react-i18next';

import { peso, queueLabel } from '../../lib/format';

export default function RegisterReceipt({ transmission }) {
  const { t } = useTranslation();

  if (!transmission) {
    return <p className="register-empty">{t('pos.registerEmpty')}</p>;
  }

  const { payload, receipt_no: receiptNo } = transmission;
  const totals = payload.totals ?? {};
  const payment = payload.payment ?? {};
  const discounted = Number(totals.statutory_discount ?? 0) > 0;

  return (
    <div className="register-slip">
      <p className="register-store">{t('auth.brand')}</p>
      <p className="register-branch">{payload.store_code} · {payload.terminal_code}</p>

      <p className="register-receipt-no numeric">{receiptNo ?? '—'}</p>

      <dl className="register-head">
        <dt>{t('pos.queue')}</dt>
        <dd className="numeric">{queueLabel(payload.queue_number)}</dd>
        <dt>{t('staff.tableNumber', { number: payload.table_number })}</dt>
        <dd className="numeric">{payload.queue_date}</dd>
      </dl>

      <ul className="register-lines">
        {(payload.lines ?? []).map((line) => (
          <li key={line.item_code}>
            <span>
              {line.quantity} × {line.description}
            </span>
            <span className="numeric">{peso(line.subtotal)}</span>
          </li>
        ))}
      </ul>

      <dl className="register-totals">
        <dt>{t('checkout.gross')}</dt>
        <dd className="numeric">{peso(totals.gross)}</dd>
        {discounted ? (
          <>
            <dt>{t('checkout.vatExempt')}</dt>
            <dd className="numeric">{peso(totals.vat_exempt_sales)}</dd>
            <dt>{t('checkout.discount')}</dt>
            <dd className="numeric">−{peso(totals.statutory_discount)}</dd>
          </>
        ) : (
          <>
            <dt>{t('checkout.vatable')}</dt>
            <dd className="numeric">{peso(totals.vatable_sales)}</dd>
            <dt>{t('checkout.vat')}</dt>
            <dd className="numeric">{peso(totals.vat)}</dd>
          </>
        )}
        <dt className="register-net">{t('checkout.net')}</dt>
        <dd className="register-net numeric">{peso(totals.net)}</dd>
        {payment.cash_tendered ? (
          <>
            <dt>Cash Tendered</dt>
            <dd className="numeric">{peso(payment.cash_tendered)}</dd>
            <dt>Change Due</dt>
            <dd className="numeric">{peso(payment.change_due ?? 0)}</dd>
          </>
        ) : null}
      </dl>

      <p className="register-notice">{t('pos.notFiscal')}</p>
    </div>
  );
}