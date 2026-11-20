import {
  ALargeSmall,
  Accessibility,
  BellRing,
  Hash,
  MousePointerClick,
  Search,
  UserPlus,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';

import AssistOffer from '../../components/customer/AssistOffer';
import BottomBar from '../../components/customer/BottomBar';
import CodeKeypad from '../../components/customer/CodeKeypad';
import CompanionForm from '../../components/customer/CompanionForm';
import DisplaySheet from '../../components/customer/DisplaySheet';
import GroupBanner from '../../components/customer/GroupBanner';
import HelpSheet from '../../components/customer/HelpSheet';
import LanguageSwitch from '../../components/customer/LanguageSwitch';
import NavHighlight from '../../components/customer/NavHighlight';
import PriorityDeclaration from '../../components/customer/PriorityDeclaration';
import RecommendationOverlay from '../../components/customer/RecommendationOverlay';
import SearchOverlay from '../../components/customer/SearchOverlay';
import { useAssistance } from '../../hooks/useAssistance';
import { useConfusionSignals } from '../../hooks/useConfusionSignals';
import { useNavGuidance } from '../../hooks/useNavGuidance';
import { useWebSocket } from '../../hooks/useWebSocket';
import { listItems } from '../../api/menu';
import { readAssistance, requestAssistance, syncDeviceCart } from '../../api/sessions';
import { peso } from '../../lib/format';
import { cartPayload, useCartStore } from '../../store/cartStore';
import { useSessionStore } from '../../store/sessionStore';
import { toast } from '../../store/toastStore';

const NAME_BY_LANGUAGE = { en: 'name_en', fil: 'name_fil', bis: 'name_bis' };

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
  const [showDisplay, setShowDisplay] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showKeypad, setShowKeypad] = useState(false);
  const [declaring, setDeclaring] = useState(false);
  const [addingPerson, setAddingPerson] = useState(false);
  const openDeclaration = useCallback(() => setDeclaring(true), []);
  const [crewCall, setCrewCall] = useState(null);
  const crewStatus = useRef(null);
  const [allItems, setAllItems] = useState([]);
  const prevPathRef = useRef(pathname);

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
    syncDeviceCart(session.session_id, cartPayload(lines), i18n.language).catch(() => { });
  }, [session?.session_id, lines, i18n.language]);

  const sessionId = session?.session_id;

  const refreshCrewCall = useCallback(() => {
    if (!sessionId) {
      return;
    }
    readAssistance(sessionId)
      .then((next) => {
        if (crewStatus.current === 'open' && next?.status === 'acknowledged') {
          toast.success(t('crew.onTheWay'));
        }
        crewStatus.current = next?.status ?? null;
        setCrewCall(next);
      })
      .catch(() => { });
  }, [sessionId, t]);

  useEffect(() => {
    refreshCrewCall();
  }, [refreshCrewCall]);

  const callCrew = useCallback(
    async (reason = 'asked') => {
      try {
        const next = await requestAssistance(sessionId, reason);
        crewStatus.current = next.status;
        setCrewCall(next);
        toast.success(t('crew.called'));
        return next;
      } catch (error) {
        toast.error(error.message);
        return null;
      }
    },
    [sessionId, t],
  );

  const handleSocketMessage = useCallback(
    (payload) => {
      if (payload?.type === 'session_changed') {
        refreshSession();
      }
      if (payload?.type === 'assistance_changed') {
        refreshCrewCall();
      }
    },
    [refreshSession, refreshCrewCall],
  );

  useWebSocket(
    session
      ? `/ws/orders/${session.session_id}?device=${session.device_token}`
      : null,
    handleSocketMessage,
  );

  const assistance = useAssistance({
    sessionId,
    screenId: routeOf(pathname),
    onCrew: callCrew,
  });
  const proposeCrew = useCallback(() => assistance.propose('crew'), [assistance]);

  const { suggestions, observeItem, recordBack, accept, dismiss } = useConfusionSignals({
    sessionId: session?.session_id,
    language: i18n.language,
    cart: lines.map((line) => line.item_id),
    activeCategory,
    triggerCount: session?.trigger_count,
    lastTriggerAt: session?.last_trigger_at,
    onEscalate: proposeCrew,
  });

  useEffect(() => {
    const prev = prevPathRef.current;
    if (prev !== pathname && !prev.endsWith('/menu') && pathname.endsWith('/menu')) {
      recordBack();
    }
    prevPathRef.current = pathname;
  }, [pathname, recordBack]);

  const guidance = useNavGuidance({
    route: routeOf(pathname),
    cartCount: lines.length,
  });

  const nameKey = NAME_BY_LANGUAGE[i18n.language] ?? 'name_en';

  function addItem(item, quantity = 1) {
    const name = item[nameKey] || item.name_en;
    add(
      {
        item_id: item.item_id,
        name,
        price: item.price,
        image_filename: item.image_filename,
        model_filename: item.model_filename,
      },
      quantity,
    );
    guidance.completed('add');
    toast.success(`${name} · ${t('menu.addToCart')}`);
  }

  const helpActions = [
    {
      key: 'guide',
      icon: MousePointerClick,
      title: t('help.guideTitle'),
      body: t('help.guideBody'),
      onSelect: () => {
        if (routeOf(pathname) !== 'menu' && lines.length === 0) {
          navigate(`/t/${qrToken}/menu`);
        }
        guidance.askForHelp();
      },
    },
    {
      key: 'code',
      icon: Hash,
      title: t('help.codeTitle'),
      body: t('help.codeBody'),
      onSelect: () => setShowKeypad(true),
    },
    {
      key: 'display',
      icon: ALargeSmall,
      title: t('help.displayTitle'),
      body: t('help.displayBody'),
      onSelect: () => setShowDisplay(true),
    },
    {
      key: 'crew',
      icon: BellRing,
      title: t('help.crewTitle'),
      body:
        crewCall?.status === 'open'
          ? t('crew.coming', { number: session?.table_number })
          : t('help.crewBody'),
      disabled: crewCall?.status === 'open',
      onSelect: () => callCrew('asked'),
    },
    {
      key: 'priority',
      icon: Accessibility,
      title: t('help.priorityTitle'),
      body: t('help.priorityBody'),
      onSelect: openDeclaration,
    },
    {
      key: 'person',
      icon: UserPlus,
      title: t('help.personTitle'),
      body: t('help.personBody'),
      onSelect: () => setAddingPerson(true),
    },
  ];

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
            aria-label={t('keypad.title')}
            onClick={() => setShowKeypad(true)}
          >
            <Hash size={20} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className="header-icon-btn"
            aria-label={t('search.title')}
            onClick={() => setShowSearch(true)}
          >
            <Search size={20} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className="header-icon-btn"
            aria-label={t('display.title')}
            onClick={() => setShowDisplay(true)}
          >
            <ALargeSmall size={22} strokeWidth={1.75} />
          </button>
          <LanguageSwitch />
        </div>
      </header>

      <GroupBanner session={session} />

      {crewCall?.status === 'open' ? (
        <div className="crew-strip" role="status">
          <BellRing size={20} strokeWidth={1.75} aria-hidden="true" />
          {t('crew.coming', { number: session.table_number })}
        </div>
      ) : null}

      <Outlet
        context={{
          observeItem,
          recordBack,
          activeCategory,
          setActiveCategory,
          trackControl: guidance.trackControl,
          completed: guidance.completed,
          openDeclaration,
          addPerson: () => setAddingPerson(true),
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
              image_filename: suggestion.image_filename,
              model_filename: suggestion.model_filename,
            });
            accept(suggestion);
            toast.success(`${suggestion.name} · ${t('menu.addToCart')}`);
          }}
        />
      ) : null}

      <NavHighlight target={guidance.target} onDismiss={guidance.clear} />

      <AssistOffer
        offer={assistance.offer}
        undo={assistance.undo}
        onAccept={assistance.accept}
        onDecline={assistance.decline}
        onUndo={assistance.revert}
      />

      {totalCount > 0 && routeOf(pathname) === 'menu' && !assistance.offer && !assistance.undo ? (
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

      <BottomBar
        sessionPath={`/t/${qrToken}`}
        trackControl={guidance.trackControl}
        onHelp={() => setShowHelp(true)}
      />

      {showDisplay ? <DisplaySheet onClose={() => setShowDisplay(false)} /> : null}

      {showHelp ? <HelpSheet actions={helpActions} onClose={() => setShowHelp(false)} /> : null}

      {showKeypad ? (
        <CodeKeypad
          items={allItems}
          nameKey={nameKey}
          sessionId={session.session_id}
          onAdd={addItem}
          onClose={() => setShowKeypad(false)}
        />
      ) : null}

      {declaring ? <PriorityDeclaration onClose={() => setDeclaring(false)} /> : null}

      {addingPerson ? <CompanionForm onClose={() => setAddingPerson(false)} /> : null}

      {showSearch ? (
        <SearchOverlay
          items={allItems}
          language={i18n.language}
          onSelect={(item) => addItem(item)}
          onClose={() => setShowSearch(false)}
        />
      ) : null}
    </div>
  );
}