import { Plus, UtensilsCrossed } from 'lucide-react';
import { motion } from 'motion/react';
import { Suspense, lazy, useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { peso } from '../../lib/format';
import { useDragTilt } from '../../hooks/useDragTilt';
import { useShowcase } from '../../hooks/useShowcase';
import { menuDepthUrl, menuImageUrl } from '../../lib/menuImage';
import { MOVE } from '../../lib/motion';
import Badge from '../shared/Badge';

const DishView = lazy(() => import('./DishView'));

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
  const photo = useRef(null);
  const photoBox = useRef(null);
  const showcase = useShowcase() && Boolean(src);
  const { tilt, handlers } = useDragTilt();
  const [ready, setReady] = useState(false);
  const markReady = useCallback(() => setReady(true), []);

  return (
    <article className="menu-card" data-item-id={item.item_id} ref={observeItem}>
      <button
        type="button"
        className="menu-card-tap"
        onClick={() => onOpen(item)}
        aria-label={name}
      >
        <motion.div
          ref={photoBox}
          className={`menu-card-photo${showcase && ready ? ' live' : ''}`}
          layoutId={`photo-${item.item_id}`}
          transition={MOVE}
          {...(showcase ? handlers : {})}
        >
          {src ? (
            <motion.img ref={photo} src={src} alt="" loading="lazy" layout transition={MOVE} />
          ) : (
            <UtensilsCrossed className="menu-card-photo-empty" size={28} strokeWidth={1.5} />
          )}
          {showcase ? (
            <Suspense fallback={null}>
              <DishView
                track={photoBox}
                image={src}
                depth={menuDepthUrl(item.image_filename)}
                steam={item.is_hot}
                tilt={tilt}
                onReady={markReady}
              />
            </Suspense>
          ) : null}
        </motion.div>
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
              onAdd(item, 1, photo.current);
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
