import { ExternalLink, Printer, QrCode, RefreshCw, RotateCcw, Wifi } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  listTables,
  regenerateTableQr,
  resetTable,
  tableQrImageUrl,
} from '../../api/tables';
import Badge from '../../components/shared/Badge';
import Button from '../../components/shared/Button';
import DataTable from '../../components/shared/DataTable';
import IconButton from '../../components/shared/IconButton';
import Modal from '../../components/shared/Modal';
import TextInput from '../../components/shared/TextInput';
import ViewToggle from '../../components/shared/ViewToggle';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';
import { useUiStore } from '../../store/uiStore';

export default function TablesPage() {
  const { t } = useTranslation();
  const staff = useAuthStore((state) => state.staff);
  const adminView = useUiStore((state) => state.adminView);
  const [tables, setTables] = useState([]);
  const [lanUrl, setLanUrl] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(
    () =>
      listTables()
        .then((catalog) => {
          setTables(catalog.tables);
          setLanUrl(catalog.detected_lan_url);
          setBaseUrl((current) => current || catalog.detected_lan_url);
        })
        .catch((error) => toast.error(error.message))
        .finally(() => setLoading(false)),
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  function scanUrlFor(table) {
    const cleanBase = (baseUrl || lanUrl || window.location.origin).trim().replace(/\/+$/, '');
    return `${cleanBase}/t/${table.qr_token}`;
  }

  async function handleReset(table) {
    setBusyId(table.table_id);
    try {
      await resetTable(table.table_id);
      await load();
      if (selected?.table_id === table.table_id) {
        setSelected((prev) => ({
          ...prev,
          occupancy_status: 'vacant',
          device_count: 0,
          group_mode: false,
        }));
      }
      toast.success(t('admin.tableResetSuccess', { number: table.table_number }));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleRegenerate(table) {
    setBusyId(table.table_id);
    try {
      const updated = await regenerateTableQr(table.table_id);
      await load();
      if (selected?.table_id === table.table_id) {
        setSelected(updated);
      }
      toast.success(t('admin.tableQrRegenerated', { number: table.table_number }));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusyId(null);
    }
  }

  const columns = [
    {
      key: 'number',
      header: t('admin.colTable'),
      render: (row) => (
        <span className="font-bold numeric">
          {t('menu.table', { number: row.table_number })} ({row.table_id})
        </span>
      ),
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => <Badge value={row.occupancy_status} />,
    },
    {
      key: 'devices',
      header: t('admin.colDevices'),
      align: 'right',
      render: (row) => (row.device_count > 0 ? row.device_count : '—'),
    },
    {
      key: 'segment',
      header: t('admin.colSegment'),
      render: (row) => (row.session_type ? <Badge value={row.session_type} /> : '—'),
    },
    {
      key: 'url',
      header: t('admin.colScanUrl'),
      render: (row) => (
        <a
          href={`/t/${row.qr_token}`}
          target="_blank"
          rel="noreferrer"
          className="qr-table-link numeric"
        >
          /t/{String(row.qr_token).slice(0, 8)}…
        </a>
      ),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) => (
        <div className="table-row-actions">
          <IconButton
            variant="view"
            label={t('admin.viewQr', { number: row.table_number })}
            onClick={() => setSelected(row)}
          />
          {row.occupancy_status === 'occupied' ? (
            <Button
              variant="secondary"
              loading={busyId === row.table_id}
              onClick={() => handleReset(row)}
            >
              {t('admin.resetTable')}
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <main className="content-area">
      <header className="page-header">
        <h1>{t('admin.tablesTitle')}</h1>
        <div className="page-header-actions">
          <Button variant="secondary" icon={RefreshCw} onClick={load}>
            {t('pos.refresh')}
          </Button>
          <ViewToggle />
        </div>
      </header>

      <section className="qr-lan-banner">
        <div className="qr-lan-info">
          <div className="qr-lan-title-row">
            <Wifi size={18} strokeWidth={2} className="tile-icon" />
            <strong>{t('admin.lanHostTitle')}</strong>
          </div>
          <p className="verifications-note">{t('admin.lanHostNote')}</p>
        </div>
        <div className="qr-lan-controls">
          <TextInput
            label={t('admin.qrBaseUrlLabel')}
            inputClass="freetext"
            maxLength={120}
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
          />
          <div className="qr-lan-presets">
            <Button
              variant="secondary"
              onClick={() => setBaseUrl(lanUrl || window.location.origin)}
            >
              {t('admin.useLanIp')} ({lanUrl || window.location.origin})
            </Button>
            <Button variant="ghost" onClick={() => setBaseUrl(window.location.origin)}>
              {t('admin.useBrowserOrigin')}
            </Button>
          </div>
        </div>
      </section>

      {adminView === 'list' ? (
        <div className="admin-table-scroll">
          <DataTable
            columns={columns}
            rows={tables}
            rowKey={(row) => row.table_id}
            loading={loading}
            emptyMessage={t('admin.tablesEmpty')}
          />
        </div>
      ) : loading ? null : (
        <div className="tile-grid qr-tile-grid">
          {tables.map((table) => {
            const imgSrc = tableQrImageUrl(table.table_id, baseUrl);
            const fullUrl = scanUrlFor(table);
            return (
              <article className="tile qr-table-tile" key={table.table_id}>
                <div className="qr-tile-header">
                  <div>
                    <span className="eyebrow numeric">{table.table_id}</span>
                    <h2 className="tile-name">
                      {t('menu.table', { number: table.table_number })}
                    </h2>
                  </div>
                  <Badge value={table.occupancy_status} />
                </div>

                <button
                  type="button"
                  className="qr-tile-preview"
                  onClick={() => setSelected(table)}
                  aria-label={t('admin.viewQr', { number: table.table_number })}
                >
                  <img src={imgSrc} alt={`QR Table ${table.table_number}`} />
                </button>

                <div className="tile-body qr-tile-body">
                  <p className="tile-meta numeric qr-url-preview">{fullUrl}</p>
                  <div className="qr-tile-stats">
                    <span>
                      {t('admin.colDevices')}:{' '}
                      <strong className="numeric">{table.device_count}</strong>
                    </span>
                    {table.session_type ? <Badge value={table.session_type} /> : null}
                  </div>
                </div>

                <div className="tile-actions qr-tile-actions">
                  <Button
                    variant="secondary"
                    icon={QrCode}
                    onClick={() => setSelected(table)}
                  >
                    {t('admin.enlargeQr')}
                  </Button>
                  <a
                    href={`/t/${table.qr_token}`}
                    target="_blank"
                    rel="noreferrer"
                    className="qr-open-link"
                  >
                    <ExternalLink size={16} strokeWidth={2} />
                    <span>{t('admin.openTable')}</span>
                  </a>
                  {table.occupancy_status === 'occupied' ? (
                    <Button
                      variant="ghost"
                      loading={busyId === table.table_id}
                      onClick={() => handleReset(table)}
                    >
                      {t('admin.resetTable')}
                    </Button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {selected ? (
        <Modal
          title={`${t('menu.table', { number: selected.table_number })} · ${selected.table_id}`}
          size="small"
          onClose={() => setSelected(null)}
          footer={
            <>
              <Button variant="secondary" icon={Printer} onClick={() => window.print()}>
                {t('admin.printQr')}
              </Button>
              {staff?.role === 'admin' ? (
                <Button
                  variant="secondary"
                  icon={RotateCcw}
                  loading={busyId === selected.table_id}
                  onClick={() => handleRegenerate(selected)}
                >
                  {t('admin.rotateQr')}
                </Button>
              ) : null}
              <Button
                variant="primary"
                data-modal-cancel="true"
                onClick={() => setSelected(null)}
              >
                {t('common.close')}
              </Button>
            </>
          }
        >
          <div className="qr-modal-tent">
            <p className="eyebrow">{t('auth.brand')}</p>
            <h3 className="qr-modal-table-title">
              {t('menu.table', { number: selected.table_number })}
            </h3>
            <div className="qr-modal-img-wrap">
              <img
                src={tableQrImageUrl(selected.table_id, baseUrl)}
                alt={`QR Table ${selected.table_number}`}
              />
            </div>
            <p className="qr-modal-instruction">{t('admin.scanInstruction')}</p>
            <p className="qr-modal-url numeric">{scanUrlFor(selected)}</p>
          </div>
        </Modal>
      ) : null}
    </main>
  );
}
