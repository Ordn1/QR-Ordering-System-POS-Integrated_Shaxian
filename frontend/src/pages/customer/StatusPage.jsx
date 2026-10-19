import {
  AlertTriangle,
  CheckCircle2,
  ChefHat,
  Clock,
  CreditCard,
  Receipt,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { latestOrders } from '../../api/queue';
import Badge from '../../components/shared/Badge';
import Button from '../../components/shared/Button';
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
  const { qrToken } = useParams();
  const navigate = useNavigate();
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

      {orders.map((order) => {
        const allPaid = order.payment_status === 'paid';
        const isGroupOrSplit = session?.group_mode || order.shares_total > 1;
        const awaitingPayment = !allPaid;
        const shares = order.shares ?? [];

        return (
          <section className="status-order-card" key={order.txn_id}>
            <div className="status-hero-card">
              {order.is_priority ? (
                <div className="status-priority-badge">
                  <Sparkles size={14} strokeWidth={2} />
                  <span>{t('status.priority', { defaultValue: 'Priority' })}</span>
                </div>
              ) : null}
              <span className="status-hero-eyebrow">{t('receipt.queueNumber')}</span>
              <h2 className="status-hero-number numeric">{queueLabel(order.queue_number)}</h2>
              <Badge
                value={awaitingPayment ? 'pending' : order.status}
                domain={awaitingPayment ? 'payment' : undefined}
                label={
                  awaitingPayment
                    ? isGroupOrSplit
                      ? `Awaiting Payment (${order.shares_paid}/${order.shares_total} paid)`
                      : 'Awaiting Payment'
                    : undefined
                }
              />
            </div>

            {awaitingPayment ? (
              <div className="status-split-warning">
                <div className="status-split-warning-header">
                  <AlertTriangle size={18} strokeWidth={2} />
                  <span className="status-split-warning-title">
                    {isGroupOrSplit
                      ? `Order Held — Split Payment (${order.shares_paid}/${order.shares_total} settled)`
                      : 'Order Held — Awaiting Payment Settlement'}
                  </span>
                </div>

                {shares.length > 0 ? (
                  <ul className="status-split-share-list">
                    {shares.map((share) => (
                      <li key={share.payment_id} className="status-split-share-row">
                        <span className="status-split-share-name">
                          {share.is_host
                            ? t('split.deviceHost', { number: share.device_number })
                            : t('split.device', { number: share.device_number })}
                          {share.is_me ? ' (You)' : ''}
                        </span>
                        <Badge value={share.status} domain="payment" />
                        <span className="status-split-share-amount numeric">
                          {peso(share.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}

                <p className="status-split-warning-note">
                  Order is blocked from kitchen preparation until all payment shares are settled online or confirmed by the cashier.
                </p>

                <div className="status-split-actions">
                  {order.my_share_unpaid ? (
                    <Button
                      variant="checkout"
                      icon={CreditCard}
                      onClick={() =>
                        navigate(
                          `/t/${qrToken}/checkout?scope=split&txn_id=${order.txn_id}`,
                        )
                      }
                    >
                      Pay my share · {peso(order.my_share_amount)}
                    </Button>
                  ) : null}
                  {Number(order.unpaid_amount) > 0 && isGroupOrSplit ? (
                    <Button
                      variant="secondary"
                      onClick={() =>
                        navigate(
                          `/t/${qrToken}/checkout?scope=table&txn_id=${order.txn_id}`,
                        )
                      }
                    >
                      Pay remaining balance · {peso(order.unpaid_amount)}
                    </Button>
                  ) : null}
                  <Button
                    variant="secondary"
                    icon={Receipt}
                    onClick={() =>
                      navigate(`/t/${qrToken}/receipt?txn_id=${order.txn_id}`)
                    }
                  >
                    View Receipt
                  </Button>
                </div>
              </div>
            ) : (
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
            )}

            <dl className="status-meta-card">
              <div className="status-meta-row">
                <dt>{t('checkout.net')}</dt>
                <dd className="numeric">{peso(order.net_amount)}</dd>
              </div>
              {order.queue_position !== null && allPaid ? (
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
        );
      })}
    </main>
  );
}