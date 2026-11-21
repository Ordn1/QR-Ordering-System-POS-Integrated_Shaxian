import { Download, ExternalLink, QrCode } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { fetchQrPhCode } from '../../api/orders';
import { peso } from '../../lib/format';

const POLL_MS = 4000;

function countdown(expiresAt, now) {
  const seconds = Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * Shows the QR Ph code inside the receipt page and watches for the payment, so a
 * diner who pays in their bank or e-wallet app is confirmed here automatically.
 */
export default function QrPhPanel({ sessionId, txnId, onPaid }) {
  const { t } = useTranslation();
  const [code, setCode] = useState(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const paidRef = useRef(false);
  const inFlightRef = useRef(false);

  const check = useCallback(async () => {
    if (paidRef.current || inFlightRef.current) {
      return;
    }
    inFlightRef.current = true;
    try {
      const next = await fetchQrPhCode(sessionId, txnId);
      setFailed(false);
      if (next.status === 'paid') {
        paidRef.current = true;
        onPaid();
        return;
      }
      setCode(next);
    } catch {
      setFailed(true);
    } finally {
      inFlightRef.current = false;
    }
  }, [sessionId, txnId, onPaid]);

  // Poll while the page is visible, and check at once when the diner comes back
  // from their banking app.
  useEffect(() => {
    const first = setTimeout(check, 0);
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        check();
      }
    }, POLL_MS);
    const onReturn = () => {
      if (document.visibilityState === 'visible') {
        check();
      }
    };
    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('focus', onReturn);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onReturn);
      window.removeEventListener('focus', onReturn);
    };
  }, [check]);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const expired = code?.expires_at ? new Date(code.expires_at).getTime() <= now : false;

  return (
    <section className="receipt-card qrph-panel" aria-live="polite">
      <div className="receipt-card-header">
        <QrCode size={20} strokeWidth={1.75} className="receipt-card-icon" />
        <h2>{t('receipt.qrphTitle')}</h2>
        {code ? <span className="qrph-amount numeric">{peso(code.amount)}</span> : null}
      </div>

      <div className="qrph-code-wrap">
        {code?.image_url && !expired ? (
          <img
            className="qrph-code"
            src={code.image_url}
            alt={t('receipt.qrphAlt')}
            width={240}
            height={240}
          />
        ) : (
          <span className="btn-spinner entry-spinner" role="status" aria-label="Loading" />
        )}
      </div>

      <p className="qrph-status">
        <span className="qrph-dot" aria-hidden="true" />
        {expired
          ? t('receipt.qrphRenewing')
          : failed
            ? t('receipt.qrphOffline')
            : t('receipt.qrphWaiting')}
      </p>
      {code?.expires_at && !expired ? (
        <p className="qrph-expiry numeric">
          {t('receipt.qrphExpiresIn', { time: countdown(code.expires_at, now) })}
        </p>
      ) : null}

      <p className="receipt-note">{t('receipt.qrphHint')}</p>

      <div className="qrph-actions">
        {code?.image_url && !expired ? (
          <a className="secondary-btn" href={code.image_url} download="shaxian-qrph.png">
            <span className="btn-label">
              <Download size={20} strokeWidth={1.75} />
              {t('receipt.qrphSave')}
            </span>
          </a>
        ) : null}
        {code?.test_url ? (
          <a className="ghost-btn" href={code.test_url} target="_blank" rel="noopener noreferrer">
            <span className="btn-label">
              <ExternalLink size={20} strokeWidth={1.75} />
              {t('receipt.qrphSimulate')}
            </span>
          </a>
        ) : null}
      </div>
    </section>
  );
}
