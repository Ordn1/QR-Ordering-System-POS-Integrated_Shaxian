import { Check, CreditCard, Receipt, ShieldCheck, Store } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Navigate,
  useNavigate,
  useOutletContext,
  useParams,
  useSearchParams,
} from 'react-router-dom';

import { placeOrder, quoteOrder } from '../../api/orders';
import { fetchTableCart, syncDeviceCart } from '../../api/sessions';
import Button from '../../components/shared/Button';
import { peso } from '../../lib/format';
import { useCartStore } from '../../store/cartStore';
import { useSessionStore } from '../../store/sessionStore';
import { toast } from '../../store/toastStore';

export default function CheckoutPage() {
  const { t, i18n } = useTranslation();
  const { qrToken } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { trackControl, completed } = useOutletContext();
  const session = useSessionStore((state) => state.session);
  const lines = useCartStore((state) => state.lines);
  const clear = useCartStore((state) => state.clear);

  const requestedScope = searchParams.get('scope');
  const initialScope =
    requestedScope || (session?.group_mode ? 'split' : 'single');

  const [activeScope, setActiveScope] = useState(initialScope);
  const [method, setMethod] = useState('cashier');
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [quote, setQuote] = useState(null);
  const [displayLines, setDisplayLines] = useState(lines);
  const [loadingScope, setLoadingScope] = useState(true);

  useEffect(() => {
    if (!session?.session_id) {
      return undefined;
    }
    let cancelled = false;

    async function loadQuoteAndLines() {
      setLoadingScope(true);
      try {
        if (lines.length > 0) {
          await syncDeviceCart(
            session.session_id,
            lines.map((line) => ({ item_id: line.item_id, quantity: line.quantity })),
            i18n.language,
          ).catch(() => { });
        }

        const tableCart = await fetchTableCart(session.session_id, i18n.language);
        if (cancelled) {
          return;
        }

        let resolvedScope =
          requestedScope || (session?.group_mode ? 'split' : 'single');

        const myShare = tableCart.shares.find((s) => s.is_me);
        const myLines = (myShare?.lines ?? []).map((l) => ({
          item_id: l.item_id,
          name: l.name,
          price: l.unit_price,
          quantity: l.quantity,
        }));
        const allTableLines = tableCart.shares
          .filter((s) => s.payment_status !== 'paid')
          .flatMap((s) =>
            s.lines.map((l) => ({
              item_id: l.item_id,
              name: l.name,
              price: l.unit_price,
              quantity: l.quantity,
            })),
          );

        let effectiveLines = lines;

        if (resolvedScope === 'table') {
          effectiveLines = allTableLines.length > 0 ? allTableLines : lines;
        } else if (resolvedScope === 'split') {
          if (lines.length > 0) {
            effectiveLines = lines;
          } else if (myLines.length > 0) {
            effectiveLines = myLines;
          } else if (allTableLines.length > 0) {
            resolvedScope = 'table';
            effectiveLines = allTableLines;
          }
        } else {
          if (lines.length > 0) {
            effectiveLines = lines;
          } else if (myLines.length > 0) {
            resolvedScope = session?.group_mode ? 'split' : 'single';
            effectiveLines = myLines;
          } else if (allTableLines.length > 0) {
            resolvedScope = 'table';
            effectiveLines = allTableLines;
          }
        }

        setActiveScope(resolvedScope);
        setDisplayLines(effectiveLines);

        if (effectiveLines.length === 0) {
          setLoadingScope(false);
          return;
        }

        const itemsForQuote = effectiveLines.map((line) => ({
          item_id: line.item_id,
          quantity: line.quantity,
        }));

        const nextQuote = await quoteOrder(
          session.session_id,
          itemsForQuote,
          resolvedScope,
        );
        if (!cancelled) {
          setQuote(nextQuote);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error.message);
        }
      } finally {
        if (!cancelled) {
          setLoadingScope(false);
        }
      }
    }

    loadQuoteAndLines();
    return () => {
      cancelled = true;
    };
  }, [session?.session_id, session?.group_mode, lines, requestedScope, i18n.language]);

  if (!loadingScope && displayLines.length === 0 && lines.length === 0 && !placed) {
    return <Navigate to={`/t/${qrToken}/cart`} replace />;
  }

  async function submit() {
    setPlacing(true);
    try {
      const sourceLines = displayLines.length > 0 ? displayLines : lines;
      const itemsToSend = sourceLines.map((line) => ({
        item_id: line.item_id,
        quantity: line.quantity,
      }));

      const receipt = await placeOrder(session.session_id, {
        items: itemsToSend,
        payment_method: method,
        language: i18n.language,
        origin_url: window.location.origin,
        checkout_scope: activeScope,
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
        <h1>
          {activeScope === 'table'
            ? `${t('checkout.title')} · Entire Table`
            : activeScope === 'split'
              ? `${t('checkout.title')} · My Share`
              : t('checkout.title')}
        </h1>
      </div>

      <section className="checkout-card">
        <div className="checkout-card-header">
          <Receipt size={20} strokeWidth={1.75} className="checkout-card-icon" />
          <h2>
            {t('checkout.summary')} (
            {displayLines.reduce((acc, l) => acc + l.quantity, 0)})
          </h2>
        </div>
        <ul className="checkout-item-list">
          {displayLines.map((line, idx) => (
            <li key={`${line.item_id}-${idx}`} className="checkout-item-row">
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
          <div className="checkout-discount-note">
            <p style={{ margin: 0 }}>{t('priority.discountNote')}</p>
            <p
              style={{
                margin: 'var(--space-2) 0 0 0',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                fontWeight: 600,
              }}
            >
              <ShieldCheck size={16} style={{ flexShrink: 0 }} />
              <span>
                Please have your physical OSCA / PWD ID card ready—our staff will verify it when serving your order or at the cashier.
              </span>
            </p>
          </div>
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