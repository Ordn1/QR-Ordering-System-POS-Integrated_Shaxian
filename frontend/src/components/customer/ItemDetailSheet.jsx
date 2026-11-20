import { Box, Image as ImageIcon, UtensilsCrossed, Volume2 } from 'lucide-react';
import { motion } from 'motion/react';
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { peso } from '../../lib/format';
import { useShowcase } from '../../hooks/useShowcase';
import { menuDepthUrl, menuImageUrl } from '../../lib/menuImage';
import { DURATION, MOVE } from '../../lib/motion';
import { companionName } from '../../lib/shareLabel';
import { useCartStore } from '../../store/cartStore';
import { useSessionStore } from '../../store/sessionStore';
import { onVoicesChanged, speak, stopSpeaking, voiceFor } from '../../lib/speech';
import Badge from '../shared/Badge';
import MenuCode from '../shared/MenuCode';
import Button from '../shared/Button';
import Modal from '../shared/Modal';
import QtyStepper from '../shared/QtyStepper';

const DishStage = lazy(() => import('./DishStage'));

export default function ItemDetailSheet({ item, name, description, onAdd, onClose }) {
  const { t, i18n } = useTranslation();
  const [, setVoicesLoaded] = useState(0);
  const orderingFor = useCartStore((state) => state.orderingFor);
  const forName = companionName(useSessionStore((state) => state.session), orderingFor);
  const voice = voiceFor(i18n.language);
  const [qty, setQty] = useState(1);
  const photo = useRef(null);
  const src = menuImageUrl(item.image_filename);
  const totalPrice = Number(item.price) * qty;
  const showcase = useShowcase() && Boolean(src);
  const [settled, setSettled] = useState(false);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState('solid');
  const markReady = useCallback(() => setReady(true), []);

  useEffect(() => {
    const unsubscribe = onVoicesChanged(() => setVoicesLoaded((count) => count + 1));
    return () => {
      unsubscribe();
      stopSpeaking();
    };
  }, []);

  function readAloud() {
    const amount = Number(item.price);
    const parts = [
      name,
      t('speech.price', { amount: Number.isInteger(amount) ? amount : amount.toFixed(2) }),
      description,
    ];
    speak(parts.filter(Boolean).join('. '), voice);
  }

  useEffect(() => {
    const timer = setTimeout(() => setSettled(true), DURATION.move * 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Modal
      sheet
      title={name}
      onClose={onClose}
      footer={
        item.is_available ? (
          <div className="item-detail-footer-content">
            <QtyStepper
              value={qty}
              onChange={setQty}
              itemLabel={name}
            />
            <Button
              variant="add-to-cart"
              onClick={() => onAdd(item, qty, photo.current)}
            >
              {t('menu.addToCart')} · {peso(totalPrice)}
            </Button>
          </div>
        ) : (
          <Badge value="sold out" label={t('menu.soldOut')} />
        )
      }
    >
      <motion.div
        className={`item-detail-media${showcase && ready && view === 'solid' ? ' live' : ''}`}
        layoutId={`photo-${item.item_id}`}
        transition={MOVE}
      >
        {src ? (
          <motion.img ref={photo} src={src} alt="" layout transition={MOVE} />
        ) : (
          <UtensilsCrossed className="menu-item-photo-empty" size={32} strokeWidth={1.5} />
        )}
        {showcase && settled ? (
          <Suspense fallback={null}>
            <DishStage
              image={src}
              depth={menuDepthUrl(item.image_filename)}
              recipe={item.model_filename}
              steam={item.is_hot}
              onReady={markReady}
            />
          </Suspense>
        ) : null}
        {showcase && ready ? (
          <button
            type="button"
            className="toggle-btn item-detail-view-toggle"
            aria-label={t(view === 'solid' ? 'menu.viewPhoto' : 'menu.view3d')}
            title={t(view === 'solid' ? 'menu.viewPhoto' : 'menu.view3d')}
            onClick={() => setView(view === 'solid' ? 'photo' : 'solid')}
          >
            {view === 'solid' ? <ImageIcon size={18} strokeWidth={1.75} /> : <Box size={18} strokeWidth={1.75} />}
          </button>
        ) : null}
        <MenuCode code={item.menu_code} overlay />
      </motion.div>

      <div className="item-detail-header-row">
        <h3 className="item-detail-title">{name}</h3>
        <p className="item-detail-price numeric">{peso(item.price)}</p>
      </div>
      {item.name_zh ? (
        <p className="dish-name-zh item-detail-name-zh" lang="zh-Hans">
          {item.name_zh}
        </p>
      ) : null}

      {description ? <p className="item-detail-description">{description}</p> : null}

      {forName ? <p className="item-detail-for">{t('people.addingFor', { name: forName })}</p> : null}

      {voice ? (
        <Button variant="secondary" icon={Volume2} onClick={readAloud}>
          {t('speech.readAloud')}
        </Button>
      ) : null}

      <dl className="detail-list item-detail-facts">
        {item.calories !== null ? (
          <>
            <dt className="eyebrow">{t('menu.caloriesLabel')}</dt>
            <dd className="numeric">{t('menu.calories', { count: item.calories })}</dd>
          </>
        ) : null}
        <dt className="eyebrow">{t('menu.allergensLabel')}</dt>
        <dd>{item.allergens ?? t('menu.noneListed')}</dd>
        <dt className="eyebrow">{t('menu.dietaryLabel')}</dt>
        <dd>{item.dietary_flags ?? t('menu.noneListed')}</dd>
      </dl>
    </Modal>
  );
}
