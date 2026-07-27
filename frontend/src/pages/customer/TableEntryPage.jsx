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
        <h1>{t('entry.unknownTitle')}</h1>
        <p>{t('entry.unknownBody')}</p>
      </main>
    );
  }

  return (
    <main className="entry-page">
      <img className="entry-logo" src="/logos/ShaxianIcon.png" alt="" />
      <p className="eyebrow">{t('entry.eyebrow')}</p>
      {session ? (
        <p className="entry-table numeric">
          {t('menu.table', { number: session.table_number })}
        </p>
      ) : null}
      <span className="entry-rule" aria-hidden="true" />
      <p className="entry-note">{t('entry.starting')}</p>
    </main>
  );
}
