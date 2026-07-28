import { Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { peso } from '../../lib/format';
import { menuImageUrl } from '../../lib/menuImage';

const NAME_BY_LANGUAGE = { en: 'name_en', fil: 'name_fil', bis: 'name_bis' };

export default function SearchOverlay({ items, language, onSelect, onClose }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const nameKey = NAME_BY_LANGUAGE[language] ?? 'name_en';
  const normalised = query.toLowerCase().trim();
  const results = normalised
    ? items.filter((item) => {
        const name = (item[nameKey] || item.name_en || '').toLowerCase();
        return name.includes(normalised);
      })
    : [];

  return (
    <div className="search-overlay" role="dialog" aria-modal="true" aria-label={t('search.title')}>
      <div className="search-overlay-header">
        <div className="search-overlay-input-wrap">
          <Search size={18} strokeWidth={1.75} className="search-overlay-icon" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            className="search-overlay-input"
            placeholder={t('search.placeholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button type="button" className="search-overlay-close" onClick={onClose} aria-label={t('search.close')}>
          <X size={20} strokeWidth={1.75} />
        </button>
      </div>

      <div className="search-overlay-results">
        {normalised && results.length === 0 ? (
          <p className="search-overlay-empty">{t('search.noResults')}</p>
        ) : null}
        {results.map((item) => {
          const src = menuImageUrl(item.image_filename);
          return (
            <button
              key={item.item_id}
              type="button"
              className="search-result-item"
              onClick={() => {
                onSelect(item);
                onClose();
              }}
            >
              <div className="search-result-thumb">
                {src ? <img src={src} alt="" loading="lazy" /> : null}
              </div>
              <div className="search-result-info">
                <span className="search-result-name">{item[nameKey] || item.name_en}</span>
                <span className="search-result-price numeric">{peso(item.price)}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
