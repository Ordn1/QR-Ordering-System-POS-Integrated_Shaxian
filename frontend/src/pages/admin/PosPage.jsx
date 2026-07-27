import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { fetchBridgeStatus, fetchTransmissions } from '../../api/pos';
import RegisterReceipt from '../../components/admin/RegisterReceipt';
import Badge from '../../components/shared/Badge';
import Button from '../../components/shared/Button';
import Card from '../../components/shared/Card';
import DataTable from '../../components/shared/DataTable';
import Modal from '../../components/shared/Modal';
import Pagination from '../../components/shared/Pagination';
import usePagination from '../../hooks/usePagination';
import { queueLabel, shortDate } from '../../lib/format';
import { toast } from '../../store/toastStore';

/**
 * POS bridge console — objective 1.3.2.5.
 *
 * The transmission path, payloads and acknowledgements are real. The register on
 * the receiving end is simulated, and the page says so rather than implying a
 * terminal that is not there.
 */
export default function PosPage() {
  const { t } = useTranslation();
  const [status, setStatus] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inspecting, setInspecting] = useState(null);
  const paged = usePagination(rows);

  const load = useCallback(
    () =>
      Promise.all([fetchBridgeStatus(), fetchTransmissions()])
        .then(([nextStatus, nextRows]) => {
          setStatus(nextStatus);
          setRows(nextRows);
        })
        .catch((error) => toast.error(error.message))
        .finally(() => setLoading(false)),
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  const columns = [
    {
      key: 'queue',
      header: t('pos.queue'),
      render: (row) => (row.queue_number ? queueLabel(row.queue_number) : '—'),
    },
    {
      key: 'table',
      header: t('admin.colTable'),
      render: (row) => row.table_number ?? '—',
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => (
        <Badge
          value={row.status === 'acknowledged' ? 'available' : 'sold out'}
          label={t(`pos.status_${row.status}`)}
        />
      ),
    },
    {
      key: 'receipt',
      header: t('pos.receiptNo'),
      render: (row) => row.receipt_no ?? '—',
    },
    {
      key: 'bytes',
      header: t('pos.payloadSize'),
      align: 'right',
      render: (row) => `${row.payload_bytes} B`,
    },
    {
      key: 'latency',
      header: t('pos.latency'),
      align: 'right',
      render: (row) => `${row.latency_ms} ms`,
    },
    {
      key: 'attempts',
      header: t('pos.attempts'),
      align: 'right',
      render: (row) => row.attempts,
    },
    { key: 'when', header: t('pos.sentAt'), render: (row) => shortDate(row.occurred_at) },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) => (
        <Button variant="wide-view" onClick={() => setInspecting(row)}>
          {t('pos.viewPayload')}
        </Button>
      ),
    },
  ];

  const latest = rows.find((row) => row.status === 'acknowledged') ?? null;

  return (
    <main className="content-area">
      <header className="page-header">
        <h1>{t('admin.posTitle')}</h1>
        <div className="page-header-actions">
          <Button variant="secondary" onClick={load}>
            {t('pos.refresh')}
          </Button>
        </div>
      </header>

      <p className="verifications-note">{t('pos.intro')}</p>

      {status ? (
        <div className="pos-status">
          <div className="pos-status-item">
            <span className="eyebrow">{t('pos.endpoint')}</span>
            <span className="pos-status-value">{status.endpoint}</span>
          </div>
          <div className="pos-status-item">
            <span className="eyebrow">{t('pos.terminal')}</span>
            <span className="pos-status-value">
              {status.store_code} · {status.terminal_code}
            </span>
          </div>
          <div className="pos-status-item">
            <span className="eyebrow">{t('pos.acknowledged')}</span>
            <span className="pos-status-value numeric">
              {status.acknowledged} / {status.total}
            </span>
          </div>
          <div className="pos-status-item">
            <span className="eyebrow">{t('pos.avgLatency')}</span>
            <span className="pos-status-value numeric">{status.average_latency_ms} ms</span>
          </div>
        </div>
      ) : null}

      <Card title={t('pos.registerTitle')}>
        <RegisterReceipt transmission={latest} />
      </Card>

      <div className="pos-log">
        <Card title={t('pos.logTitle')}>
          <div className="admin-table-scroll">
            <DataTable
              columns={columns}
              rows={paged.slice}
              rowKey={(row) => row.audit_id}
              variant="compact"
              loading={loading}
              emptyMessage={t('pos.logEmpty')}
            />
          </div>
          {loading ? null : (
            <Pagination
              page={paged.page}
              pageCount={paged.pageCount}
              from={paged.from}
              to={paged.to}
              total={paged.total}
              onChange={paged.setPage}
            />
          )}
        </Card>
      </div>

      {inspecting ? (
        <Modal
          title={t('pos.payloadTitle', { queue: queueLabel(inspecting.queue_number) })}
          size="large"
          onClose={() => setInspecting(null)}
        >
          <pre className="pos-payload">{JSON.stringify(inspecting.payload, null, 2)}</pre>
          {inspecting.detail ? (
            <p className="pos-payload-error">{inspecting.detail}</p>
          ) : null}
        </Modal>
      ) : null}
    </main>
  );
}
