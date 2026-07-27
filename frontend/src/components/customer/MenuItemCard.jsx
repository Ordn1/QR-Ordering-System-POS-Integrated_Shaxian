import { UtensilsCrossed } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { peso } from '../../lib/format';
import { menuImageUrl } from '../../lib/menuImage';
import Badge from '../shared/Badge';
import Button from '../shared/Button';

export default function MenuItemCard({
  item,
  name,
  description,
  onAdd,
  onOpen,
  observeItem,
  trackAdd,
}) {
  const { t } = useTranslation();
  const src = menuImageUrl(item.image_filename);

  return (
    <article className="menu-item-row" data-item-id={item.item_id} ref={observeItem}>
      {/* UIDesign.md §16: full-width row, image left. The photo is decorative —
          the name beside it already carries the item, so alt stays empty. */}
      <div className="menu-item-photo">
        {src ? (
          <img src={src} alt="" loading="lazy" />
        ) : (
          <UtensilsCrossed className="menu-item-photo-empty" size={24} strokeWidth={1.5} />
        )}
      </div>
      <div className="menu-item-body">
        <div className="menu-item-head">
          {/* The name opens the detail sheet. A real button rather than a click
              handler on the row, so it is reachable by keyboard and announced. */}
          <h3 className="menu-item-name">
            <button type="button" className="menu-item-open" onClick={() => onOpen(item)}>
              {name}
            </button>
          </h3>
          <span className="menu-item-price numeric">{peso(item.price)}</span>
        </div>
        {description ? <p className="menu-item-description">{description}</p> : null}
        <p className="menu-item-meta">
          {item.calories !== null ? t('menu.calories', { count: item.calories }) : null}
          {item.allergens ? ` · ${t('menu.allergens', { list: item.allergens })}` : null}
        </p>
        <div className="menu-item-side">
          {item.is_available ? (
            <Button
              variant="add-to-cart"
              ref={trackAdd?.('add')}
              onClick={() => onAdd(item)}
            >
              {t('menu.addToCart')}
            </Button>
          ) : (
            <Badge value="sold out" label={t('menu.soldOut')} />
          )}
        </div>
      </div>
    </article>
  );
}
