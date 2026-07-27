import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import * as queueApi from '../../api/queue';
import CashierConfirmModal from '../../components/staff/CashierConfirmModal';
import QueueHero from '../../components/staff/QueueHero';
import QueueList from '../../components/staff/QueueList';
import { useWebSocket } from '../../hooks/useWebSocket';
import { queueLabel } from '../../lib/format';
import { toast } from '../../store/toastStore';

const STAGES = ['preparing', 'pending', 'ready'];
const STAGE_KEY = {
  preparing: 'staff.stagePreparing',
  pending: 'staff.stageWaiting',
  ready: 'staff.stageReady',
};

export default function QueuePage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [stage, setStage] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [settling, setSettling] = useState(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(0);

  const load = useCallback(
    () =>
      queueApi
        .listQueue()
        .then(setRows)
        .catch((error) => toast.error(error.message)),
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = setInterval(tick, 30000);
    const first = setTimeout(tick, 0);
    return () => {
      clearInterval(timer);
      clearTimeout(first);
    };
  }, []);

  useWebSocket('/ws/kitchen', load);

  const byStage = useMemo(
    () =>
      STAGES.reduce(
        (grouped, name) => ({ ...grouped, [name]: rows.filter((row) => row.status === name) }),
        {},
      ),
    [rows],
  );

  const activeStage =
    stage ?? STAGES.find((name) => (byStage[name]?.length ?? 0) > 0) ?? 'preparing';

  const focus =
    rows.find((row) => row.txn_id === selectedId) ??
    byStage.preparing?.[0] ??
    byStage.pending?.[0] ??
    byStage.ready?.[0] ??
    null;

  const servingMinutes = now
    ? rows
        .filter((row) => row.prep_started_at)
        .map((row) => (now - new Date(row.prep_started_at).getTime()) / 60000)
    : [];
  const averageWait = servingMinutes.length
    ? Math.round(servingMinutes.reduce((total, value) => total + value, 0) / servingMinutes.length)
    : 0;

  async function advance(entry, next) {
    setBusy(true);
    try {
      await queueApi.advanceStatus(entry.txn_id, next);
      await load();
      toast.success(t('staff.advanced', { queue: queueLabel(entry.queue_number), status: next }));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmPayment(entry) {
    setBusy(true);
    try {
      await queueApi.confirmPayment(entry.txn_id);
      await load();
      setSettling(null);
      toast.success(t('staff.markedPaid', { queue: queueLabel(entry.queue_number) }));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="content-area">
      <header className="page-header">
        <h1>{t('staff.queueTitle')}</h1>
      </header>

      <div className="queue-stats">
        <div className="queue-stat">
          <span className="eyebrow">{t('staff.statWaiting')}</span>
          <span className="queue-stat-value numeric">{byStage.pending?.length ?? 0}</span>
        </div>
        <div className="queue-stat">
          <span className="eyebrow">{t('staff.statPreparing')}</span>
          <span className="queue-stat-value numeric">{byStage.preparing?.length ?? 0}</span>
        </div>
        <div className="queue-stat">
          <span className="eyebrow">{t('staff.statReady')}</span>
          <span className="queue-stat-value numeric">{byStage.ready?.length ?? 0}</span>
        </div>
        <div className="queue-stat">
          <span className="eyebrow">{t('staff.statAverage')}</span>
          <span className="queue-stat-value numeric">
            {t('staff.minutes', { count: averageWait })}
          </span>
        </div>
      </div>

      <div className="queue-layout">
        <QueueHero
          entry={focus}
          busy={busy}
          onAdvance={advance}
          onConfirmPayment={setSettling}
        />

        <section className="queue-panel">
          <div className="queue-tabs" role="tablist">
            {STAGES.map((name) => (
              <button
                key={name}
                type="button"
                role="tab"
                className="queue-tab"
                aria-selected={activeStage === name}
                onClick={() => setStage(name)}
              >
                {t(STAGE_KEY[name])}
                <span className="queue-tab-count numeric">{byStage[name]?.length ?? 0}</span>
              </button>
            ))}
          </div>

          <QueueList
            entries={byStage[activeStage] ?? []}
            activeId={focus?.txn_id ?? null}
            onSelect={(entry) => setSelectedId(entry.txn_id)}
          />
        </section>
      </div>

      {settling ? (
        <CashierConfirmModal
          entry={settling}
          busy={busy}
          onConfirm={confirmPayment}
          onClose={() => setSettling(null)}
        />
      ) : null}
    </main>
  );
}
