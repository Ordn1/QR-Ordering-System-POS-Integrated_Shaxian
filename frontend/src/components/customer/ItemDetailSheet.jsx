import { UtensilsCrossed } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { peso } from '../../lib/format';
import { menuImageUrl } from '../../lib/menuImage';
import Badge from '../shared/Badge';
import Button from '../shared/Button';
import Modal from '../shared/Modal';

export default function ItemDetailSheet({ item, name, description, onAdd, onClose }) {
  const { t } = useTranslation();
  const src = menuImageUrl(item.image_filename);

  return (
    <Modal
      title={name}
      onClose={onClose}
      footer={
        item.is_available ? (
          <Button variant="add-to-cart" onClick={() => onAdd(item)}>
            {t('menu.addToCart')}
          </Button>
        ) : (
          <Badge value="sold out" label={t('menu.soldOut')} />
        )
      }
    >
      <div className="item-detail-media">
        {src ? (
          <img src={src} alt="" />
        ) : (
          <UtensilsCrossed className="menu-item-photo-empty" size={32} strokeWidth={1.5} />
        )}
      </div>

      <p className="item-detail-price numeric">{peso(item.price)}</p>
      {description ? <p className="item-detail-description">{description}</p> : null}

      <dl className="detail-list item-detail-facts">
        <dt className="eyebrow">{t('menu.caloriesLabel')}</dt>
        <dd className="numeric">
          {item.calories !== null ? t('menu.calories', { count: item.calories }) : '—'}
        </dd>
        <dt className="eyebrow">{t('menu.allergensLabel')}</dt>
        <dd>{item.allergens ?? t('menu.noneListed')}</dd>
        <dt className="eyebrow">{t('menu.dietaryLabel')}</dt>
        <dd>{item.dietary_flags ?? t('menu.noneListed')}</dd>
      </dl>
    </Modal>
  );
}
