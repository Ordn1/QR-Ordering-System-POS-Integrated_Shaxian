import { useTranslation } from 'react-i18next';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';

import Button from '../../components/shared/Button';
import IconButton from '../../components/shared/IconButton';
import QtyStepper from '../../components/shared/QtyStepper';
import { peso } from '../../lib/format';
import { useCartStore } from '../../store/cartStore';
import { useSessionStore } from '../../store/sessionStore';

export default function CartPage() {
  const { t } = useTranslation();
  const { qrToken } = useParams();
  const navigate = useNavigate();
  const { trackControl } = useOutletContext();
  const session = useSessionStore((state) => state.session);
  const lines = useCartStore((state) => state.lines);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const remove = useCartStore((state) => state.remove);

  const count = lines.reduce((total, line) => total + line.quantity, 0);
  const subtotal = lines.reduce(
    (total, line) => total + Number(line.price) * line.quantity,
    0,
  );

  return (
    <main className="customer-page">
      <div className="customer-page-head">
        <h1>{t('cart.title')}</h1>
      </div>

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
            {lines.map((line) => (
              <li className="cart-line" key={line.item_id}>
                <div className="cart-line-body">
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
              </li>
            ))}
          </ul>

          <div className="cart-totals">
            <span>{t('cart.itemCount', { count })}</span>
            <span className="numeric">{peso(subtotal)}</span>
          </div>

          <Button
            variant="checkout"
            ref={trackControl?.('checkout')}
            onClick={() => navigate(`/t/${qrToken}/checkout`)}
          >
            {t('cart.checkout')}
          </Button>
          {session?.group_mode ? (
            <Button variant="secondary" onClick={() => navigate(`/t/${qrToken}/split`)}>
              {t('cart.splitBill')}
            </Button>
          ) : null}
        </>
      )}
    </main>
  );
}
