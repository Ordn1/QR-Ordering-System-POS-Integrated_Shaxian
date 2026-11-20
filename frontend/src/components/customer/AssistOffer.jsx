import { ALargeSmall, BellRing, Pointer } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import Button from '../shared/Button';

const ICONS = { display: ALargeSmall, taps: Pointer, crew: BellRing };

export default function AssistOffer({ offer, undo, onAccept, onDecline, onUndo }) {
  const { t } = useTranslation();

  if (offer) {
    const Icon = ICONS[offer.kind];
    return (
      <aside className="assist-offer" aria-live="polite" aria-label={t(`assist.${offer.kind}.question`)}>
        <div className="assist-offer-body">
          <Icon className="assist-offer-icon" size={24} strokeWidth={1.75} aria-hidden="true" />
          <div className="assist-offer-text">
            <p className="assist-offer-question">{t(`assist.${offer.kind}.question`)}</p>
            <p className="assist-offer-detail">{t(`assist.${offer.kind}.detail`)}</p>
          </div>
        </div>
        <div className="assist-offer-actions">
          <Button variant="secondary" onClick={onDecline}>
            {t('assist.noThanks')}
          </Button>
          <Button variant="primary" onClick={onAccept}>
            {t(`assist.${offer.kind}.yes`)}
          </Button>
        </div>
      </aside>
    );
  }

  if (undo) {
    return (
      <aside className="assist-offer assist-offer-undo" aria-live="polite">
        <p className="assist-offer-question">{t('assist.changed')}</p>
        <Button variant="ghost" onClick={onUndo}>
          {t('assist.undo')}
        </Button>
      </aside>
    );
  }

  return null;
}
