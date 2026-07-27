import { useTranslation } from 'react-i18next';

import { peso, queueLabel } from '../../lib/format';
import Badge from '../shared/Badge';

export default function QueueList({ entries, activeId, onSelect }) {
  const { t } = useTranslation();

  if (entries.length === 0) {
    return <p className="queue-list-empty">{t('staff.noneInStage')}</p>;
  }

  return (
    <ul className="queue-list">
      {entries.map((entry) => (
        <li key={entry.txn_id}>
          <button
            type="button"
            className={`queue-row${entry.is_priority ? ' queue-row-priority' : ''}${
              entry.txn_id === activeId ? ' queue-row-active' : ''
            }`}
            onClick={() => onSelect(entry)}
          >
            <span className="queue-row-number numeric">{queueLabel(entry.queue_number)}</span>
            <span className="queue-row-detail">
              <span>{t('staff.tableNumber', { number: entry.table_number })}</span>
              <span className="queue-row-sub">
                {t('staff.itemCount', { count: entry.item_count })} · {peso(entry.net_amount)}
              </span>
            </span>
            <span className="queue-row-tags">
              <Badge value={entry.status} />
              {entry.priority_skips_used > 0 ? (
                <span className="queue-row-skips numeric">
                  {t('staff.skipped', { count: entry.priority_skips_used })}
                </span>
              ) : null}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
