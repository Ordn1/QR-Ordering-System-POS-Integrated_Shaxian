import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';

import Button from '../../components/shared/Button';
import { peso, queueLabel } from '../../lib/format';

export default function ReceiptPage() {
  const { t } = useTranslation();
  const { qrToken } = useParams();
  const navigate = useNavigate();
  const receipt = useLocation().state?.receipt;

  if (!receipt) {
    return <Navigate to={`/t/${qrToken}/menu`} replace />;
  }

  return (
    <main className="customer-page">
      <div className="customer-page-head">
        <h1>{t('receipt.title')}</h1>
      </div>

      <section className="receipt-queue">
        <p className="eyebrow">{t('receipt.queueNumber')}</p>
        <p className="receipt-queue-number numeric">{queueLabel(receipt.queue_number)}</p>
        <p className="receipt-note">
          {receipt.payment_status === 'paid'
            ? t('receipt.paidOnline')
            : t('receipt.payAtCounter')}
        </p>
      </section>

      <section className="receipt-body">
        <h2 className="section-heading">
          <span className="seal" aria-hidden="true" />
          {t('receipt.items')}
        </h2>
        <ul className="checkout-lines">
          {receipt.lines.map((line) => (
            <li key={line.item_id}>
              <span>
                {line.quantity} × {line.name}
              </span>
              <span className="numeric">{peso(line.subtotal)}</span>
            </li>
          ))}
        </ul>

        <dl className="receipt-totals">
          <dt>{t('checkout.gross')}</dt>
          <dd className="numeric">{peso(receipt.gross_amount)}</dd>
          {Number(receipt.vatable_sales) > 0 ? (
            <>
              <dt>{t('checkout.vatable')}</dt>
              <dd className="numeric">{peso(receipt.vatable_sales)}</dd>
              <dt>{t('checkout.vat')}</dt>
              <dd className="numeric">{peso(receipt.vat_amount)}</dd>
            </>
          ) : null}
          {Number(receipt.vat_exempt_sales) > 0 ? (
            <>
              <dt>{t('checkout.vatExempt')}</dt>
              <dd className="numeric">{peso(receipt.vat_exempt_sales)}</dd>
            </>
          ) : null}
          {Number(receipt.discount_amount) > 0 ? (
            <>
              <dt>{t('checkout.discount')}</dt>
              <dd className="numeric">−{peso(receipt.discount_amount)}</dd>
            </>
          ) : null}
          <dt className="receipt-net">{t('checkout.net')}</dt>
          <dd className="receipt-net numeric">{peso(receipt.net_amount)}</dd>
        </dl>
      </section>

      <Button variant="secondary" onClick={() => navigate(`/t/${qrToken}/menu`)}>
        {t('receipt.backToMenu')}
      </Button>
    </main>
  );
}
