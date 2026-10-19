import { HelpCircle, Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';

import BottomBar from '../../components/customer/BottomBar';
import GroupBanner from '../../components/customer/GroupBanner';
import LanguageSwitch from '../../components/customer/LanguageSwitch';
import NavHighlight from '../../components/customer/NavHighlight';
import RecommendationOverlay from '../../components/customer/RecommendationOverlay';
import SearchOverlay from '../../components/customer/SearchOverlay';
import { useConfusionSignals } from '../../hooks/useConfusionSignals';
import { useNavGuidance } from '../../hooks/useNavGuidance';
import { useWebSocket } from '../../hooks/useWebSocket';
import { listItems } from '../../api/menu';
import { syncDeviceCart } from '../../api/sessions';
import { peso } from '../../lib/format';
import { useCartStore } from '../../store/cartStore';
import { useSessionStore } from '../../store/sessionStore';
import { toast } from '../../store/toastStore';

function routeOf(pathname) {
  if (pathname.endsWith('/checkout')) {
    return 'checkout';
  }
  if (pathname.endsWith('/cart')) {
    return 'cart';
  }
  return 'menu';
}

export default function CustomerShell() {
  const { qrToken } = useParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const session = useSessionStore((state) => state.session);
  const status = useSessionStore((state) => state.status);
  const openSession = useSessionStore((state) => state.open);
  const refreshSession = useSessionStore((state) => state.refresh);
  const lines = useCartStore((state) => state.lines);
  const add = useCartStore((state) => state.add);
  const [activeCategory, setActiveCategory] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [allItems, setAllItems] = useState([]);

  const totalCount = lines.reduce((total, line) => total + line.quantity, 0);
  const totalSubtotal = lines.reduce(
    (total, line) => total + Number(line.price) * line.quantity,
    0,
  );

  useEffect(() => {
    listItems()
      .then(setAllItems)
      .catch(() => { });
  }, []);

  useEffect(() => {
    if (!session && status === 'idle' && qrToken) {
      openSession(qrToken).catch(() => { });
    }
  }, [session, status, qrToken, openSession]);

  useEffect(() => {
    if (!session?.session_id) {
      return;
    }
    syncDeviceCart(
      session.session_id,
      lines.map((line) => ({ item_id: line.item_id, quantity: line.quantity })),
      i18n.language,
    ).catch(() => { });
  }, [session?.session_id, lines, i18n.language]);

  const handleSocketMessage = useCallback(
    (payload) => {
      if (payload?.type === 'session_changed') {
        refreshSession();
      }
    },
    [refreshSession],
  );

  useWebSocket(
    session
      ? `/ws/orders/${session.session_id}?device=${session.device_token}`
      : null,
    handleSocketMessage,
  );

  const { suggestions, observeItem, accept, dismiss } = useConfusionSignals({
    sessionId: session?.session_id,
    language: i18n.language,
    cart: lines.map((line) => line.item_id),
    activeCategory,
    triggerCount: session?.trigger_count,
    lastTriggerAt: session?.last_trigger_at,
  });

  const guidance = useNavGuidance({
    route: routeOf(pathname),
    cartCount: lines.length,
  });

  if (!session) {
    if (status === 'failed') {
      return <Navigate to={`/t/${qrToken}`} replace />;
    }
    return (
      <main className="entry-page">
        <div className="entry-status-wrap">
          <span className="btn-spinner entry-spinner" role="status" aria-label="Loading" />
          <p className="entry-note">{t('entry.starting')}</p>
        </div>
      </main>
    );
  }

  return (
    <div className="customer-shell">
      <header className="customer-header">
        <span className="customer-table">{t('menu.table', { number: session.table_number })}</span>
        <div className="customer-header-actions">
          <button
            type="button"
            className="header-icon-btn"
            aria-label={t('search.title')}
            onClick={() => setShowSearch(true)}
          >
            <Search size={20} strokeWidth={1.75} />
          </button>
          <LanguageSwitch />
        </div>
      </header>

      <GroupBanner session={session} />

      <Outlet
        context={{
          observeItem,
          activeCategory,
          setActiveCategory,
          trackControl: guidance.trackControl,
          completed: guidance.completed,
        }}
      />

      {suggestions ? (
        <RecommendationOverlay
          suggestions={suggestions}
          onDismiss={dismiss}
          onAccept={(suggestion) => {
            add({
              item_id: suggestion.item_id,
              name: suggestion.name,
              price: suggestion.price,
            });
            accept(suggestion);
            toast.success(`${suggestion.name} · ${t('menu.addToCart')}`);
          }}
        />
      ) : null}

      <NavHighlight target={guidance.target} onDismiss={guidance.clear} />

      <button
        type="button"
        className="help-fab"
        aria-label={t('guide.help')}
        onClick={guidance.askForHelp}
      >
        <HelpCircle size={22} strokeWidth={1.75} aria-hidden="true" />
      </button>

      {totalCount > 0 && routeOf(pathname) === 'menu' ? (
        <div className="floating-cart-pill-wrap">
          <button
            type="button"
            className="floating-cart-pill"
            onClick={() => navigate(`/t/${qrToken}/cart`)}
          >
            <span className="floating-cart-count numeric">{totalCount}</span>
            <span className="floating-cart-label">
              {t('cart.viewBasket', { defaultValue: 'View Basket' })}
            </span>
            <span className="floating-cart-price numeric">{peso(totalSubtotal)}</span>
          </button>
        </div>
      ) : null}

      <BottomBar sessionPath={`/t/${qrToken}`} trackControl={guidance.trackControl} />

      {showSearch ? (
        <SearchOverlay
          items={allItems}
          language={i18n.language}
          onSelect={(item) => {
            const nameKey = { en: 'name_en', fil: 'name_fil', bis: 'name_bis' }[i18n.language] ?? 'name_en';
            add({
              item_id: item.item_id,
              name: item[nameKey] || item.name_en,
              price: item.price,
              image_filename: item.image_filename,
            });
            toast.success(`${item[nameKey] || item.name_en} · ${t('menu.addToCart')}`);
          }}
          onClose={() => setShowSearch(false)}
        />
      ) : null}
    </div>
  );
}