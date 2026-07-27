import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { fetchVerifications } from '../../api/analytics';
import Badge from '../../components/shared/Badge';
import DataTable from '../../components/shared/DataTable';
import { shortDate } from '../../lib/format';
import { toast } from '../../store/toastStore';
import Pagination from '../../components/shared/Pagination';
import usePagination from '../../hooks/usePagination';

/**
 * The priority-declaration audit trail required by RA 9994 / RA 10754 record-keeping.
 * Only the last four digits of a presented ID are stored, so nothing here identifies
 * a cardholder on its own.
 */
export default function VerificationsPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const paged = usePagination(rows);

  useEffect(() => {
    fetchVerifications()
      .then(setRows)
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, []);

  const columns = [
    {
      key: 'declared',
      header: t('admin.colDeclared'),
      render: (row) => <Badge value={row.declared_status} />,
    },
    {
      key: 'when',
      header: t('admin.colDeclaredAt'),
      render: (row) => shortDate(row.declared_at),
    },
    {
      key: 'presented',
      header: t('admin.colIdPresented'),
      render: (row) => (row.id_presented ? t('common.yes') : t('common.no')),
    },
    {
      key: 'last4',
      header: t('admin.colIdLast4'),
      render: (row) => (row.id_last4 ? `•••• ${row.id_last4}` : '—'),
    },
    {
      key: 'cardholder',
      header: t('admin.colCardholder'),
      render: (row) => row.cardholder_name ?? '—',
    },
    { key: 'lgu', header: t('admin.colIssuingLgu'), render: (row) => row.issuing_lgu ?? '—' },
    { key: 'by', header: t('admin.colVerifiedBy'), render: (row) => row.verified_by ?? '—' },
    {
      key: 'eligible',
      header: t('admin.colDiscountEligible'),
      render: (row) => (
        <Badge
          value={row.discount_eligible ? 'available' : 'sold out'}
          label={row.discount_eligible ? t('common.yes') : t('common.no')}
        />
      ),
    },
  ];

  return (
    <main className="content-area">
      <header className="page-header">
        <h1>{t('admin.verificationsTitle')}</h1>
      </header>

      <p className="verifications-note">{t('admin.verificationsNote')}</p>

      <div className="admin-table-scroll">
        <DataTable
          columns={columns}
          rows={paged.slice}
          rowKey={(row) => row.log_id}
          variant="compact"
          loading={loading}
          emptyMessage={t('admin.verificationsEmpty')}
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
