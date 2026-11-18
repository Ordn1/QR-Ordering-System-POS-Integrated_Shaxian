import { Accessibility } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router-dom';

import { listCategories, listItems } from '../../api/menu';
import ItemDetailSheet from '../../components/customer/ItemDetailSheet';
import MenuItemCard from '../../components/customer/MenuItemCard';
import PriorityDeclaration from '../../components/customer/PriorityDeclaration';
import Button from '../../components/shared/Button';
import { useShowcase } from '../../hooks/useShowcase';
import { flyToCart } from '../../lib/flyToCart';
import { DURATION, EASE_OUT, MOVE, OFFSET } from '../../lib/motion';
import { useCartStore } from '../../store/cartStore';
import { useSessionStore } from '../../store/sessionStore';
import { toast } from '../../store/toastStore';
import { useUiStore } from '../../store/uiStore';

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
  const { observeItem, activeCategory, setActiveCategory, trackControl, completed } =
    useOutletContext();
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [declaring, setDeclaring] = useState(false);
  const [viewing, setViewing] = useState(null);
  const add = useCartStore((state) => state.add);
  const session = useSessionStore((state) => state.session);
  const accessible = useUiStore((state) => state.uiMode) === 'accessible';
  const showcase = useShowcase();
  const tabsRef = useRef(null);
  const [shownCategory, setShownCategory] = useState(activeCategory);
  const [direction, setDirection] = useState(0);

  if (activeCategory !== shownCategory) {
    const from = categories.findIndex((category) => category.cat_id === shownCategory);
    const to = categories.findIndex((category) => category.cat_id === activeCategory);
    setDirection(from < 0 || to < 0 ? 0 : Math.sign(to - from));
    setShownCategory(activeCategory);
  }

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
  const swap = { dir: direction, offset: accessible ? 0 : OFFSET.swap };

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
        <Button variant="secondary" icon={Accessibility} onClick={() => setDeclaring(true)}>
          {t('priority.open')}
        </Button>
      </div>

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

      <div className="menu-grid-stage">
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

      {declaring && session ? (
        <PriorityDeclaration onClose={() => setDeclaring(false)} />
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
            onClose={() => setViewing(null)}
          />
        ) : null}
      </AnimatePresence>

    </main>
  );
}
