import { Accessibility, ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router-dom';

import { listCategories, listItems } from '../../api/menu';
import ItemDetailSheet from '../../components/customer/ItemDetailSheet';
import MenuItemCard from '../../components/customer/MenuItemCard';
import Button from '../../components/shared/Button';
import Modal from '../../components/shared/Modal';
import { useShowcase } from '../../hooks/useShowcase';
import { flyToCart } from '../../lib/flyToCart';
import { DURATION, EASE_OUT, MOVE, OFFSET } from '../../lib/motion';
import { watchPinch } from '../../lib/pinch';
import { useCartStore } from '../../store/cartStore';
import { useSessionStore } from '../../store/sessionStore';
import { toast } from '../../store/toastStore';
import { MENU_SIZES, useUiStore } from '../../store/uiStore';

const MenuShowcase = lazy(() => import('../../components/customer/MenuShowcase'));

const NAME_BY_LANGUAGE = { en: 'name_en', fil: 'name_fil', bis: 'name_bis' };
const DESCRIPTION_BY_LANGUAGE = {
  en: 'description_en',
  fil: 'description_fil',
  bis: 'description_bis',
};

const GRID_SWAP = {
  enter: ({ dir, offset }) => ({ opacity: dir === 0 ? 1 : 0, x: dir * offset }),
  center: { opacity: 1, x: 0, transition: MOVE },
  exit: ({ dir, offset }) => ({
    opacity: 0,
    x: -dir * offset,
    transition: { duration: DURATION.enter, ease: EASE_OUT },
  }),
};

export default function CustomerMenuPage() {
  const { t, i18n } = useTranslation();
  const {
    observeItem,
    recordBack,
    activeCategory,
    setActiveCategory,
    trackControl,
    completed,
    openDeclaration,
  } = useOutletContext();
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [viewing, setViewing] = useState(null);
  const [picking, setPicking] = useState(false);
  const add = useCartStore((state) => state.add);
  const session = useSessionStore((state) => state.session);
  const menuSize = useUiStore((state) => state.display.menuSize);
  const setDisplay = useSessionStore((state) => state.setDisplay);
  const showcase = useShowcase();
  const tabsRef = useRef(null);
  const stageRef = useRef(null);
  const [shownCategory, setShownCategory] = useState(activeCategory);
  const [direction, setDirection] = useState(0);

  if (activeCategory !== shownCategory) {
    const from = categories.findIndex((category) => category.cat_id === shownCategory);
    const to = categories.findIndex((category) => category.cat_id === activeCategory);
    setDirection(from < 0 || to < 0 ? 0 : Math.sign(to - from));
    setShownCategory(activeCategory);
  }

  useEffect(() => {
    if (!session?.session_id) {
      return;
    }
    const key = `shaxian.declared_prompt.${session.session_id}`;
    try {
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        openDeclaration();
      }
    } catch { }
  }, [session?.session_id, openDeclaration]);

  useEffect(() => {
    function resize(step) {
      const current = MENU_SIZES.indexOf(useUiStore.getState().display.menuSize);
      const next = MENU_SIZES[current + step];
      if (!next) {
        return;
      }
      setDisplay({ menuSize: next }, 'pinch')
        .then(() => toast.info(t('display.sizeNow', { size: t(`display.sizes.${next}`) })))
        .catch((error) => toast.error(error.message));
    }
    return watchPinch(stageRef.current, { onIn: () => resize(1), onOut: () => resize(-1) });
  }, [setDisplay, t]);

  useEffect(() => {
    let cancelled = false;

    Promise.all([listCategories(), listItems()])
      .then(([nextCategories, nextItems]) => {
        if (cancelled) {
          return;
        }
        const visible = nextCategories.filter((category) => category.is_active);
        setCategories(visible);
        setItems(nextItems);
        setActiveCategory(visible[0]?.cat_id ?? null);
      })
      .catch((error) => toast.error(error.message));

    return () => {
      cancelled = true;
    };
  }, [setActiveCategory]);

  useEffect(() => {
    const strip = tabsRef.current;
    const tab = strip?.querySelector('[aria-selected="true"]');
    if (!tab) {
      return;
    }
    const left = tab.offsetLeft - strip.offsetLeft;
    if (left < strip.scrollLeft || left + tab.offsetWidth > strip.scrollLeft + strip.clientWidth) {
      strip.scrollTo({ left, behavior: 'smooth' });
    }
  }, [activeCategory]);

  const nameKey = NAME_BY_LANGUAGE[i18n.language] ?? 'name_en';
  const descriptionKey = DESCRIPTION_BY_LANGUAGE[i18n.language] ?? 'description_en';
  const shown = items.filter((item) => item.cat_id === activeCategory);
  const swap = { dir: direction, offset: menuSize === 'large' ? 0 : OFFSET.swap };

  function onAdd(item, qty = 1, photo = null) {
    completed?.('add');
    flyToCart(photo);
    add(
      {
        item_id: item.item_id,
        name: item[nameKey],
        price: item.price,
        image_filename: item.image_filename,
        model_filename: item.model_filename,
      },
      qty,
    );
    toast.success(`${item[nameKey]} · ${t('menu.addToCart')}`);
  }

  return (
    <main className="customer-page">
      <div className="customer-page-head">
        <h1>{t('menu.title')}</h1>
        <Button variant="secondary" icon={Accessibility} onClick={openDeclaration}>
          {t('priority.open')}
        </Button>
      </div>

      <button
        type="button"
        className="menu-category-picker"
        aria-haspopup="dialog"
        onClick={() => setPicking(true)}
      >
        <span className="menu-category-picker-text">
          <span className="menu-category-picker-label">{t('menu.category')}</span>
          <span className="menu-category-picker-name">
            {categories.find((category) => category.cat_id === activeCategory)?.[nameKey]}
          </span>
        </span>
        <ChevronDown size={22} strokeWidth={1.75} aria-hidden="true" />
      </button>

      <motion.div className="menu-category-tabs" role="tablist" ref={tabsRef} layoutScroll>
        {categories.map((category) => {
          const selected = category.cat_id === activeCategory;
          return (
            <button
              key={category.cat_id}
              type="button"
              role="tab"
              className="menu-category-tab"
              aria-selected={selected}
              onClick={() => setActiveCategory(category.cat_id)}
            >
              {selected ? (
                <motion.span
                  className="menu-category-tab-bar"
                  layoutId="menu-tab-bar"
                  transition={MOVE}
                  aria-hidden="true"
                />
              ) : null}
              {category[nameKey]}
            </button>
          );
        })}
      </motion.div>

      <div className="menu-grid-stage" ref={stageRef}>
        <AnimatePresence mode="popLayout" initial={false} custom={swap}>
          <motion.div
            key={activeCategory ?? 'none'}
            className="menu-grid"
            custom={swap}
            variants={GRID_SWAP}
            initial="enter"
            animate="center"
            exit="exit"
          >
            {shown.map((item, index) => (
              <MenuItemCard
                key={item.item_id}
                item={item}
                trackAdd={index === 0 ? trackControl : undefined}
                name={item[nameKey]}
                description={item[descriptionKey] ?? item.description_en}
                onAdd={onAdd}
                onOpen={setViewing}
                observeItem={observeItem}
              />
            ))}
            {shown.length === 0 ? <p className="customer-empty">{t('menu.empty')}</p> : null}
          </motion.div>
        </AnimatePresence>
      </div>

      {picking ? (
        <Modal sheet title={t('menu.chooseCategory')} onClose={() => setPicking(false)}>
          <div className="category-sheet-list">
            {categories.map((category) => (
              <button
                key={category.cat_id}
                type="button"
                className="category-sheet-option"
                aria-current={category.cat_id === activeCategory}
                onClick={() => {
                  setActiveCategory(category.cat_id);
                  setPicking(false);
                }}
              >
                {category[nameKey]}
                <span className="category-sheet-count">
                  {t('menu.dishCount', {
                    count: items.filter((item) => item.cat_id === category.cat_id).length,
                  })}
                </span>
              </button>
            ))}
          </div>
        </Modal>
      ) : null}

      {showcase ? (
        <Suspense fallback={null}>
          <MenuShowcase />
        </Suspense>
      ) : null}

      <AnimatePresence>
        {viewing ? (
          <ItemDetailSheet
            key={viewing.item_id}
            item={viewing}
            name={viewing[nameKey]}
            description={viewing[descriptionKey] ?? viewing.description_en}
            onAdd={(item, qty, photo) => {
              onAdd(item, qty, photo);
              setViewing(null);
            }}
            onClose={() => {
              setViewing(null);
              recordBack?.();
            }}
          />
        ) : null}
      </AnimatePresence>

    </main>
  );
}