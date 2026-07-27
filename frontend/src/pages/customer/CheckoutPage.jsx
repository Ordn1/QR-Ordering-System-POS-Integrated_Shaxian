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

  // The server prices the cart, so what the diner reads here is exactly what the
  // receipt will say — including the statutory discount, which they are entitled
  // to see before committing rather than after.
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
      .catch(() => {});
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
      });
      setPlaced(true);
      completed?.('place');
      clear();
      toast.success(t('checkout.placed'));
      navigate(`/t/${qrToken}/receipt`, { state: { receipt }, replace: true });
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

      <section className="checkout-summary">
        <h2 className="section-heading">
          <span className="seal" aria-hidden="true" />
          {t('checkout.summary')}
        </h2>
        <ul className="checkout-lines">
          {lines.map((line) => (
            <li key={line.item_id}>
              <span>
                {line.quantity} × {line.name}
              </span>
              <span className="numeric">{peso(Number(line.price) * line.quantity)}</span>
            </li>
          ))}
        </ul>
        {quote ? (
          <dl className="checkout-totals">
            <dt>{t('checkout.gross')}</dt>
            <dd className="numeric">{peso(quote.gross_amount)}</dd>

            {quote.discount_applied ? (
              <>
                <dt>{t('checkout.vatExempt')}</dt>
                <dd className="numeric">{peso(quote.vat_exempt_sales)}</dd>
                <dt className="checkout-discount">{t('checkout.discount')}</dt>
                <dd className="checkout-discount numeric">
                  −{peso(quote.discount_amount)}
                </dd>
              </>
            ) : (
              <>
                <dt>{t('checkout.vatable')}</dt>
                <dd className="numeric">{peso(quote.vatable_sales)}</dd>
                <dt>{t('checkout.vat')}</dt>
                <dd className="numeric">{peso(quote.vat_amount)}</dd>
              </>
            )}

            <dt className="checkout-net">{t('checkout.net')}</dt>
            <dd className="checkout-net numeric">{peso(quote.net_amount)}</dd>
          </dl>
        ) : null}

        {quote?.discount_applied ? (
          <p className="checkout-discount-note">{t('priority.discountNote')}</p>
        ) : null}
      </section>

      <section className="checkout-payment-options">
        <h2 className="section-heading">
          <span className="seal" aria-hidden="true" />
          {t('checkout.payment')}
        </h2>
        <label className="radio-field">
          <input
            type="radio"
            name="payment"
            checked={method === 'cashier'}
            onChange={() => setMethod('cashier')}
          />
          {t('checkout.payAtCashier')}
        </label>
        <label className="radio-field">
          <input
            type="radio"
            name="payment"
            checked={method === 'online'}
            onChange={() => setMethod('online')}
          />
          {t('checkout.payOnline')}
        </label>
      </section>

      <Button
        variant="checkout"
        loading={placing}
        ref={trackControl?.('place')}
        onClick={submit}
      >
        {t('checkout.placeOrder')}
      </Button>
    </main>
  );
}
