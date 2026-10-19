import { Split, Users, UtensilsCrossed } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';

import { fetchTableCart, syncDeviceCart } from '../../api/sessions';
import Button from '../../components/shared/Button';
import IconButton from '../../components/shared/IconButton';
import QtyStepper from '../../components/shared/QtyStepper';
import { useWebSocket } from '../../hooks/useWebSocket';
import { peso } from '../../lib/format';
import { menuImageUrl } from '../../lib/menuImage';
import { useCartStore } from '../../store/cartStore';
import { useSessionStore } from '../../store/sessionStore';

export default function CartPage() {
  const { t, i18n } = useTranslation();
  const { qrToken } = useParams();
  const navigate = useNavigate();
  const { trackControl } = useOutletContext();
  const session = useSessionStore((state) => state.session);
  const lines = useCartStore((state) => state.lines);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const remove = useCartStore((state) => state.remove);

  const [tableCart, setTableCart] = useState(null);
  const [navigating, setNavigating] = useState(false);

  const count = lines.reduce((total, line) => total + line.quantity, 0);
  const subtotal = lines.reduce(
    (total, line) => total + Number(line.price) * line.quantity,
    0,
  );

  const loadTableCart = useCallback(() => {
    if (!session?.session_id) {
      return;
    }
    fetchTableCart(session.session_id, i18n.language)
      .then(setTableCart)
      .catch(() => { });
  }, [session?.session_id, i18n.language]);

  useEffect(() => {
    loadTableCart();
  }, [loadTableCart, lines]);

  useWebSocket(
    session
      ? `/ws/orders/${session.session_id}?device=${session.device_token}`
      : null,
    useCallback(
      (payload) => {
        if (
          payload?.type === 'cart_changed' ||
          payload?.type === 'session_changed' ||
          payload?.type === 'order_status'
        ) {
          loadTableCart();
        }
      },
      [loadTableCart],
    ),
  );

  async function handleGoToCheckout(targetScope) {
    if (!session?.session_id) {
      return;
    }
    setNavigating(true);
    try {
      if (lines.length > 0) {
        await syncDeviceCart(
          session.session_id,
          lines.map((line) => ({ item_id: line.item_id, quantity: line.quantity })),
          i18n.language,
        );
      }
    } catch {
    } finally {
      setNavigating(false);
    }
    const scopeParam =
      targetScope || (session?.group_mode ? 'split' : 'single');
    navigate(`/t/${qrToken}/checkout?scope=${scopeParam}`);
  }

  const hasActiveSplit = tableCart?.active_txn_id != null;
  const unpaidTotal = Number(tableCart?.unpaid_total ?? 0);
  const myServerShare = Number(tableCart?.my_share_total ?? 0);
  const showSplitBanner = session?.group_mode || hasActiveSplit || unpaidTotal > 0;

  return (
    <main className="customer-page">
      <div className="customer-page-head">
        <h1>{t('cart.title')}</h1>
      </div>

      {showSplitBanner && lines.length === 0 ? (
        <div className="split-active-banner">
          <div className="split-active-banner-content">
            <Split size={20} strokeWidth={1.75} />
            <div>
              <p className="split-active-banner-title">
                {hasActiveSplit
                  ? t('cart.activeSplitOrder', { defaultValue: 'Active table order in progress' })
                  : t('cart.groupModeHint', { defaultValue: 'Multiple phones are ordering at this table' })}
              </p>
              {unpaidTotal > 0 ? (
                <p className="split-active-banner-hint">
                  Table unpaid balance: {peso(unpaidTotal)}
                </p>
              ) : null}
            </div>
          </div>
          <div className="cart-actions">
            {myServerShare > 0 ? (
              <Button
                variant="checkout"
                loading={navigating}
                onClick={() => handleGoToCheckout('split')}
              >
                {t('cart.checkout')} (My share · {peso(myServerShare)})
              </Button>
            ) : unpaidTotal > 0 ? (
              <Button
                variant="checkout"
                loading={navigating}
                onClick={() => handleGoToCheckout('table')}
              >
                {t('cart.checkout')} (Table · {peso(unpaidTotal)})
              </Button>
            ) : null}
            <Button
              variant="secondary"
              onClick={() => navigate(`/t/${qrToken}/split`)}
            >
              {t('cart.splitBill', { defaultValue: 'Split the Bill' })}
            </Button>
          </div>
        </div>
      ) : null}

      {lines.length === 0 ? (
        <div className="customer-empty">
          <p>{t('cart.empty')}</p>
          <Button variant="secondary" onClick={() => navigate(`/t/${qrToken}/menu`)}>
            {t('cart.browse')}
          </Button>
        </div>
      ) : (
        <>
          <ul className="cart-list">
            {lines.map((line) => {
              const src = menuImageUrl(line.image_filename);
              return (
                <li className="cart-line" key={line.item_id}>
                  <div className="cart-line-thumb">
                    {src ? (
                      <img src={src} alt="" loading="lazy" />
                    ) : (
                      <UtensilsCrossed className="menu-item-photo-empty" size={20} strokeWidth={1.5} />
                    )}
                  </div>
                  <div className="cart-line-info">
                    <div className="cart-line-head">
                      <span className="cart-line-name">{line.name}</span>
                      <span className="cart-line-price numeric">
                        {peso(Number(line.price) * line.quantity)}
                      </span>
                    </div>
                    <div className="cart-line-controls">
                      <QtyStepper
                        value={line.quantity}
                        onChange={(next) => setQuantity(line.item_id, next)}
                        itemLabel={line.name}
                      />
                      <IconButton
                        variant="remove"
                        label={t('cart.remove', { name: line.name })}
                        onClick={() => remove(line.item_id)}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="cart-summary-card">
            <div className="cart-summary-row">
              <span>{t('cart.itemCount', { count })}</span>
              <span className="numeric font-bold">{peso(subtotal)}</span>
            </div>
            <div className="cart-actions">
              <Button
                variant="checkout"
                loading={navigating}
                ref={trackControl?.('checkout')}
                onClick={() =>
                  handleGoToCheckout(session?.group_mode ? 'split' : 'single')
                }
              >
                {session?.group_mode
                  ? `${t('cart.checkout')} (My share · ${peso(subtotal)})`
                  : t('cart.checkout')}
              </Button>
              {session?.group_mode ? (
                <>
                  <Button
                    variant="secondary"
                    icon={Users}
                    loading={navigating}
                    onClick={() => handleGoToCheckout('table')}
                  >
                    Pay for entire table
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => navigate(`/t/${qrToken}/split`)}
                  >
                    {t('cart.splitBill', { defaultValue: 'Split the Bill' })}
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </>
      )}
    </main>
  );
}