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
      <NavLink
        to={`${sessionPath}/menu`}
        className={({ isActive }) => `bottom-bar-item${isActive ? ' active' : ''}`}
      >
        <UtensilsCrossed size={20} strokeWidth={1.75} />
        <span>{t('nav.menu')}</span>
      </NavLink>
      <NavLink
        to={`${sessionPath}/cart`}
        className={({ isActive }) => `bottom-bar-item${isActive ? ' active' : ''}`}
        ref={trackControl?.('cart')}
      >
        <ShoppingBag size={20} strokeWidth={1.75} />
        <span>{t('nav.cart')}</span>
        {count > 0 ? <span className="bottom-bar-count numeric">{count}</span> : null}
      </NavLink>
      <NavLink
        to={`${sessionPath}/status`}
        className={({ isActive }) => `bottom-bar-item${isActive ? ' active' : ''}`}
      >
        <ClipboardList size={20} strokeWidth={1.75} />
        <span>{t('nav.status')}</span>
      </NavLink>
    </nav>
  );
}
