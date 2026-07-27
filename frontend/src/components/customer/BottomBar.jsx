import { ClipboardList, ShoppingBag, UtensilsCrossed } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';

import { useCartStore } from '../../store/cartStore';

export default function BottomBar({ sessionPath, trackControl }) {
  const { t } = useTranslation();
  const count = useCartStore((state) => state.lines).reduce(
    (total, line) => total + line.quantity,
    0,
  );

  return (
    <nav className="bottom-bar">
      <NavLink to={`${sessionPath}/menu`} className="bottom-bar-item">
        <UtensilsCrossed size={20} strokeWidth={1.75} />
        {t('nav.menu')}
      </NavLink>
      <NavLink
        to={`${sessionPath}/cart`}
        className="bottom-bar-item"
        ref={trackControl?.('cart')}
      >
        <ShoppingBag size={20} strokeWidth={1.75} />
        {t('nav.cart')}
        {count > 0 ? <span className="bottom-bar-count numeric">{count}</span> : null}
      </NavLink>
      <NavLink to={`${sessionPath}/status`} className="bottom-bar-item">
        <ClipboardList size={20} strokeWidth={1.75} />
        {t('nav.status')}
      </NavLink>
    </nav>
  );
}
