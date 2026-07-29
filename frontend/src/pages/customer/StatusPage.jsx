import { CheckCircle2, ChefHat, Clock, ShoppingBag, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { latestOrders } from '../../api/queue';
import Badge from '../../components/shared/Badge';
import { useWebSocket } from '../../hooks/useWebSocket';
import { peso, queueLabel } from '../../lib/format';
import { useSessionStore } from '../../store/sessionStore';
import { toast } from '../../store/toastStore';

const STEP_ICONS = {
  pending: Clock,
  preparing: ChefHat,
  ready: ShoppingBag,
  completed: CheckCircle2,
};

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
        <div className="customer-empty">
          <p>{t('status.empty')}</p>
        </div>
      ) : null}

      {orders.map((order) => (
        <section className="status-order-card" key={order.txn_id}>
          {/* Queue Number Hero Header */}
          <div className="status-hero-card">
            {order.priority_type && order.priority_type !== 'standard' ? (
              <div className="status-priority-badge">
                <Sparkles size={14} strokeWidth={2} />
                <span>{t(`priorityStatus.${order.priority_type}`)}</span>
              </div>
            ) : null}
            <span className="status-hero-eyebrow">{t('receipt.queueNumber')}</span>
            <h2 className="status-hero-number numeric">{queueLabel(order.queue_number)}</h2>
            <Badge value={order.status} />
          </div>

          {/* Timeline Stepper */}
          <div className="status-stepper-container">
            <div className="status-stepper-track" aria-hidden="true" />
            <ol className="status-stepper-list">
              {STEPS.map((stepName) => {
                const reached = STEPS.indexOf(order.status) >= STEPS.indexOf(stepName);
                const current = order.status === stepName;
                const IconComponent = STEP_ICONS[stepName] || Clock;

                return (
                  <li
                    className={`status-stepper-item${reached ? ' reached' : ''}${current ? ' current' : ''}`}
                    key={stepName}
                  >
                    <div className="status-step-icon-wrap">
                      <IconComponent size={20} strokeWidth={2} />
                    </div>
                    <div className="status-step-content">
                      <span className="status-step-title">{t(`status.${stepName}`)}</span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Order Details Footer */}
          <dl className="status-meta-card">
            <div className="status-meta-row">
              <dt>{t('checkout.net')}</dt>
              <dd className="numeric">{peso(order.net_amount)}</dd>
            </div>
            {order.queue_position !== null ? (
              <div className="status-meta-row">
                <dt>{t('status.position')}</dt>
                <dd className="numeric">{order.queue_position}</dd>
              </div>
            ) : null}
            <div className="status-meta-row">
              <dt>{t('status.payment')}</dt>
              <dd>{t(`status.pay_${order.payment_status}`)}</dd>
            </div>
          </dl>
        </section>
      ))}
    </main>
  );
}
