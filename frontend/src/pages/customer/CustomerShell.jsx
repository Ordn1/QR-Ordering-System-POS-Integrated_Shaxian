import { HelpCircle } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom';

import BottomBar from '../../components/customer/BottomBar';
import GroupBanner from '../../components/customer/GroupBanner';
import LanguageSwitch from '../../components/customer/LanguageSwitch';
import NavHighlight from '../../components/customer/NavHighlight';
import RecommendationOverlay from '../../components/customer/RecommendationOverlay';
import { useConfusionSignals } from '../../hooks/useConfusionSignals';
import { useNavGuidance } from '../../hooks/useNavGuidance';
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
  const { t, i18n } = useTranslation();
  const session = useSessionStore((state) => state.session);
  const lines = useCartStore((state) => state.lines);
  const add = useCartStore((state) => state.add);
  const [activeCategory, setActiveCategory] = useState(null);

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
    return <Navigate to={`/t/${qrToken}`} replace />;
  }

  return (
    <div className="customer-shell">
      <header className="customer-header">
        <span className="customer-table">{t('menu.table', { number: session.table_number })}</span>
        <LanguageSwitch />
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

      <BottomBar sessionPath={`/t/${qrToken}`} trackControl={guidance.trackControl} />
    </div>
  );
}
