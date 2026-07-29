import { useTranslation } from 'react-i18next';
import { Clock } from 'lucide-react';

import { peso, queueLabel } from '../../lib/format';
import Badge from '../shared/Badge';

function elapsedMins(since) {
  if (!since) return null;
  const mins = Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 60000));
  return mins;
}

export default function QueueList({ entries, activeId, onSelect }) {
  const { t } = useTranslation();

  if (entries.length === 0) {
    return (
      <p className="queue-list-empty">{t('staff.noneInStage')}</p>
    );
  }

  return (
    <ul className="queue-list">
      {entries.map((entry) => {
        const since = entry.prep_started_at ?? entry.entered_queue_at;
        const mins = elapsedMins(since);

        return (
          <li key={entry.txn_id}>
            <button
              type="button"
              className={`queue-row${entry.is_priority ? ' queue-row-priority' : ''}${
                entry.txn_id === activeId ? ' queue-row-active' : ''
              }`}
              onClick={() => onSelect(entry)}
            >
              {/* Queue number */}
              <span className="queue-row-number numeric">{queueLabel(entry.queue_number)}</span>

              {/* Detail */}
              <span className="queue-row-detail">
                <span className="queue-row-main">
                  {t('staff.tableNumber', { number: entry.table_number })}
                </span>
                <span className="queue-row-sub">
                  {t('staff.itemCount', { count: entry.item_count })} · {peso(entry.net_amount)}
                </span>
              </span>

              {/* Right side: badges + elapsed */}
              <span className="queue-row-tags">
                {entry.is_priority && <Badge value={entry.declared_priority_status} />}
                {mins !== null && (
                  <span className={`queue-row-elapsed${mins >= 10 ? ' queue-row-elapsed--late' : ''}`}>
                    <Clock size={11} />
                    {mins}m
                  </span>
                )}
                {entry.priority_skips_used > 0 ? (
                  <span className="queue-row-skips numeric">
                    {t('staff.skipped', { count: entry.priority_skips_used })}
                  </span>
                ) : null}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
