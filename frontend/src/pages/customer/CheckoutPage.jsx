import { Check, CreditCard, Receipt, Store } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useOutletContext, useParams } from 'react-router-dom';

import { placeOrder, quoteOrder } from '../../api/orders';
import Button from '../../components/shared/Button';
import { peso } from '../../lib/format';
import { useCartStore } from '../../store/cartStore';
import { useSessionStore } from '../../store/sessionStore';
import { toast } from '../../store/toastStore';

export default function CheckoutPage() {
  const { t, i18n } = useTranslation();
  const { qrToken } = useParams();
  const navigate = useNavigate();
  const { trackControl, completed } = useOutletContext();
  const session = useSessionStore((state) => state.session);
  const lines = useCartStore((state) => state.lines);
  const clear = useCartStore((state) => state.clear);
  const [method, setMethod] = useState('cashier');
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [quote, setQuote] = useState(null);

  useEffect(() => {
    if (!session || lines.length === 0) {
      return undefined;
    }
    let cancelled = false;
    quoteOrder(
      session.session_id,
      lines.map((line) => ({ item_id: line.item_id, quantity: line.quantity })),
    )
      .then((next) => {
        if (!cancelled) {
          setQuote(next);
        }
      })
      .catch(() => { });
    return () => {
      cancelled = true;
    };
  }, [session, lines]);

  if (lines.length === 0 && !placed) {
    return <Navigate to={`/t/${qrToken}/cart`} replace />;
  }

  async function submit() {
    setPlacing(true);
    try {
      const receipt = await placeOrder(session.session_id, {
        items: lines.map((line) => ({ item_id: line.item_id, quantity: line.quantity })),
        payment_method: method,
        language: i18n.language,
        origin_url: window.location.origin,
      });
      setPlaced(true);
      completed?.('place');
      clear();

      if (receipt.checkout_url) {
        window.location.assign(receipt.checkout_url);
        return;
      }

      if (receipt.fallback_to_cashier) {
        toast.info(
          t('checkout.offlineFallback', {
            defaultValue: 'Online payment is unavailable. Switched to Pay at Cashier.',
          }),
        );
      } else {
        toast.success(t('checkout.placed'));
      }

      navigate(`/t/${qrToken}/receipt?txn_id=${receipt.txn_id}`, {
        state: { receipt },
        replace: true,
      });
    } catch (error) {
      toast.error(error.message);
    } finally {
      setPlacing(false);
    }
  }

  return (
    <main className="customer-page">
      <div className="customer-page-head">
        <h1>{t('checkout.title')}</h1>
      </div>

      <section className="checkout-card">
        <div className="checkout-card-header">
          <Receipt size={20} strokeWidth={1.75} className="checkout-card-icon" />
          <h2>
            {t('checkout.summary')} ({lines.reduce((acc, l) => acc + l.quantity, 0)})
          </h2>
        </div>
        <ul className="checkout-item-list">
          {lines.map((line) => (
            <li key={line.item_id} className="checkout-item-row">
              <span className="checkout-item-qty">{line.quantity}×</span>
              <span className="checkout-item-name">{line.name}</span>
              <span className="checkout-item-price numeric">
                {peso(Number(line.price) * line.quantity)}
              </span>
            </li>
          ))}
        </ul>

        {quote ? (
          <dl className="checkout-totals">
            <div className="checkout-total-row">
              <dt>{t('checkout.gross')}</dt>
              <dd className="numeric">{peso(quote.gross_amount)}</dd>
            </div>

            {quote.discount_applied ? (
              <>
                <div className="checkout-total-row">
                  <dt>{t('checkout.vatExempt')}</dt>
                  <dd className="numeric">{peso(quote.vat_exempt_sales)}</dd>
                </div>
                <div className="checkout-total-row checkout-discount-row">
                  <dt className="checkout-discount">{t('checkout.discount')}</dt>
                  <dd className="checkout-discount numeric">
                    −{peso(quote.discount_amount)}
                  </dd>
                </div>
              </>
            ) : (
              <>
                <div className="checkout-total-row">
                  <dt>{t('checkout.vatable')}</dt>
                  <dd className="numeric">{peso(quote.vatable_sales)}</dd>
                </div>
                <div className="checkout-total-row">
                  <dt>{t('checkout.vat')}</dt>
                  <dd className="numeric">{peso(quote.vat_amount)}</dd>
                </div>
              </>
            )}

            <div className="checkout-total-row checkout-net-row">
              <dt className="checkout-net">{t('checkout.net')}</dt>
              <dd className="checkout-net numeric">{peso(quote.net_amount)}</dd>
            </div>
          </dl>
        ) : null}

        {quote?.discount_applied ? (
          <p className="checkout-discount-note">{t('priority.discountNote')}</p>
        ) : null}
      </section>

      <section className="payment-options-section">
        <h2 className="section-title-sm">{t('checkout.payment')}</h2>
        <div className="payment-card-grid">
          <button
            type="button"
            className={`payment-card${method === 'cashier' ? ' selected' : ''}`}
            onClick={() => setMethod('cashier')}
          >
            <div className="payment-card-icon-wrap">
              <Store size={22} strokeWidth={1.75} />
            </div>
            <div className="payment-card-text">
              <span className="payment-card-title">{t('checkout.payAtCashier')}</span>
            </div>
            <div className="payment-card-check">
              {method === 'cashier' ? <Check size={16} strokeWidth={2.5} /> : null}
            </div>
          </button>

          <button
            type="button"
            className={`payment-card${method === 'online' ? ' selected' : ''}`}
            onClick={() => setMethod('online')}
          >
            <div className="payment-card-icon-wrap">
              <CreditCard size={22} strokeWidth={1.75} />
            </div>
            <div className="payment-card-text">
              <span className="payment-card-title">{t('checkout.payOnline')}</span>
            </div>
            <div className="payment-card-check">
              {method === 'online' ? <Check size={16} strokeWidth={2.5} /> : null}
            </div>
          </button>
        </div>
      </section>

      <div className="checkout-submit-wrap">
        <Button
          variant="checkout"
          loading={placing}
          ref={trackControl?.('place')}
          onClick={submit}
        >
          {t('checkout.placeOrder')} {quote ? `· ${peso(quote.net_amount)}` : ''}
        </Button>
      </div>
    </main>
  );
}