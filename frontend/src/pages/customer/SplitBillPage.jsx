import { Smartphone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Navigate, useParams } from 'react-router-dom';

import Button from '../../components/shared/Button';
import { peso } from '../../lib/format';
import { useCartStore } from '../../store/cartStore';
import { useSessionStore } from '../../store/sessionStore';

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

      <div className="split-shares-container">
        {shares.map((share, index) => (
          <section className="split-share-card" key={index}>
            <header className="split-share-header">
              <div className="split-share-title-wrap">
                <Smartphone size={18} strokeWidth={1.75} className="split-share-icon" />
                <h2 className="split-share-name">
                  {index === 0
                    ? t('split.deviceHost', { number: index + 1 })
                    : t('split.device', { number: index + 1 })}
                </h2>
              </div>
              <span className="split-share-total numeric">{peso(shareTotal(share))}</span>
            </header>
            {share.length > 0 ? (
              <ul className="split-share-item-list">
                {share.map((line) => (
                  <li key={line.item_id} className="split-share-item-row">
                    <span className="split-share-item-qty">{line.quantity}×</span>
                    <span className="split-share-item-name">{line.name}</span>
                    <span className="split-share-item-price numeric">
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
      </div>

      <div className="split-table-total-card">
        <div className="split-total-row">
          <span>{t('split.total')}</span>
          <span className="numeric">{peso(total)}</span>
        </div>
        <Button variant="checkout" disabled>
          {t('split.payShare')}
        </Button>
        <p className="login-hint">{t('split.settleNote')}</p>
      </div>
    </main>
  );
}
