import { Ban, RefreshCw, Send } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { transmit } from '../../api/pos';
import {
  getTransaction,
  listTransactions,
  voidTransaction,
} from '../../api/transactions';
import Badge from '../../components/shared/Badge';
import Button from '../../components/shared/Button';
import DataTable from '../../components/shared/DataTable';
import IconButton from '../../components/shared/IconButton';
import Modal from '../../components/shared/Modal';
import Pagination from '../../components/shared/Pagination';
import TextInput from '../../components/shared/TextInput';
import usePagination from '../../hooks/usePagination';
import { peso, queueLabel, shortDate } from '../../lib/format';
import { toast } from '../../store/toastStore';

export default function TransactionsPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [voiding, setVoiding] = useState(null);
  const [voidReason, setVoidReason] = useState('Customer cancelled before preparation.');
  const [voidBusy, setVoidBusy] = useState(false);
  const [pushingId, setPushingId] = useState(null);
  const paged = usePagination(rows);

  const load = useCallback(
    () =>
      listTransactions()
        .then(setRows)
        .catch((error) => toast.error(error.message))
        .finally(() => setLoading(false)),
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  async function handleInspect(row) {
    setLoadingDetail(true);
    try {
      const detail = await getTransaction(row.txn_id);
      setViewing(detail);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoadingDetail(false);
    }
  }

  async function handlePushPos(row) {
    setPushingId(row.txn_id);
    try {
      const result = await transmit(row.txn_id);
      if (result.status === 'acknowledged') {
        toast.success(
          `Transmitted ${queueLabel(row.queue_number)} to POS (${result.receipt_no}).`,
        );
      } else {
        toast.error(result.detail || 'POS transmission failed.');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setPushingId(null);
    }
  }

  async function confirmVoid() {
    if (!voidReason.trim()) {
      toast.error('Please enter a reason for voiding this transaction.');
      return;
    }
    setVoidBusy(true);
    try {
      await voidTransaction(voiding.txn_id, voidReason.trim());
      toast.success(`Voided ${queueLabel(voiding.queue_number)}.`);
      setVoiding(null);
      await load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setVoidBusy(false);
    }
  }

  const columns = [
    { key: 'queue', header: t('admin.colQueue'), render: (row) => queueLabel(row.queue_number) },
    {
      key: 'table',
      header: t('admin.colTable'),
      render: (row) => (row.table_number ? `Table ${row.table_number}` : '—'),
    },
    { key: 'placed', header: t('admin.colPlaced'), render: (row) => shortDate(row.placed_at) },
    {
      key: 'segment',
      header: t('admin.colSegment'),
      render: (row) => <Badge value={row.session_type} />,
    },
    { key: 'status', header: t('common.status'), render: (row) => <Badge value={row.status} /> },
    { key: 'items', header: t('admin.colItems'), align: 'right', render: (row) => row.item_count },
    { key: 'gross', header: t('admin.colGross'), align: 'right', render: (row) => peso(row.gross_amount) },
    {
      key: 'vatable',
      header: t('admin.colVatable'),
      align: 'right',
      render: (row) => peso(row.vatable_sales),
    },
    {
      key: 'exempt',
      header: t('admin.colExempt'),
      align: 'right',
      render: (row) => peso(row.vat_exempt_sales),
    },
    { key: 'vat', header: t('admin.colVat'), align: 'right', render: (row) => peso(row.vat_amount) },
    {
      key: 'discount',
      header: t('admin.colDiscount'),
      align: 'right',
      render: (row) => peso(row.discount_amount),
    },
    { key: 'net', header: t('admin.colNet'), align: 'right', render: (row) => peso(row.net_amount) },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) => (
        <div className="table-row-actions">
          <IconButton
            variant="view"
            label={`View ${queueLabel(row.queue_number)}`}
            disabled={loadingDetail}
            onClick={() => handleInspect(row)}
          />
          {row.status !== 'voided' ? (
            <>
              <Button
                variant="secondary"
                icon={Send}
                loading={pushingId === row.txn_id}
                onClick={() => handlePushPos(row)}
              >
                POS
              </Button>
              <Button
                variant="ghost"
                icon={Ban}
                onClick={() => {
                  setVoidReason('Customer cancelled before preparation.');
                  setVoiding(row);
                }}
              >
                Void
              </Button>
            </>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <main className="content-area">
      <header className="page-header">
        <h1>{t('admin.transactionsTitle')}</h1>
        <div className="page-header-actions">
          <Button variant="secondary" icon={RefreshCw} onClick={load}>
            {t('pos.refresh')}
          </Button>
        </div>
      </header>

      <div className="admin-table-scroll">
        <DataTable
          columns={columns}
          rows={paged.slice}
          rowKey={(row) => row.txn_id}
          variant="compact"
          loading={loading}
          emptyMessage={t('admin.transactionsEmpty')}
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

      {viewing ? (
        <Modal
          title={`Transaction #${viewing.txn_id} · ${queueLabel(viewing.queue_number)}`}
          size="large"
          onClose={() => setViewing(null)}
          footer={
            <>
              {viewing.status !== 'voided' ? (
                <Button
                  variant="secondary"
                  icon={Send}
                  loading={pushingId === viewing.txn_id}
                  onClick={() => handlePushPos(viewing)}
                >
                  Transmit to POS
                </Button>
              ) : null}
              <Button
                variant="primary"
                data-modal-cancel="true"
                onClick={() => setViewing(null)}
              >
                {t('common.close')}
              </Button>
            </>
          }
        >
          <dl className="detail-list">
            <dt className="eyebrow">Table</dt>
            <dd>{viewing.table_number ? `Table ${viewing.table_number}` : '—'}</dd>
            <dt className="eyebrow">Placed At</dt>
            <dd>{shortDate(viewing.placed_at)}</dd>
            <dt className="eyebrow">Segment / Declaration</dt>
            <dd>
              <Badge value={viewing.session_type} />{' '}
              <Badge value={viewing.declared_priority_status} />
            </dd>
            <dt className="eyebrow">Order & Payment Status</dt>
            <dd>
              <Badge value={viewing.status} />{' '}
              <Badge value={viewing.payment_status} domain="payment" /> ({viewing.payment_method})
            </dd>
            {viewing.void_reason ? (
              <>
                <dt className="eyebrow">Voided By / Reason</dt>
                <dd>
                  {viewing.voided_by ?? 'Staff'} — {viewing.void_reason}
                </dd>
              </>
            ) : null}
          </dl>

          <h3 className="section-heading" style={{ marginTop: 'var(--space-4)' }}>
            <span className="seal" aria-hidden="true" />
            Order Line Items ({viewing.item_count})
          </h3>
          <ul className="receipt-item-list">
            {viewing.lines.map((line, idx) => (
              <li key={`${line.item_id}-${idx}`} className="receipt-item-row">
                <span className="receipt-item-qty">{line.quantity}×</span>
                <span className="receipt-item-name">
                  {line.name} ({line.item_id})
                </span>
                <span className="receipt-item-price numeric">{peso(line.subtotal)}</span>
              </li>
            ))}
          </ul>

          <dl className="receipt-totals" style={{ marginTop: 'var(--space-3)' }}>
            <div className="receipt-total-row">
              <dt>{t('checkout.gross')}</dt>
              <dd className="numeric">{peso(viewing.gross_amount)}</dd>
            </div>
            <div className="receipt-total-row">
              <dt>{t('checkout.vatable')}</dt>
              <dd className="numeric">{peso(viewing.vatable_sales)}</dd>
            </div>
            <div className="receipt-total-row">
              <dt>{t('checkout.vatExempt')}</dt>
              <dd className="numeric">{peso(viewing.vat_exempt_sales)}</dd>
            </div>
            <div className="receipt-total-row">
              <dt>{t('checkout.vat')}</dt>
              <dd className="numeric">{peso(viewing.vat_amount)}</dd>
            </div>
            <div className="receipt-total-row receipt-discount-row">
              <dt>{t('checkout.discount')}</dt>
              <dd className="numeric">−{peso(viewing.discount_amount)}</dd>
            </div>
            <div className="receipt-total-row receipt-net-row">
              <dt className="receipt-net">{t('checkout.net')}</dt>
              <dd className="receipt-net numeric">{peso(viewing.net_amount)}</dd>
            </div>
          </dl>
        </Modal>
      ) : null}

      {voiding ? (
        <Modal
          title={`Void Transaction · ${queueLabel(voiding.queue_number)}`}
          size="small"
          destructive
          onClose={() => setVoiding(null)}
          footer={
            <>
              <Button variant="wide-delete" loading={voidBusy} onClick={confirmVoid}>
                Confirm Void
              </Button>
              <Button
                variant="secondary"
                data-modal-cancel="true"
                onClick={() => setVoiding(null)}
              >
                {t('common.cancel')}
              </Button>
            </>
          }
        >
          <p>
            Voiding {queueLabel(voiding.queue_number)} ({peso(voiding.net_amount)}) removes it from active sales and logs the action in the audit trail.
          </p>
          <TextInput
            label="Void reason"
            required
            inputClass="freetext"
            maxLength={120}
            value={voidReason}
            onChange={(event) => setVoidReason(event.target.value)}
          />
        </Modal>
      ) : null}
    </main>
  );
}