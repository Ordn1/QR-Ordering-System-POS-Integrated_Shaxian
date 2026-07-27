import { ImageOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { peso } from '../../lib/format';
import { menuImageUrl } from '../../lib/menuImage';
import Badge from '../shared/Badge';
import IconButton from '../shared/IconButton';

export default function MenuTile({ item, categoryName, onView, onEdit, onDelete }) {
  const { t } = useTranslation();
  const src = menuImageUrl(item.image_filename);

  return (
    <article className="tile">
      <div className="tile-media">
        {src ? (
          <img src={src} alt={item.name_en} loading="lazy" />
        ) : (
          <ImageOff className="tile-media-empty" size={28} strokeWidth={1.75} />
        )}
        <span className="tile-status">
          <Badge value={item.is_available ? 'available' : 'sold out'} />
        </span>
      </div>

      <div className="tile-body">
        <span className="tile-name">{item.name_en}</span>
        <span className="tile-meta">{categoryName}</span>
        <span className="tile-price numeric">{peso(item.price)}</span>
      </div>

      <div className="tile-actions">
        <IconButton variant="view" label={`${t('common.view')} ${item.name_en}`} onClick={onView} />
        <IconButton variant="edit" label={`${t('common.edit')} ${item.name_en}`} onClick={onEdit} />
        <IconButton
          variant="delete"
          label={`${t('common.delete')} ${item.name_en}`}
          onClick={onDelete}
        />
      </div>
    </article>
  );
}
