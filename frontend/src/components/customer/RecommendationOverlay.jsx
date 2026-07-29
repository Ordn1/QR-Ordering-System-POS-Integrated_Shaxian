import { Sparkles, X, Plus, TrendingUp, Star, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { peso } from '../../lib/format';

/* ── Confidence tier badges ─────────────────────────────────────────────── */
function ConfidenceBadge({ confidence }) {
  const pct = Math.round(Number(confidence) * 100);

  let label, variant;
  if (pct >= 80) {
    label = 'Perfect Match';
    variant = 'rec-badge--perfect';
  } else if (pct >= 60) {
    label = 'Frequently Ordered';
    variant = 'rec-badge--frequent';
  } else {
    label = 'Popular Pick';
    variant = 'rec-badge--popular';
  }

  return (
    <span className={`rec-badge ${variant}`}>
      {pct >= 80 ? <Star size={10} /> : pct >= 60 ? <TrendingUp size={10} /> : <Zap size={10} />}
      {label}
    </span>
  );
}

/* ── Food icon placeholder (shown when no image URL) ────────────────────── */
function FoodIcon({ name }) {
  const initials = (name || '?')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return <span className="rec-item-icon" aria-hidden="true">{initials}</span>;
}

/* ── Main overlay ────────────────────────────────────────────────────────── */
export default function RecommendationOverlay({ suggestions, onAccept, onDismiss }) {
  const { t } = useTranslation();

  return (
    <>
      {/* Scrim backdrop */}
      <div className="rec-scrim" aria-hidden="true" onClick={onDismiss} />

      <aside className="rec-overlay" role="region" aria-label={t('recommend.title')}>
        {/* Drag handle */}
        <div className="rec-drag-handle" aria-hidden="true" />

        {/* Header */}
        <div className="rec-overlay-head">
          <div className="rec-overlay-title-group">
            <span className="rec-sparkle-wrap" aria-hidden="true">
              <Sparkles size={18} />
            </span>
            <div>
              <h2 className="rec-overlay-title">{t('recommend.title')}</h2>
              <p className="rec-overlay-subtitle">{t('recommend.prompt')}</p>
            </div>
          </div>
          <button
            className="rec-close-btn"
            onClick={onDismiss}
            aria-label={t('recommend.dismiss')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Item list */}
        <ul className="rec-overlay-list">
          {suggestions.map((suggestion) => {
            const name =
              typeof suggestion.name === 'object'
                ? suggestion.name?.en ?? Object.values(suggestion.name)[0]
                : suggestion.name;

            return (
              <li className="rec-overlay-item" key={suggestion.item_id}>
                {/* Dish thumbnail / icon */}
                {suggestion.image_url ? (
                  <img
                    className="rec-item-thumb"
                    src={`/images/${suggestion.image_url}`}
                    alt={name}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <FoodIcon name={name} />

                {/* Info block */}
                <div className="rec-item-info">
                  <ConfidenceBadge confidence={suggestion.confidence} />
                  <span className="rec-item-name">{name}</span>
                  <span className="rec-item-price numeric">{peso(suggestion.price)}</span>
                </div>

                {/* Add button */}
                <button
                  className="rec-add-btn"
                  onClick={() => onAccept(suggestion)}
                  aria-label={`Add ${name} to cart`}
                >
                  <Plus size={20} strokeWidth={2.5} />
                </button>
              </li>
            );
          })}
        </ul>

        {/* Footer action */}
        <div className="rec-overlay-footer">
          <button className="rec-dismiss-btn" onClick={onDismiss}>
            {t('recommend.dismiss')}
          </button>
        </div>
      </aside>
    </>
  );
}
