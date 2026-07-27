import { useTranslation } from 'react-i18next';
import { Navigate, useParams } from 'react-router-dom';

import Button from '../../components/shared/Button';
import { peso } from '../../lib/format';
import { useCartStore } from '../../store/cartStore';
import { useSessionStore } from '../../store/sessionStore';

/**
 * Split-bill view for a group session.
 *
 * Every amount here is the real cart priced line by line. What is *not* live is the
 * attribution: each phone keeps its own cart locally and only posts its own order,
 * so this screen distributes the current cart across the session's registered
 * devices to show the shape of a split. The schema supports true attribution —
 * transaction_items.device_id and payments.device_id both exist — but settling
 * shares independently is out of scope, so the pay control is inert and shares are
 * reconciled at the counter.
 */
export default function SplitBillPage() {
  const { t } = useTranslation();
  const { qrToken } = useParams();
  const session = useSessionStore((state) => state.session);
  const lines = useCartStore((state) => state.lines);

  if (lines.length === 0) {
    return <Navigate to={`/t/${qrToken}/cart`} replace />;
  }

  const deviceCount = Math.max(session?.device_count ?? 1, 1);
  const shares = Array.from({ length: deviceCount }, () => []);
  lines.forEach((line, index) => shares[index % deviceCount].push(line));

  const shareTotal = (share) =>
    share.reduce((total, line) => total + Number(line.price) * line.quantity, 0);
  const total = shareTotal(lines);

  return (
    <main className="customer-page">
      <div className="customer-page-head">
        <h1>{t('split.title')}</h1>
      </div>

      <p className="declaration-prompt">{t('split.prompt', { count: deviceCount })}</p>

      {shares.map((share, index) => (
        <section className="split-share" key={index}>
          <header className="split-share-head">
            <h2 className="split-share-name">
              {index === 0
                ? t('split.deviceHost', { number: index + 1 })
                : t('split.device', { number: index + 1 })}
            </h2>
            <span className="split-share-total numeric">{peso(shareTotal(share))}</span>
          </header>
          {share.length > 0 ? (
            <ul className="checkout-lines">
              {share.map((line) => (
                <li key={line.item_id}>
                  <span>
                    {line.quantity} × {line.name}
                  </span>
                  <span className="numeric">
                    {peso(Number(line.price) * line.quantity)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="split-share-empty">{t('split.noItems')}</p>
          )}
        </section>
      ))}

      <div className="cart-totals">
        <span>{t('split.total')}</span>
        <span className="numeric">{peso(total)}</span>
      </div>

      <Button variant="checkout" disabled>
        {t('split.payShare')}
      </Button>
      <p className="login-hint">{t('split.settleNote')}</p>
    </main>
  );
}
