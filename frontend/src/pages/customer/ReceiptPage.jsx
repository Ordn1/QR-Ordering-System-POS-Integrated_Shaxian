import { CheckCircle2, CreditCard, Receipt, ShieldCheck, Smartphone } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Navigate,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';

import { fetchReceipt, verifyOrderPayment } from '../../api/orders';
import Badge from '../../components/shared/Badge';
import Button from '../../components/shared/Button';
import { useWebSocket } from '../../hooks/useWebSocket';
import { peso, queueLabel } from '../../lib/format';
import { useSessionStore } from '../../store/sessionStore';
import { toast } from '../../store/toastStore';

export default function ReceiptPage() {
  const { t, i18n } = useTranslation();
  const { qrToken } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const session = useSessionStore((state) => state.session);

  const initialReceipt = location.state?.receipt ?? null;
  const txnIdParam = searchParams.get('txn_id');
  const shouldVerify = searchParams.get('verify') === '1';
  const wasCancelled = searchParams.get('cancelled') === '1';

  const [receipt, setReceipt] = useState(initialReceipt);
  const [loading, setLoading] = useState(!initialReceipt && Boolean(txnIdParam));
  const [verifying, setVerifying] = useState(false);
  const handledRef = useRef(false);

  const txnId = receipt?.txn_id ?? (txnIdParam ? Number(txnIdParam) : null);

  const reloadReceipt = useCallback(() => {
    if (!session?.session_id || !txnId) {
      return Promise.resolve();
    }
    return fetchReceipt(session.session_id, txnId, i18n.language)
      .then(setReceipt)
      .catch(() => { });
  }, [session?.session_id, txnId, i18n.language]);

  const runVerification = useCallback(async () => {
    if (!session?.session_id || !txnId) {
      return;
    }
    setVerifying(true);
    try {
      const updated = await verifyOrderPayment(
        session.session_id,
        txnId,
        i18n.language,
      );
      setReceipt(updated);
      setSearchParams({ txn_id: String(txnId) }, { replace: true });
      const myShare = updated.shares?.find((s) => s.is_me);
      if (updated.payment_status === 'paid' || myShare?.status === 'paid') {
        toast.success(
          t('receipt.paidOnlineToast', {
            defaultValue: 'Online payment confirmed!',
          }),
        );
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setVerifying(false);
      setLoading(false);
    }
  }, [session?.session_id, txnId, i18n.language, setSearchParams, t]);

  useEffect(() => {
    if (!session?.session_id || !txnId || handledRef.current) {
      return;
    }
    handledRef.current = true;

    if (shouldVerify) {
      runVerification();
    } else {
      fetchReceipt(session.session_id, txnId, i18n.language)
        .then(setReceipt)
        .catch((error) => toast.error(error.message))
        .finally(() => setLoading(false));
    }
  }, [session?.session_id, txnId, shouldVerify, i18n.language, runVerification]);

  useEffect(() => {
    if (wasCancelled) {
      toast.info(
        t('receipt.paymentCancelled', {
          defaultValue:
            'Online payment was not completed. You can pay at the counter or retry verification.',
        }),
      );
    }
  }, [wasCancelled, t]);

  useWebSocket(
    session
      ? `/ws/orders/${session.session_id}?device=${session.device_token}`
      : null,
    reloadReceipt,
  );

  if (loading || verifying) {
    return (
      <main className="customer-page">
        <div className="entry-status-wrap">
          <span className="btn-spinner entry-spinner" role="status" aria-label="Loading" />
          <p className="entry-note">
            {verifying
              ? t('receipt.verifyingPayment', {
                defaultValue: 'Confirming your payment with PayMongo…',
              })
              : t('entry.starting')}
          </p>
        </div>
      </main>
    );
  }

  if (!receipt) {
    return <Navigate to={`/t/${qrToken}/menu`} replace />;
  }

  const shares = receipt.shares ?? [];
  const hasMultipleShares = shares.length > 1;
  const myShare = shares.find((s) => s.is_me);
  const isCashierOrder = receipt.payment_method === 'cashier' || receipt.fallback_to_cashier;
  const hasPriorityDiscount = Number(receipt.discount_amount) > 0;

  return (
    <main className="customer-page">
      <div className="customer-page-head text-center">
        <h1>{t('receipt.title')}</h1>
      </div>

      <section className="receipt-hero-card">
        <div className="receipt-hero-badge">
          <CheckCircle2 size={36} strokeWidth={2} className="text-green" />
        </div>
        <p className="receipt-hero-eyebrow">{t('receipt.queueNumber')}</p>
        <h2 className="receipt-hero-number numeric">{queueLabel(receipt.queue_number)}</h2>
        <p className="receipt-note">
          {receipt.payment_status === 'paid'
            ? t('receipt.paidOnline')
            : isCashierOrder && !hasMultipleShares
              ? t('receipt.payAtCounter', {
                defaultValue: 'Pay at the counter when your number is called.',
              })
              : hasMultipleShares
                ? 'Kitchen preparation begins once all payment shares are settled.'
                : t('receipt.payAtCounter')}
        </p>
      </section>

      {hasPriorityDiscount ? (
        <section
          className="receipt-card"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--space-3)',
          }}
        >
          <ShieldCheck size={22} strokeWidth={1.75} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h2 style={{ fontSize: 'var(--text-base)', margin: '0 0 var(--space-1) 0' }}>
              Senior / PWD ID Verification Reminder
            </h2>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)' }}>
              Please have your physical OSCA or PWD ID card ready. Our staff will verify it when serving your meal or when you settle at the counter.
            </p>
          </div>
        </section>
      ) : null}

      {hasMultipleShares ? (
        <section className="receipt-card">
          <div className="receipt-card-header">
            <Smartphone size={20} strokeWidth={1.75} className="receipt-card-icon" />
            <h2>{t('split.title')}</h2>
          </div>
          <ul className="receipt-item-list">
            {shares.map((share) => (
              <li key={share.payment_id} className="receipt-item-row">
                <span className="receipt-item-name">
                  {share.is_host
                    ? t('split.deviceHost', { number: share.device_number })
                    : t('split.device', { number: share.device_number })}
                  {share.is_me ? ' (You)' : ''}
                </span>
                <Badge value={share.status} domain="payment" />
                <span className="receipt-item-price numeric">{peso(share.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="receipt-card">
        <div className="receipt-card-header">
          <Receipt size={20} strokeWidth={1.75} className="receipt-card-icon" />
          <h2>{t('receipt.items')}</h2>
        </div>
        <ul className="receipt-item-list">
          {receipt.lines.map((line, idx) => (
            <li key={`${line.item_id}-${idx}`} className="receipt-item-row">
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
        {myShare && myShare.status !== 'paid' && myShare.method === 'online' ? (
          <Button
            variant="primary"
            icon={CreditCard}
            loading={verifying}
            onClick={runVerification}
          >
            {t('receipt.recheckPayment', { defaultValue: 'Verify online payment' })}
          </Button>
        ) : null}
        {hasMultipleShares && receipt.payment_status !== 'paid' ? (
          <Button
            variant="primary"
            onClick={() => navigate(`/t/${qrToken}/split`)}
          >
            {t('split.title')}
          </Button>
        ) : null}
        <Button variant="secondary" onClick={() => navigate(`/t/${qrToken}/status`)}>
          {t('nav.status')}
        </Button>
        <Button variant="secondary" onClick={() => navigate(`/t/${qrToken}/menu`)}>
          {t('receipt.backToMenu')}
        </Button>
      </div>
    </main>
  );
}