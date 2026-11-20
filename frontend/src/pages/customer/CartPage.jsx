import { Split, UserPlus, Users, UtensilsCrossed } from 'lucide-react';
import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';

import { fetchTableCart, syncDeviceCart } from '../../api/sessions';
import Button from '../../components/shared/Button';
import Money from '../../components/shared/Money';
import IconButton from '../../components/shared/IconButton';
import QtyStepper from '../../components/shared/QtyStepper';
import { useShowcase } from '../../hooks/useShowcase';
import { useWebSocket } from '../../hooks/useWebSocket';
import { peso } from '../../lib/format';
import { menuImageUrl } from '../../lib/menuImage';
import { cartPayload, lineKey, useCartStore } from '../../store/cartStore';
import { toast } from '../../store/toastStore';
import { useSessionStore } from '../../store/sessionStore';

const CartTray = lazy(() => import('../../components/customer/CartTray'));

export default function CartPage() {
  const { t, i18n } = useTranslation();
  const showcase = useShowcase();
  const { qrToken } = useParams();
  const navigate = useNavigate();
  const { trackControl, addPerson } = useOutletContext();
  const removeCompanion = useSessionStore((state) => state.removeCompanion);
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
        await syncDeviceCart(session.session_id, cartPayload(lines), i18n.language);
      }
    } catch {
    } finally {
      setNavigating(false);
    }
    const scopeParam =
      targetScope || (session?.group_mode ? 'split' : 'single');
    navigate(`/t/${qrToken}/checkout?scope=${scopeParam}`);
  }

  const companions = session?.companions ?? [];
  const groups = [
    { id: null, title: companions.length ? t('people.me') : null },
    ...companions.map((person) => ({
      id: person.device_id,
      title: `${person.display_name} · ${t(`people.status.${person.declared_status}`)}`,
    })),
  ]
    .map((group) => ({
      ...group,
      lines: lines.filter((line) => (line.for_device_id ?? null) === group.id),
    }))
    .filter((group) => group.lines.length > 0);

  const hasActiveSplit = tableCart?.active_txn_id != null;
  const unpaidTotal = Number(tableCart?.unpaid_total ?? 0);
  const myServerShare = Number(tableCart?.my_share_total ?? 0);
  const showSplitBanner = session?.group_mode || hasActiveSplit || unpaidTotal > 0;

  return (
    <main className="customer-page">
      <div className="customer-page-head">
        <h1>{t('cart.title')}</h1>
      </div>

      {showcase ? (
        <Suspense fallback={null}>
          <CartTray lines={lines} />
        </Suspense>
      ) : null}

      {showSplitBanner && lines.length === 0 ? (
        <div className="split-active-banner">
          <div className="split-active-banner-content">
            <Split size={20} strokeWidth={1.75} />
            <div>
              <p className="split-active-banner-title">
                {hasActiveSplit
                  ? t('cart.activeSplitOrder')
                  : t('cart.groupModeHint')}
              </p>
              {unpaidTotal > 0 ? (
                <p className="split-active-banner-hint">
                  {t('cart.unpaidBalance')} <Money value={unpaidTotal} />
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
                {t('cart.checkoutMyShare', { amount: peso(myServerShare) })}
              </Button>
            ) : unpaidTotal > 0 ? (
              <Button
                variant="checkout"
                loading={navigating}
                onClick={() => handleGoToCheckout('table')}
              >
                {t('cart.checkoutTable', { amount: peso(unpaidTotal) })}
              </Button>
            ) : null}
            <Button
              variant="secondary"
              onClick={() => navigate(`/t/${qrToken}/split`)}
            >
              {t('cart.splitBill')}
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
          {groups.map((group) => (
            <section className="cart-group" key={group.id ?? 'me'}>
              {group.title ? <h2 className="cart-group-title">{group.title}</h2> : null}
              <ul className="cart-list">
                {group.lines.map((line) => {
                  const src = menuImageUrl(line.image_filename);
                  return (
                    <li className="cart-line" key={lineKey(line)}>
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
                            <Money value={Number(line.price) * line.quantity} />
                          </span>
                        </div>
                        <div className="cart-line-controls">
                          <QtyStepper
                            value={line.quantity}
                            onChange={(next) => setQuantity(line.item_id, next, line.for_device_id)}
                            itemLabel={line.name}
                          />
                          <IconButton
                            variant="remove"
                            label={t('cart.remove', { name: line.name })}
                            onClick={() => remove(line.item_id, line.for_device_id)}
                          />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          <div className="cart-summary-card">
            <div className="cart-summary-row">
              <span>{t('cart.itemCount', { count })}</span>
              <span className="numeric font-bold">
                <Money value={subtotal} />
              </span>
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
                  ? t('cart.checkoutMyShare', { amount: peso(subtotal) })
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
                    {t('cart.payWholeTable')}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => navigate(`/t/${qrToken}/split`)}
                  >
                    {t('cart.splitBill')}
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </>
      )}
      <section className="cart-people">
        <h2 className="cart-group-title">{t('people.title')}</h2>
        {companions.length ? (
          <ul className="cart-people-list">
            {companions.map((person) => (
              <li key={person.device_id} className="cart-person">
                <span className="cart-person-name">
                  {person.display_name} · {t(`people.status.${person.declared_status}`)}
                  <span className="cart-person-note">{t(`people.discount.${person.discount_status}`)}</span>
                </span>
                {person.has_ordered ? null : (
                  <IconButton
                    variant="remove"
                    label={t('people.remove', { name: person.display_name })}
                    onClick={() =>
                      removeCompanion(person.device_id).catch((error) => toast.error(error.message))
                    }
                  />
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="cart-person-note">{t('people.none')}</p>
        )}
        <Button variant="secondary" icon={UserPlus} onClick={addPerson}>
          {t('people.add')}
        </Button>
      </section>
    </main>
  );
}