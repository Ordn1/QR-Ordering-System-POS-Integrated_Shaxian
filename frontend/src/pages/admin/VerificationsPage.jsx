import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { fetchVerificationDetail, fetchVerifications } from '../../api/analytics';
import Badge from '../../components/shared/Badge';
import Button from '../../components/shared/Button';
import DataTable from '../../components/shared/DataTable';
import IconButton from '../../components/shared/IconButton';
import Modal from '../../components/shared/Modal';
import Pagination from '../../components/shared/Pagination';
import usePagination from '../../hooks/usePagination';
import { shortDate } from '../../lib/format';
import { toast } from '../../store/toastStore';

export default function VerificationsPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState(null);
  const [loadingDetailId, setLoadingDetailId] = useState(null);
  const paged = usePagination(rows);

  useEffect(() => {
    fetchVerifications()
      .then(setRows)
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleInspect(row) {
    setLoadingDetailId(row.log_id);
    try {
      const detail = await fetchVerificationDetail(row.log_id);
      setViewing(detail);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoadingDetailId(null);
    }
  }

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
      render: (row) => (row.id_last4 ? <span className="numeric">{`•••• ${row.id_last4}`}</span> : '—'),
    },
    {
      key: 'cardholder',
      header: t('admin.colCardholder'),
      render: (row) => (row.cardholder_name ? <span className="numeric">{row.cardholder_name}</span> : '—'),
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
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) => (
        <IconButton
          variant="view"
          label={`${t('common.view')} #${row.log_id}`}
          disabled={loadingDetailId === row.log_id}
          onClick={() => handleInspect(row)}
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

      {viewing ? (
        <Modal
          title={`${t('admin.verificationsTitle')} · #${viewing.log_id}`}
          size="small"
          onClose={() => setViewing(null)}
          footer={
            <Button
              variant="primary"
              data-modal-cancel="true"
              onClick={() => setViewing(null)}
            >
              {t('common.close')}
            </Button>
          }
        >
          <dl className="detail-list">
            <dt className="eyebrow">{t('admin.colDeclared')}</dt>
            <dd>
              <Badge value={viewing.declared_status} />
            </dd>
            <dt className="eyebrow">{t('admin.colDeclaredAt')}</dt>
            <dd>{shortDate(viewing.declared_at)}</dd>
            <dt className="eyebrow">{t('admin.colIdPresented')}</dt>
            <dd>{viewing.id_presented ? t('common.yes') : t('common.no')}</dd>
            <dt className="eyebrow">{t('admin.colIdLast4')}</dt>
            <dd className="numeric">{viewing.id_last4 ? `•••• ${viewing.id_last4}` : '—'}</dd>
            <dt className="eyebrow">{t('admin.colCardholder')}</dt>
            <dd>{viewing.cardholder_name ?? '—'}</dd>
            <dt className="eyebrow">{t('admin.colIssuingLgu')}</dt>
            <dd>{viewing.issuing_lgu ?? '—'}</dd>
            <dt className="eyebrow">{t('admin.colVerifiedBy')}</dt>
            <dd>{viewing.verified_by ?? '—'}</dd>
            <dt className="eyebrow">{t('admin.colDiscountEligible')}</dt>
            <dd>
              <Badge
                value={viewing.discount_eligible ? 'available' : 'sold out'}
                label={viewing.discount_eligible ? t('common.yes') : t('common.no')}
              />
            </dd>
          </dl>
        </Modal>
      ) : null}
    </main>
  );
}