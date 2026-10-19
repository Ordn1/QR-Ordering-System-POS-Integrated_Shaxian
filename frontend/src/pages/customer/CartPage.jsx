import { Split, UtensilsCrossed } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';

import { fetchTableCart } from '../../api/sessions';
import Button from '../../components/shared/Button';
import IconButton from '../../components/shared/IconButton';
import QtyStepper from '../../components/shared/QtyStepper';
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

  const [activeSplitTxn, setActiveSplitTxn] = useState(null);

  const count = lines.reduce((total, line) => total + line.quantity, 0);
  const subtotal = lines.reduce(
    (total, line) => total + Number(line.price) * line.quantity,
    0,
  );

  const checkForActiveSplit = useCallback(() => {
    if (!session?.session_id) {
      return;
    }
    fetchTableCart(session.session_id, i18n.language)
      .then((cart) => {
        if (cart?.active_txn_id) {
          setActiveSplitTxn(cart);
        } else {
          setActiveSplitTxn(null);
        }
      })
      .catch(() => {});
  }, [session?.session_id, i18n.language]);

  useEffect(() => {
    checkForActiveSplit();
  }, [checkForActiveSplit]);

  const hasActiveSplit = activeSplitTxn?.active_txn_id != null;
  const showSplitBanner = session?.group_mode || hasActiveSplit;

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
                  ? t('cart.activeSplitOrder', { defaultValue: 'Active split order in progress' })
                  : t('cart.groupModeHint', { defaultValue: 'Multiple phones are at this table' })}
              </p>
              {hasActiveSplit ? (
                <p className="split-active-banner-hint">
                  {t('cart.splitUnpaidHint', {
                    defaultValue: 'Some shares may still need payment.',
                    amount: peso(activeSplitTxn?.unpaid_total ?? 0),
                  })}
                </p>
              ) : null}
            </div>
          </div>
          <Button
            variant="checkout"
            onClick={() => navigate(`/t/${qrToken}/split`)}
          >
            {t('cart.splitBill', { defaultValue: 'Split the Bill' })}
          </Button>
        </div>
      ) : null}

      {lines.length === 0 ? (
        <div className="customer-empty">
          <p>{t('cart.empty')}</p>
          <Button variant="secondary" onClick={() => navigate(`/t/${qrToken}/menu`)}>
            {t('cart.browse')}
          </Button>
        </div>
      ) : null}

      {lines.length > 0 ? (
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
                ref={trackControl?.('checkout')}
                onClick={() => navigate(`/t/${qrToken}/checkout`)}
              >
                {t('cart.checkout')}
              </Button>
              {session?.group_mode ? (
                <Button variant="secondary" onClick={() => navigate(`/t/${qrToken}/split`)}>
                  {t('cart.splitBill', { defaultValue: 'Split the Bill' })}
                </Button>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </main>
  );
}
