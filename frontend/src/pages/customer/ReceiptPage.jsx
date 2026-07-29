import { CheckCircle2, Receipt } from 'lucide-react';
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
      <div className="customer-page-head text-center">
        <h1>{t('receipt.title')}</h1>
      </div>

      {/* Queue Hero Card */}
      <section className="receipt-hero-card">
        <div className="receipt-hero-badge">
          <CheckCircle2 size={36} strokeWidth={2} className="text-green" />
        </div>
        <p className="receipt-hero-eyebrow">{t('receipt.queueNumber')}</p>
        <h2 className="receipt-hero-number numeric">{queueLabel(receipt.queue_number)}</h2>
        <p className="receipt-note">
          {receipt.payment_status === 'paid'
            ? t('receipt.paidOnline')
            : t('receipt.payAtCounter')}
        </p>
      </section>

      {/* Itemized Order Breakdown */}
      <section className="receipt-card">
        <div className="receipt-card-header">
          <Receipt size={20} strokeWidth={1.75} className="receipt-card-icon" />
          <h2>{t('receipt.items')}</h2>
        </div>
        <ul className="receipt-item-list">
          {receipt.lines.map((line) => (
            <li key={line.item_id} className="receipt-item-row">
              <span className="receipt-item-qty">{line.quantity}×</span>
              <span className="receipt-item-name">{line.name}</span>
              <span className="receipt-item-price numeric">{peso(line.subtotal)}</span>
            </li>
          ))}
        </ul>

        <dl className="receipt-totals">
          <div className="receipt-total-row">
            <dt>{t('checkout.gross')}</dt>
            <dd className="numeric">{peso(receipt.gross_amount)}</dd>
          </div>
          {Number(receipt.vatable_sales) > 0 ? (
            <>
              <div className="receipt-total-row">
                <dt>{t('checkout.vatable')}</dt>
                <dd className="numeric">{peso(receipt.vatable_sales)}</dd>
              </div>
              <div className="receipt-total-row">
                <dt>{t('checkout.vat')}</dt>
                <dd className="numeric">{peso(receipt.vat_amount)}</dd>
              </div>
            </>
          ) : null}
          {Number(receipt.vat_exempt_sales) > 0 ? (
            <div className="receipt-total-row">
              <dt>{t('checkout.vatExempt')}</dt>
              <dd className="numeric">{peso(receipt.vat_exempt_sales)}</dd>
            </div>
          ) : null}
          {Number(receipt.discount_amount) > 0 ? (
            <div className="receipt-total-row receipt-discount-row">
              <dt>{t('checkout.discount')}</dt>
              <dd className="numeric">−{peso(receipt.discount_amount)}</dd>
            </div>
          ) : null}
          <div className="receipt-total-row receipt-net-row">
            <dt className="receipt-net">{t('checkout.net')}</dt>
            <dd className="receipt-net numeric">{peso(receipt.net_amount)}</dd>
          </div>
        </dl>
      </section>

      <div className="receipt-actions">
        <Button variant="secondary" onClick={() => navigate(`/t/${qrToken}/menu`)}>
          {t('receipt.backToMenu')}
        </Button>
      </div>
    </main>
  );
}
