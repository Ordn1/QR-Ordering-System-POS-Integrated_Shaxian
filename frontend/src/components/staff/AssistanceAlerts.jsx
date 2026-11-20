import { BellRing } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { acknowledgeAssistance, listAssistance } from '../../api/queue';
import { useWebSocket } from '../../hooks/useWebSocket';
import { toast } from '../../store/toastStore';
import Button from '../shared/Button';

const TICK_MS = 15000;

function minutesSince(timestamp, now) {
  return Math.max(0, Math.floor((now - new Date(timestamp).getTime()) / 60000));
}

export default function AssistanceAlerts() {
  const { t } = useTranslation();
  const [requests, setRequests] = useState([]);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(null);

  const load = useCallback(
    () =>
      listAssistance()
        .then(setRequests)
        .catch((error) => toast.error(error.message)),
    [],
  );

  useEffect(() => {
    load();
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [load]);

  useWebSocket(
    '/ws/kitchen',
    useCallback(
      (payload) => {
        if (payload?.type === 'assistance_changed') {
          load();
        }
      },
      [load],
    ),
  );

  async function acknowledge(request) {
    setBusy(request.request_id);
    try {
      await acknowledgeAssistance(request.request_id);
      toast.success(t('staff.assistOnTheWay', { table: request.table_number }));
      await load();
    } catch (error) {
      toast.error(error.message);
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (requests.length === 0) {
    return null;
  }

  return (
    <section className="assist-alerts" aria-label={t('staff.assistTitle')} aria-live="polite">
      {requests.map((request) => (
        <div key={request.request_id} className="assist-alert">
          <BellRing size={20} strokeWidth={1.75} aria-hidden="true" />
          <div className="assist-alert-text">
            <span className="assist-alert-title">
              {t('staff.assistNeeded', { table: request.table_number })}
            </span>
            <span className="assist-alert-meta">
              {request.display_name ||
                (request.device_number ? t('staff.assistPhone', { number: request.device_number }) : '')}
              {' · '}
              {t('staff.assistWaiting', { count: minutesSince(request.requested_at, now) })}
              {request.reason === 'offered' ? ` · ${t('staff.assistOffered')}` : ''}
            </span>
          </div>
          <Button
            variant="primary"
            loading={busy === request.request_id}
            onClick={() => acknowledge(request)}
          >
            {t('staff.assistAcknowledge')}
          </Button>
        </div>
      ))}
    </section>
  );
}
