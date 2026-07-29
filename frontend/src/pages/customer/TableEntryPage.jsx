import { Utensils } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useParams } from 'react-router-dom';

import { useSessionStore } from '../../store/sessionStore';

// The session usually opens in well under a second. Holding the landing panel for a
// moment lets the diner read which table they are ordering from before the menu
// replaces it — this screen is the confirmation that the right code was scanned.
const HOLD_MS = 1200;

export default function TableEntryPage() {
  const { qrToken } = useParams();
  const { t } = useTranslation();
  const open = useSessionStore((state) => state.open);
  const session = useSessionStore((state) => state.session);
  const status = useSessionStore((state) => state.status);
  const started = useRef(false);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (started.current) {
      return;
    }
    started.current = true;
    open(qrToken).catch(() => {});
  }, [open, qrToken]);

  useEffect(() => {
    const timer = setTimeout(() => setHeld(true), HOLD_MS);
    return () => clearTimeout(timer);
  }, []);

  if (held && status === 'ready' && session) {
    return <Navigate to={`/t/${qrToken}/menu`} replace />;
  }

  if (status === 'failed') {
    return (
      <main className="customer-notice">
        <div className="entry-card entry-failed-card">
          <h1>{t('entry.unknownTitle')}</h1>
          <p>{t('entry.unknownBody')}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="entry-page">
      <div className="entry-hero-card">
        <div className="entry-logo-wrap">
          <img className="entry-logo" src="/logos/ShaxianIcon.png" alt="" />
        </div>
        <p className="eyebrow">{t('entry.eyebrow')}</p>

        {session ? (
          <div className="entry-table-pill numeric">
            <Utensils size={18} strokeWidth={2} />
            <span>{t('menu.table', { number: session.table_number })}</span>
          </div>
        ) : null}

        <span className="entry-rule" aria-hidden="true" />
        <div className="entry-status-wrap">
          <span className="btn-spinner entry-spinner" role="status" aria-label="Loading" />
          <p className="entry-note">{t('entry.starting')}</p>
        </div>
      </div>
    </main>
  );
}
