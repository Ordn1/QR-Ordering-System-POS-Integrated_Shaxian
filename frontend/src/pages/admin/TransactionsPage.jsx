import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { listTransactions } from '../../api/transactions';
import Badge from '../../components/shared/Badge';
import DataTable from '../../components/shared/DataTable';
import { peso, queueLabel, shortDate } from '../../lib/format';
import { toast } from '../../store/toastStore';
import Pagination from '../../components/shared/Pagination';
import usePagination from '../../hooks/usePagination';

export default function TransactionsPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const paged = usePagination(rows);

  useEffect(() => {
    listTransactions()
      .then(setRows)
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, []);

  const columns = [
    { key: 'queue', header: t('admin.colQueue'), render: (row) => queueLabel(row.queue_number) },
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
  ];

  return (
    <main className="content-area">
      <header className="page-header">
        <h1>{t('admin.transactionsTitle')}</h1>
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
    </main>
  );
}
