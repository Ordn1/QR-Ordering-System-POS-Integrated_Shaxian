import {
  Beef,
  CookingPot,
  Croissant,
  Soup,
  Utensils,
  Wheat,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import Badge from '../shared/Badge';
import IconButton from '../shared/IconButton';

const ICONS = [Croissant, Soup, Utensils, Beef, Wheat, CookingPot];

export default function CategoryTile({ category, position, itemCount, onEdit, onDelete }) {
  const { t } = useTranslation();
  const Icon = ICONS[position % ICONS.length];

  return (
    <article className="tile category-tile">
      <div className="tile-media">
        <Icon className="tile-icon" size={44} strokeWidth={1.5} />
        <span className="tile-status">
          <Badge value={category.is_active ? 'active' : 'ended'} />
        </span>
      </div>

      <div className="tile-body">
        <span className="tile-name">{category.name_en}</span>
        <span className="tile-meta">
          {category.name_fil} · {category.name_bis}
        </span>
        <span className="tile-price numeric">{itemCount}</span>
      </div>

      <div className="tile-actions">
        <IconButton
          variant="edit"
          label={`${t('common.edit')} ${category.name_en}`}
          onClick={onEdit}
        />
        <IconButton
          variant="delete"
          label={`${t('common.delete')} ${category.name_en}`}
          onClick={onDelete}
        />
      </div>
    </article>
  );
}
