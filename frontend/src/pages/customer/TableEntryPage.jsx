import { Plus, Users, Utensils } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';

import Button from '../../components/shared/Button';
import { useSessionStore } from '../../store/sessionStore';

const HOLD_MS = 1200;

const LEGACY_DEVICE_KEY = 'shaxian.device';

function rememberRedirectDevice(qrToken, deviceToken) {
  try {
    localStorage.setItem(LEGACY_DEVICE_KEY, JSON.stringify({ qrToken, deviceToken }));
    return true;
  } catch {
    return false;
  }
}

export default function TableEntryPage() {
  const { qrToken } = useParams();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const open = useSessionStore((state) => state.open);
  const session = useSessionStore((state) => state.session);
  const choice = useSessionStore((state) => state.choice);
  const status = useSessionStore((state) => state.status);
  const started = useRef(false);
  const [held, setHeld] = useState(false);
  const [picked, setPicked] = useState(null);

  useEffect(() => {
    if (started.current) {
      return;
    }
    started.current = true;

    const deviceParam = searchParams.get('device');
    if (deviceParam) {
      rememberRedirectDevice(qrToken, deviceParam);
    }

    open(qrToken).catch(() => {});
  }, [open, qrToken, searchParams]);

  useEffect(() => {
    const timer = setTimeout(() => setHeld(true), HOLD_MS);
    return () => clearTimeout(timer);
  }, []);

  function pick(mode) {
    setPicked(mode);
    open(qrToken, mode).catch(() => setPicked(null));
  }

  if ((held || picked) && status === 'ready' && session && !session.ended) {
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

  if (choice && (status === 'choosing' || picked)) {
    return (
      <main className="entry-page">
        <section className="entry-hero-card" aria-labelledby="entry-choice-title">
          <div className="entry-logo-wrap">
            <img className="entry-logo" src="/logos/ShaxianIcon.png" alt="" />
          </div>
          <div className="entry-table-pill numeric">
            <Utensils size={18} strokeWidth={2} />
            <span>{t('menu.table', { number: choice.table_number })}</span>
          </div>
          <h1 id="entry-choice-title" className="entry-choice-title">
            {t('entry.activeTitle', { number: choice.table_number })}
          </h1>
          <p className="entry-note">{t('entry.activeBody')}</p>
          <div className="entry-choice-actions">
            <div className="entry-choice">
              <Button
                variant="primary"
                icon={Users}
                loading={picked === 'join'}
                disabled={picked !== null}
                onClick={() => pick('join')}
              >
                {t('entry.joinGroup')}
              </Button>
              <p className="entry-choice-note">{t('entry.joinGroupNote')}</p>
            </div>
            <div className="entry-choice">
              <Button
                variant="secondary"
                icon={Plus}
                loading={picked === 'new'}
                disabled={picked !== null}
                onClick={() => pick('new')}
              >
                {t('entry.startNew')}
              </Button>
              <p className="entry-choice-note">{t('entry.startNewNote')}</p>
            </div>
          </div>
        </section>
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
