import { Accessibility } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router-dom';

import { listCategories, listItems } from '../../api/menu';
import ItemDetailSheet from '../../components/customer/ItemDetailSheet';
import MenuItemCard from '../../components/customer/MenuItemCard';
import PriorityDeclaration from '../../components/customer/PriorityDeclaration';
import Button from '../../components/shared/Button';
import { useCartStore } from '../../store/cartStore';
import { useSessionStore } from '../../store/sessionStore';
import { toast } from '../../store/toastStore';

const NAME_BY_LANGUAGE = { en: 'name_en', fil: 'name_fil', bis: 'name_bis' };
const DESCRIPTION_BY_LANGUAGE = {
  en: 'description_en',
  fil: 'description_fil',
  bis: 'description_bis',
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

  const nameKey = NAME_BY_LANGUAGE[i18n.language] ?? 'name_en';
  const descriptionKey = DESCRIPTION_BY_LANGUAGE[i18n.language] ?? 'description_en';
  const shown = items.filter((item) => item.cat_id === activeCategory);

  function onAdd(item) {
    completed?.('add');
    add({ item_id: item.item_id, name: item[nameKey], price: item.price });
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

      <div className="menu-category-tabs" role="tablist">
        {categories.map((category) => (
          <button
            key={category.cat_id}
            type="button"
            role="tab"
            className="menu-category-tab"
            aria-selected={category.cat_id === activeCategory}
            onClick={() => setActiveCategory(category.cat_id)}
          >
            {category[nameKey]}
          </button>
        ))}
      </div>

      <div className="menu-grid">
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
      </div>

      {declaring && session ? (
        <PriorityDeclaration onClose={() => setDeclaring(false)} />
      ) : null}

      {viewing ? (
        <ItemDetailSheet
          item={viewing}
          name={viewing[nameKey]}
          description={viewing[descriptionKey] ?? viewing.description_en}
          onAdd={(item) => {
            onAdd(item);
            setViewing(null);
          }}
          onClose={() => setViewing(null)}
        />
      ) : null}

    </main>
  );
}
