import { Check, CheckCircle2, CreditCard, QrCode, Receipt, Store } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
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
import Money from '../../components/shared/Money';
import { peso, queueLabel } from '../../lib/format';
import { DURATION, MOVE, prefersReducedMotion } from '../../lib/motion';
import { cartPayload, useCartStore } from '../../store/cartStore';
import { companionName } from '../../lib/shareLabel';
import { useSessionStore } from '../../store/sessionStore';
import { toast } from '../../store/toastStore';

const ROW_REVEAL = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: 'auto' },
  exit: { opacity: 0, height: 0 },
  transition: MOVE,
};

function ownItems(lines) {
  return cartPayload(lines);
}

export default function CheckoutPage() {
  const { t, i18n } = useTranslation();
  const { qrToken } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { trackControl, completed } = useOutletContext();
  const session = useSessionStore((state) => state.session);
  const lines = useCartStore((state) => state.lines);

  const requestedScope = searchParams.get('scope');
  const initialScope =
    requestedScope || (session?.group_mode ? 'split' : 'single');

  const [activeScope, setActiveScope] = useState(initialScope);
  const [method, setMethod] = useState('cashier');
  const [placing, setPlacing] = useState(false);
  const [placedReceipt, setPlacedReceipt] = useState(null);
  const [quote, setQuote] = useState(null);
  const [displayLines, setDisplayLines] = useState(lines);
  const [loadingScope, setLoadingScope] = useState(true);
  const [settledQuote, setSettledQuote] = useState(null);

  const deducting =
    Boolean(quote?.discount_applied) && settledQuote !== quote && !prefersReducedMotion();
  const onlineBlocked = quote ? !quote.online_allowed : false;
  const discountedShares = (quote?.shares ?? []).filter((share) => Number(share.discount_amount) > 0);
  const companionOnlyDiscount =
    discountedShares.length > 0 && discountedShares.every((share) => share.pays_at_cashier)
      ? discountedShares[0]
      : null;
  const chosenMethod = onlineBlocked ? 'cashier' : method;

  useEffect(() => {
    if (!quote?.discount_applied) {
      return undefined;
    }
    const timer = setTimeout(() => setSettledQuote(quote), DURATION.hold * 1000);
    return () => clearTimeout(timer);
  }, [quote]);

  const placedRef = useRef(false);

  useEffect(() => {
    if (!session?.session_id || placedRef.current) {
      return undefined;
    }
    let cancelled = false;

    async function loadQuoteAndLines() {
      setLoadingScope(true);
      try {
        if (lines.length > 0) {
          await syncDeviceCart(session.session_id, cartPayload(lines), i18n.language).catch(
            () => { },
          );
        }

        const tableCart = await fetchTableCart(session.session_id, i18n.language);
        if (cancelled || placedRef.current) {
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

        const nextQuote = await quoteOrder(
          session.session_id,
          ownItems(lines),
          resolvedScope,
        );
        if (!cancelled && !placedRef.current) {
          setQuote(nextQuote);
        }
      } catch (error) {
        if (!cancelled && !placedRef.current) {
          toast.error(error.message);
        }
      } finally {
        if (!cancelled && !placedRef.current) {
          setLoadingScope(false);
        }
      }
    }

    loadQuoteAndLines();
    return () => {
      cancelled = true;
    };
  }, [session?.session_id, session?.group_mode, lines, requestedScope, i18n.language]);

  if (placedReceipt) {
    return (
      <main className="customer-page">
        <section className="receipt-hero-card">
          <div className="receipt-hero-badge">
            <CheckCircle2 size={36} strokeWidth={2} className="text-green" />
          </div>
          <p className="receipt-hero-eyebrow">{t('receipt.queueNumber')}</p>
          <h2 className="receipt-hero-number numeric">
            {queueLabel(placedReceipt.queue_number)}
          </h2>
          <p className="receipt-note">
            Present Queue Code {queueLabel(placedReceipt.queue_number)} at the Cashier POS Counter to pay.
          </p>
        </section>
        <div className="receipt-actions">
          <Button
            variant="primary"
            onClick={() =>
              navigate(`/t/${qrToken}/receipt?txn_id=${placedReceipt.txn_id}`, {
                state: { receipt: placedReceipt },
                replace: true,
              })
            }
          >
            View Digital Receipt
          </Button>
          <Button
            variant="secondary"
            onClick={() => navigate(`/t/${qrToken}/status`)}
          >
            {t('nav.status')}
          </Button>
        </div>
      </main>
    );
  }

  if (!loadingScope && displayLines.length === 0 && lines.length === 0 && !placedRef.current) {
    return <Navigate to={`/t/${qrToken}/cart`} replace />;
  }

  async function submit() {
    setPlacing(true);
    try {
      const itemsToSend = ownItems(lines);

      const langCode = ['en', 'fil', 'bis'].includes(i18n.language)
        ? i18n.language
        : 'en';

      const receipt = await placeOrder(session.session_id, {
        items: itemsToSend,
        payment_method: chosenMethod === 'cashier' ? 'cashier' : 'online',
        online_channel: chosenMethod === 'qrph' ? 'qrph' : 'checkout',
        language: langCode,
        origin_url: window.location.origin,
        checkout_scope: activeScope,
      });

      placedRef.current = true;
      setPlacedReceipt(receipt);
      completed?.('place');

      if (receipt.checkout_url) {
        useCartStore.getState().clear();
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
        toast.success(
          `${t('checkout.placed')} · ${queueLabel(receipt.queue_number)}`,
        );
      }

      navigate(`/t/${qrToken}/receipt?txn_id=${receipt.txn_id}`, {
        state: { receipt, placedAt: Date.now() },
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
              <span className="checkout-item-name">
                {line.name}
                {line.for_device_id ? (
                  <span className="checkout-item-for">
                    {t('people.forName', { name: companionName(session, line.for_device_id) })}
                  </span>
                ) : null}
              </span>
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
              <dd className="numeric">
                <Money value={quote.gross_amount} />
              </dd>
            </div>

            <AnimatePresence initial={false}>
              {quote.discount_applied && !deducting ? (
                <motion.div
                  key="vat-exempt"
                  className="checkout-total-row checkout-reveal"
                  {...ROW_REVEAL}
                >
                  <dt>{t('checkout.vatExempt')}</dt>
                  <dd className="numeric">
                    <Money value={quote.vat_exempt_sales} />
                  </dd>
                </motion.div>
              ) : null}
              {quote.discount_applied && !deducting ? (
                <motion.div
                  key="discount"
                  className="checkout-total-row checkout-discount-row checkout-reveal"
                  {...ROW_REVEAL}
                >
                  <dt className="checkout-discount">{t('checkout.discount')}</dt>
                  <dd className="checkout-discount numeric">
                    <Money value={quote.discount_amount} sign="−" />
                  </dd>
                </motion.div>
              ) : null}
              {!quote.discount_applied ? (
                <motion.div
                  key="vatable"
                  className="checkout-total-row checkout-reveal"
                  {...ROW_REVEAL}
                >
                  <dt>{t('checkout.vatable')}</dt>
                  <dd className="numeric">
                    <Money value={quote.vatable_sales} />
                  </dd>
                </motion.div>
              ) : null}
              {!quote.discount_applied ? (
                <motion.div
                  key="vat"
                  className="checkout-total-row checkout-reveal"
                  {...ROW_REVEAL}
                >
                  <dt>{t('checkout.vat')}</dt>
                  <dd className="numeric">
                    <Money value={quote.vat_amount} />
                  </dd>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <div className="checkout-total-row checkout-net-row">
              <dt className="checkout-net">{t('checkout.net')}</dt>
              <dd className="checkout-net numeric">
                <Money value={deducting ? quote.gross_amount : quote.net_amount} />
              </dd>
            </div>
          </dl>
        ) : null}

        {quote?.shares?.some((share) => share.pays_at_cashier) ? (
          <ul className="checkout-people">
            {quote.shares
              .filter((share) => share.pays_at_cashier)
              .map((share) => (
                <li key={share.device_id} className="checkout-person">
                  <span>{t('people.paysAtCashier', { name: share.display_name })}</span>
                  <span className="numeric">
                    <Money value={share.net_amount} />
                  </span>
                </li>
              ))}
          </ul>
        ) : null}

        <AnimatePresence initial={false}>
          {quote?.discount_applied && !deducting ? (
            <motion.p className="checkout-discount-note checkout-reveal" {...ROW_REVEAL}>
              {companionOnlyDiscount
                ? t('people.discountPending', { name: companionOnlyDiscount.display_name })
                : quote.discount_status === 'pending'
                  ? t('checkout.discountPending')
                  : t('priority.discountNote')}
            </motion.p>
          ) : null}
        </AnimatePresence>
      </section>

      <section className="payment-options-section">
        <h2 className="section-title-sm">{t('checkout.payment')}</h2>
        <div className="payment-card-grid">
          <button
            type="button"
            className={`payment-card${chosenMethod === 'cashier' ? ' selected' : ''}`}
            onClick={() => setMethod('cashier')}
          >
            <div className="payment-card-icon-wrap">
              <Store size={22} strokeWidth={1.75} />
            </div>
            <div className="payment-card-text">
              <span className="payment-card-title">{t('checkout.payAtCashier')}</span>
            </div>
            <div className="payment-card-check">
              {chosenMethod === 'cashier' ? <Check size={16} strokeWidth={2.5} /> : null}
            </div>
          </button>

          <button
            type="button"
            className={`payment-card${chosenMethod === 'online' ? ' selected' : ''}`}
            disabled={onlineBlocked}
            onClick={() => setMethod('online')}
          >
            <div className="payment-card-icon-wrap">
              <CreditCard size={22} strokeWidth={1.75} />
            </div>
            <div className="payment-card-text">
              <span className="payment-card-title">{t('checkout.payOnline')}</span>
              <span className="payment-card-hint">
                {onlineBlocked ? t('checkout.onlineNeedsId') : t('checkout.payOnlineHint')}
              </span>
            </div>
            <div className="payment-card-check">
              {chosenMethod === 'online' ? <Check size={16} strokeWidth={2.5} /> : null}
            </div>
          </button>

          <button
            type="button"
            className={`payment-card${chosenMethod === 'qrph' ? ' selected' : ''}`}
            disabled={onlineBlocked}
            onClick={() => setMethod('qrph')}
          >
            <div className="payment-card-icon-wrap">
              <QrCode size={22} strokeWidth={1.75} />
            </div>
            <div className="payment-card-text">
              <span className="payment-card-title">{t('checkout.payQrph')}</span>
              <span className="payment-card-hint">
                {onlineBlocked ? t('checkout.onlineNeedsId') : t('checkout.payQrphHint')}
              </span>
            </div>
            <div className="payment-card-check">
              {chosenMethod === 'qrph' ? <Check size={16} strokeWidth={2.5} /> : null}
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