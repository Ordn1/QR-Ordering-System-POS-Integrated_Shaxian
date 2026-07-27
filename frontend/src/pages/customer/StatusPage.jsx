import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { latestOrders } from '../../api/queue';
import Badge from '../../components/shared/Badge';
import { useWebSocket } from '../../hooks/useWebSocket';
import { peso, queueLabel } from '../../lib/format';
import { useSessionStore } from '../../store/sessionStore';
import { toast } from '../../store/toastStore';

const STEPS = ['pending', 'preparing', 'ready', 'completed'];

export default function StatusPage() {
  const { t } = useTranslation();
  const session = useSessionStore((state) => state.session);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    () =>
      latestOrders(session.session_id)
        .then(setOrders)
        .catch((error) => toast.error(error.message))
        .finally(() => setLoading(false)),
    [session.session_id],
  );

  useEffect(() => {
    load();
  }, [load]);

  useWebSocket(
    `/ws/orders/${session.session_id}?device=${session.device_token}`,
    load,
  );

  return (
    <main className="customer-page">
      <div className="customer-page-head">
        <h1>{t('status.title')}</h1>
      </div>

      {!loading && orders.length === 0 ? (
        <p className="customer-empty">{t('status.empty')}</p>
      ) : null}

      {orders.map((order) => (
        <section className="status-card" key={order.txn_id}>
          <div className="status-card-head">
            <span className="status-queue numeric">{queueLabel(order.queue_number)}</span>
            <Badge value={order.status} />
          </div>

          <ol className="status-steps">
            {STEPS.map((stepName) => {
              const reached = STEPS.indexOf(order.status) >= STEPS.indexOf(stepName);
              const current = order.status === stepName;
              return (
                <li
                  className="status-step"
                  key={stepName}
                  data-reached={reached}
                  data-current={current}
                >
                  <span className="status-step-mark" aria-hidden="true" />
                  {t(`status.${stepName}`)}
                </li>
              );
            })}
          </ol>

          <dl className="status-meta">
            <dt>{t('checkout.net')}</dt>
            <dd className="numeric">{peso(order.net_amount)}</dd>
            {order.queue_position !== null ? (
              <>
                <dt>{t('status.position')}</dt>
                <dd className="numeric">{order.queue_position}</dd>
              </>
            ) : null}
            <dt>{t('status.payment')}</dt>
            <dd>{t(`status.pay_${order.payment_status}`)}</dd>
          </dl>
        </section>
      ))}
    </main>
  );
}
