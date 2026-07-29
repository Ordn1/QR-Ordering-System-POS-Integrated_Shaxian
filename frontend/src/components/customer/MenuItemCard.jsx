import { Plus, UtensilsCrossed } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { peso } from '../../lib/format';
import { menuImageUrl } from '../../lib/menuImage';
import Badge from '../shared/Badge';

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
    <article className="menu-card" data-item-id={item.item_id} ref={observeItem}>
      {/* Tappable card body opens the detail sheet */}
      <button
        type="button"
        className="menu-card-tap"
        onClick={() => onOpen(item)}
        aria-label={name}
      >
        <div className="menu-card-photo">
          {src ? (
            <img src={src} alt="" loading="lazy" />
          ) : (
            <UtensilsCrossed className="menu-card-photo-empty" size={28} strokeWidth={1.5} />
          )}
        </div>
        <div className="menu-card-body">
          <h3 className="menu-card-name">{name}</h3>
          {description ? <p className="menu-card-desc">{description}</p> : null}
        </div>
      </button>
      <div className="menu-card-footer">
        <span className="menu-card-price numeric">{peso(item.price)}</span>
        {item.is_available ? (
          <button
            type="button"
            className="menu-card-add"
            ref={trackAdd?.('add')}
            onClick={(e) => {
              e.stopPropagation();
              onAdd(item);
            }}
            aria-label={t('menu.addToCart')}
          >
            <Plus size={18} strokeWidth={2.5} />
          </button>
        ) : (
          <Badge value="sold out" label={t('menu.soldOut')} />
        )}
      </div>
    </article>
  );
}
