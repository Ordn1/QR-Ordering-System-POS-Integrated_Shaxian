import { useTranslation } from 'react-i18next';

import { peso } from '../../lib/format';
import Button from '../shared/Button';

export default function RecommendationOverlay({ suggestions, onAccept, onDismiss }) {
  const { t } = useTranslation();

  return (
    <aside className="rec-overlay" role="region" aria-label={t('recommend.title')}>
      <div className="rec-overlay-head">
        <h2 className="rec-overlay-title">
          <span className="seal" aria-hidden="true" />
          {t('recommend.title')}
        </h2>
        <Button variant="ghost" onClick={onDismiss}>
          {t('recommend.dismiss')}
        </Button>
      </div>
      <p className="rec-overlay-prompt">{t('recommend.prompt')}</p>
      <ul className="rec-overlay-list">
        {suggestions.map((suggestion) => (
          <li className="rec-overlay-item" key={suggestion.item_id}>
            <span className="rec-overlay-name">
              {suggestion.name}
              <span className="rec-overlay-confidence numeric">
                {t('recommend.confidence', {
                  percent: Math.round(Number(suggestion.confidence) * 100),
                })}
              </span>
            </span>
            <span className="rec-overlay-price numeric">{peso(suggestion.price)}</span>
            <Button variant="add-to-cart" onClick={() => onAccept(suggestion)}>
              {t('menu.addToCart')}
            </Button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
