import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChefHat, Clock, CheckCircle2, CreditCard } from 'lucide-react';

import { peso, queueLabel } from '../../lib/format';
import Badge from '../shared/Badge';
import Button from '../shared/Button';

const NEXT = { pending: 'preparing', preparing: 'ready', ready: 'completed' };
const ACTION_KEY = {
  pending: 'staff.startPreparing',
  preparing: 'staff.markReady',
  ready: 'staff.markCompleted',
};

function elapsed(since, now) {
  const seconds = Math.max(0, Math.floor(((now || Date.now()) - new Date(since).getTime()) / 1000));
  const pad = (v) => String(v).padStart(2, '0');
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`;
}

function elapsedMinutes(since, now) {
  const mins = Math.max(0, Math.floor(((now || Date.now()) - new Date(since).getTime()) / 60000));
  return mins;
}

export default function QueueHero({ entry, busy, onAdvance, onConfirmPayment }) {
  const { t } = useTranslation();
  const since = entry?.prep_started_at ?? entry?.entered_queue_at;
  const [now, setNow] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const clock = since ? elapsed(since, now) : '00:00:00';
  const mins = since ? elapsedMinutes(since, now) : 0;
  const isLate = mins >= 10;

  if (!entry) {
    return (
      <section className="queue-hero queue-hero-idle">
        <span className="queue-hero-idle-icon" aria-hidden="true">
          <ChefHat size={40} />
        </span>
        <p className="queue-hero-idle-title">{t('staff.nowPreparing')}</p>
        <p className="queue-hero-idle-text">{t('staff.queueEmpty')}</p>
      </section>
    );
  }

  const awaitingCash =
    entry.payment_method === 'cashier' && entry.payment_status === 'pending';

  const statusStage = entry.status === 'preparing'
    ? t('staff.nowPreparing')
    : entry.status === 'ready'
    ? t('staff.stageReady')
    : t('staff.upNext');

  return (
    <section className="queue-hero">
      {/* Stage eyebrow */}
      <div className="queue-hero-eyebrow">
        <span className="queue-hero-stage-label">{statusStage}</span>
        {isLate && (
          <span className="queue-hero-late-badge">⚠ Late</span>
        )}
      </div>

      {/* Queue number */}
      <p className="queue-hero-number numeric">{queueLabel(entry.queue_number)}</p>

      {/* Meta row */}
      <div className="queue-hero-meta">
        <Badge value={entry.declared_priority_status} />
        <span className="queue-hero-chip">🪑 {t('staff.tableNumber', { number: entry.table_number })}</span>
        <span className="queue-hero-chip">🍽 {t('staff.itemCount', { count: entry.item_count })}</span>
        {entry.payment_method && (
          <span className="queue-hero-chip">
            <CreditCard size={12} />
            {entry.payment_method === 'cashier' ? 'Pay at counter' : 'Online'}
          </span>
        )}
      </div>

      {/* Timer block */}
      <div className={`queue-hero-timer-block${isLate ? ' queue-hero-timer-block--late' : ''}`}>
        <span className="queue-hero-timer-label-text">
          <Clock size={13} />
          {entry.prep_started_at ? t('staff.cookingFor') : t('staff.waitingFor')}
        </span>
        <p className="queue-hero-timer numeric">{clock}</p>
      </div>

      {/* Item list */}
      {entry.items && entry.items.length > 0 && (
        <ul className="queue-hero-items">
          {entry.items.map((item, idx) => (
            <li key={idx} className="queue-hero-item-row">
              <span className="queue-hero-item-qty">{item.qty}×</span>
              <span className="queue-hero-item-name">{typeof item.name === 'object' ? item.name?.en ?? Object.values(item.name)[0] : item.name}</span>
              <span className="queue-hero-item-price numeric">{peso(item.unit_price * item.qty)}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Total */}
      <div className="queue-hero-total">
        <span>Total</span>
        <span className="numeric">{peso(entry.net_amount)}</span>
      </div>

      {/* Actions */}
      <div className="queue-hero-actions">
        <Button variant="primary" loading={busy} onClick={() => onAdvance(entry, NEXT[entry.status])}>
          {entry.status === 'ready' ? <CheckCircle2 size={16} /> : <ChefHat size={16} />}
          {t(ACTION_KEY[entry.status])}
        </Button>
        {awaitingCash ? (
          <Button variant="secondary" loading={busy} onClick={() => onConfirmPayment(entry)}>
            {t('staff.confirmCash')}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
