import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { queueLabel } from '../../lib/format';
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
  const pad = (value) => String(value).padStart(2, '0');
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`;
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

  if (!entry) {
    return (
      <section className="queue-hero queue-hero-idle">
        <p className="eyebrow">{t('staff.nowPreparing')}</p>
        <p className="queue-hero-idle-text">{t('staff.queueEmpty')}</p>
      </section>
    );
  }

  const awaitingCash =
    entry.payment_method === 'cashier' && entry.payment_status === 'pending';

  return (
    <section className="queue-hero">
      <p className="eyebrow">
        {entry.status === 'preparing' ? t('staff.nowPreparing') : t('staff.upNext')}
      </p>

      <p className="queue-hero-number numeric">{queueLabel(entry.queue_number)}</p>

      <div className="queue-hero-meta">
        <Badge value={entry.declared_priority_status} />
        <Badge value={entry.status} />
        <span>{t('staff.tableNumber', { number: entry.table_number })}</span>
        <span>{t('staff.itemCount', { count: entry.item_count })}</span>
      </div>

      <p className="eyebrow queue-hero-timer-label">
        {entry.prep_started_at ? t('staff.cookingFor') : t('staff.waitingFor')}
      </p>
      <p className="queue-hero-timer numeric">{clock}</p>

      <div className="queue-hero-actions">
        <Button variant="primary" loading={busy} onClick={() => onAdvance(entry, NEXT[entry.status])}>
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
