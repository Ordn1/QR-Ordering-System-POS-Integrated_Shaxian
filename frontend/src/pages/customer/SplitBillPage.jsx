import { Smartphone, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { fetchTableCart } from '../../api/sessions';
import Badge from '../../components/shared/Badge';
import Button from '../../components/shared/Button';
import { useWebSocket } from '../../hooks/useWebSocket';
import { peso } from '../../lib/format';
import { useCartStore } from '../../store/cartStore';
import { useSessionStore } from '../../store/sessionStore';
import { toast } from '../../store/toastStore';

export default function SplitBillPage() {
  const { t, i18n } = useTranslation();
  const { qrToken } = useParams();
  const navigate = useNavigate();
  const session = useSessionStore((state) => state.session);
  const localLines = useCartStore((state) => state.lines);
  const [tableCart, setTableCart] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadCart = useCallback(() => {
    if (!session?.session_id) {
      return Promise.resolve();
    }
    return fetchTableCart(session.session_id, i18n.language)
      .then(setTableCart)
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, [session?.session_id, i18n.language]);

  useEffect(() => {
    loadCart();
  }, [loadCart, localLines]);

  const handleSocket = useCallback(
    (payload) => {
      if (
        payload?.type === 'cart_changed' ||
        payload?.type === 'session_changed' ||
        payload?.type === 'order_status'
      ) {
        loadCart();
      }
    },
    [loadCart],
  );

  useWebSocket(
    session
      ? `/ws/orders/${session.session_id}?device=${session.device_token}`
      : null,
    handleSocket,
  );

  const shares = tableCart?.shares ?? [];
  const deviceCount = tableCart?.device_count ?? Math.max(session?.device_count ?? 1, 1);
  const tableTotal = Number(tableCart?.table_total ?? 0);
  const myShareTotal = Number(tableCart?.my_share_total ?? 0);
  const unpaidTotal = Number(tableCart?.unpaid_total ?? tableTotal);
  const canPayMyShare = myShareTotal > 0;
  const canPayAll = unpaidTotal > 0;

  return (
    <main className="customer-page">
      <div className="customer-page-head">
        <h1>{t('split.title')}</h1>
      </div>

      <p className="declaration-prompt">{t('split.prompt', { count: deviceCount })}</p>

      {loading && !tableCart ? (
        <div className="entry-status-wrap">
          <span className="btn-spinner entry-spinner" role="status" aria-label="Loading" />
        </div>
      ) : (
        <div className="split-shares-container">
          {shares.map((share) => (
            <section className="split-share-card" key={share.device_id}>
              <header className="split-share-header">
                <div className="split-share-title-wrap">
                  <Smartphone size={18} strokeWidth={1.75} className="split-share-icon" />
                  <h2 className="split-share-name">
                    {share.is_host
                      ? t('split.deviceHost', { number: share.device_number })
                      : t('split.device', { number: share.device_number })}
                    {share.is_me ? ' (You)' : ''}
                  </h2>
                </div>
                <div className="table-row-actions">
                  {share.payment_status ? (
                    <Badge value={share.payment_status} domain="payment" />
                  ) : null}
                  <span className="split-share-total numeric">{peso(share.subtotal)}</span>
                </div>
              </header>
              {share.lines.length > 0 ? (
                <ul className="split-share-item-list">
                  {share.lines.map((line) => (
                    <li key={line.item_id} className="split-share-item-row">
                      <span className="split-share-item-qty">{line.quantity}×</span>
                      <span className="split-share-item-name">{line.name}</span>
                      <span className="split-share-item-price numeric">
                        {peso(line.subtotal)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="split-share-empty">{t('split.noItems')}</p>
              )}
            </section>
          ))}
        </div>
      )}

      <div className="split-table-total-card">
        <div className="split-total-row">
          <span>{t('split.total')}</span>
          <span className="numeric">{peso(tableTotal)}</span>
        </div>
        <div className="cart-actions">
          <Button
            variant="checkout"
            disabled={!canPayMyShare}
            onClick={() => navigate(`/t/${qrToken}/checkout?scope=split`)}
          >
            {t('split.payShare')}
            {canPayMyShare ? ` · ${peso(myShareTotal)}` : ''}
          </Button>
          <Button
            variant="secondary"
            icon={Users}
            disabled={!canPayAll}
            onClick={() => navigate(`/t/${qrToken}/checkout?scope=table`)}
          >
            {unpaidTotal < tableTotal
              ? `Pay remaining balance · ${peso(unpaidTotal)}`
              : `Pay for entire table · ${peso(tableTotal)}`}
          </Button>
          {tableCart?.active_txn_id ? (
            <Button
              variant="secondary"
              onClick={() => navigate(`/t/${qrToken}/status`)}
            >
              {t('nav.status', { defaultValue: 'Order Status' })}
            </Button>
          ) : null}
        </div>
        <p className="login-hint">
          Kitchen preparation begins once all shares are paid or the host settles the table.
        </p>
      </div>
    </main>
  );
}