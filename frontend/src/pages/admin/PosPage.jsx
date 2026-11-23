import {
  CheckCircle2,
  Printer,
  QrCode,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  UtensilsCrossed,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { listCategories } from '../../api/menu';
import {
  createPosOrder,
  fetchBridgeStatus,
  fetchTransmissions,
  listRegisterItems,
  transmit,
} from '../../api/pos';
import * as queueApi from '../../api/queue';
import { listTables } from '../../api/tables';
import RegisterReceipt from '../../components/admin/RegisterReceipt';
import Badge from '../../components/shared/Badge';
import Button from '../../components/shared/Button';
import Card from '../../components/shared/Card';
import DataTable from '../../components/shared/DataTable';
import Modal from '../../components/shared/Modal';
import Pagination from '../../components/shared/Pagination';
import RegisterCode from '../../components/shared/RegisterCode';
import SelectField from '../../components/shared/SelectField';
import usePagination from '../../hooks/usePagination';
import { useWebSocket } from '../../hooks/useWebSocket';
import AssistanceAlerts from '../../components/staff/AssistanceAlerts';
import CashierConfirmModal from '../../components/staff/CashierConfirmModal';
import RegisterCodeList from '../../components/staff/RegisterCodeList';
import TenderPicker from '../../components/staff/TenderPicker';
import { peso, queueLabel, shortDate } from '../../lib/format';
import { menuImageUrl } from '../../lib/menuImage';
import { tenderReady } from '../../lib/tender';
import { toast } from '../../store/toastStore';

const PRIORITY_OPTIONS = [
  { value: 'standard', label: 'Standard (12% VAT)' },
  { value: 'senior', label: 'Senior (20% Off + Exempt)' },
  { value: 'pwd', label: 'PWD (20% Off + Exempt)' },
  { value: 'pregnant', label: 'Pregnant (Priority)' },
];

function roundCentavo(val) {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

function parseQueueCode(raw) {
  const cleaned = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/^Q-?/, '');
  const parsed = Number.parseInt(cleaned, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function PosPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('register');
  const [status, setStatus] = useState(null);
  const [rows, setRows] = useState([]);
  const [queueEntries, setQueueEntries] = useState([]);
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [tables, setTables] = useState([]);
  const [selectedCat, setSelectedCat] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showBarcodes, setShowBarcodes] = useState(false);

  const [queueCodeInput, setQueueCodeInput] = useState('');
  const [recalledTxnId, setRecalledTxnId] = useState(null);
  const [settling, setSettling] = useState(null);

  const [tableId, setTableId] = useState('TBL-0001');
  const [priorityStatus, setPriorityStatus] = useState('standard');
  const [walkInIdConfirmed, setWalkInIdConfirmed] = useState(false);
  const [posCart, setPosCart] = useState([]);
  const [walkInTender, setWalkInTender] = useState('cash');
  const [cashTendered, setCashTendered] = useState(null);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [issuedReceipt, setIssuedReceipt] = useState(null);

  const [loading, setLoading] = useState(true);
  const [inspecting, setInspecting] = useState(null);
  const [retryingId, setRetryingId] = useState(null);
  const paged = usePagination(rows);

  const load = useCallback(
    () =>
      Promise.all([
        fetchBridgeStatus(),
        fetchTransmissions(),
        queueApi.listQueue(),
        listCategories(),
        listRegisterItems(),
        listTables(),
      ])
        .then(([nextStatus, nextRows, nextQueue, nextCats, nextItems, tableCatalog]) => {
          setStatus(nextStatus);
          setRows(nextRows);
          setQueueEntries(nextQueue);
          setCategories(nextCats.filter((c) => c.is_active));
          setMenuItems(nextItems.filter((i) => i.is_available));
          const activeTables = tableCatalog?.tables ?? [];
          setTables(activeTables);
          if (activeTables.length > 0) {
            setTableId((curr) => curr || activeTables[0].table_id);
          }
        })
        .catch((error) => toast.error(error.message))
        .finally(() => setLoading(false)),
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  useWebSocket(
    '/ws/kitchen',
    useCallback((payload) => payload?.type !== 'assistance_changed' && load(), [load]),
  );

  const pendingQrOrders = useMemo(
    () =>
      queueEntries
        .filter((entry) => entry.payment_status !== 'paid')
        .sort((a, b) => Number(a.queue_number) - Number(b.queue_number)),
    [queueEntries],
  );

  const recalledOrder = useMemo(
    () =>
      recalledTxnId !== null
        ? queueEntries.find((entry) => entry.txn_id === recalledTxnId) ?? null
        : null,
    [queueEntries, recalledTxnId],
  );

  const recalledDue = recalledOrder
    ? Number(recalledOrder.unpaid_amount) > 0
      ? Number(recalledOrder.unpaid_amount)
      : Number(recalledOrder.net_amount ?? 0)
    : 0;
  const claimDevices = new Set(
    (recalledOrder?.pending_verifications ?? []).map((claim) => claim.device_id),
  );
  const recalledDiscounted = (item) => claimDevices.has(item.device_id) || item.is_discounted;

  function selectRecalledOrder(entry) {
    setRecalledTxnId(entry.txn_id);
    setQueueCodeInput(queueLabel(entry.queue_number));
  }

  function handleRecallSubmit(event) {
    if (event) {
      event.preventDefault();
    }
    const targetNum = parseQueueCode(queueCodeInput);
    if (targetNum === null) {
      toast.error('Enter a valid Queue Number (for example: Q-049 or 49).');
      return;
    }
    const matches = queueEntries.filter(
      (entry) => Number(entry.queue_number) === targetNum,
    );
    const match =
      matches.find((entry) => entry.payment_status !== 'paid') ?? matches[0];
    if (!match) {
      toast.error(`Queue order ${queueLabel(targetNum)} was not found in the active queue.`);
      return;
    }
    selectRecalledOrder(match);
    toast.success(
      `Loaded QR Order ${queueLabel(match.queue_number)} (Table ${match.table_number}) into POS Register.`,
    );
  }

  function switchToWalkInMode() {
    setRecalledTxnId(null);
    setQueueCodeInput('');
    setCashTendered(null);
    setWalkInIdConfirmed(false);
  }

  const walkInDiscounted = priorityStatus === 'senior' || priorityStatus === 'pwd';

  const walkInTotals = useMemo(() => {
    let gross = 0;
    let vatable = 0;
    let vatExempt = 0;
    let vat = 0;
    let discount = 0;
    let net = 0;
    let count = 0;

    for (const line of posCart) {
      const lineGross = roundCentavo(Number(line.price) * line.quantity);
      count += line.quantity;
      gross = roundCentavo(gross + lineGross);

      if (walkInDiscounted) {
        const lineExempt = roundCentavo(lineGross / 1.12);
        const lineDisc = roundCentavo(lineExempt * 0.2);
        const lineNet = roundCentavo(lineExempt - lineDisc);
        vatExempt = roundCentavo(vatExempt + lineExempt);
        discount = roundCentavo(discount + lineDisc);
        net = roundCentavo(net + lineNet);
      } else {
        const lineVatable = roundCentavo(lineGross / 1.12);
        const lineVat = roundCentavo(lineGross - lineVatable);
        vatable = roundCentavo(vatable + lineVatable);
        vat = roundCentavo(vat + lineVat);
        net = roundCentavo(net + lineGross);
      }
    }
    return { gross, vatable, vatExempt, vat, discount, net, count };
  }, [posCart, walkInDiscounted]);

  const walkInCash = cashTendered ?? walkInTotals.net.toFixed(2);
  const walkInReady = tenderReady(walkInTender, walkInCash, walkInTotals.net);

  function addToPosCart(item) {
    if (recalledOrder) {
      toast.error(
        `POS is showing Recalled QR Order ${queueLabel(recalledOrder.queue_number)}. Click "Walk-In Mode" first to ring up a counter order.`,
      );
      return;
    }
    setPosCart((current) => {
      const existing = current.find((line) => line.item_id === item.item_id);
      if (existing) {
        return current.map((line) =>
          line.item_id === item.item_id
            ? { ...line, quantity: line.quantity + 1 }
            : line,
        );
      }
      return [
        ...current,
        {
          item_id: item.item_id,
          pos_code: item.pos_code,
          name: item.name_en,
          price: Number(item.price),
          quantity: 1,
        },
      ];
    });
  }

  function updatePosQty(itemId, delta) {
    setPosCart((current) =>
      current
        .map((line) =>
          line.item_id === itemId
            ? { ...line, quantity: line.quantity + delta }
            : line,
        )
        .filter((line) => line.quantity > 0),
    );
  }

  function clearPosTicket() {
    setPosCart([]);
    setCashTendered(null);
    setWalkInTender('cash');
    setPriorityStatus('standard');
    setWalkInIdConfirmed(false);
  }

  function handleSettled() {
    switchToWalkInMode();
    load();
  }

  async function handlePunchCounterOrder() {
    if (posCart.length === 0) {
      toast.error('Add at least one dish to the POS ticket first.');
      return;
    }
    if (walkInDiscounted && !walkInIdConfirmed) {
      toast.error('Check the physical Senior/PWD ID card and tap "Confirm ID is Legit" first.');
      return;
    }
    if (!walkInReady) {
      toast.error(`Enter cash tendered of at least ${peso(walkInTotals.net)}.`);
      return;
    }

    setSubmittingOrder(true);
    try {
      const result = await createPosOrder({
        table_id: tableId,
        declared_priority_status: priorityStatus,
        id_confirmed: walkInDiscounted && walkInIdConfirmed,
        tender: walkInTender,
        cash_tendered: walkInTender === 'cash' ? Number(walkInCash).toFixed(2) : null,
        items: posCart.map((line) => ({
          item_id: line.item_id,
          quantity: line.quantity,
        })),
      });
      toast.success(t('pos.punched', { queue: queueLabel(result.queue_number) }));
      setIssuedReceipt(result);
      clearPosTicket();
      await load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSubmittingOrder(false);
    }
  }

  async function handleRetransmit(row) {
    if (!row.txn_id) {
      return;
    }
    setRetryingId(row.audit_id);
    try {
      const result = await transmit(row.txn_id);
      await load();
      toast.success(
        `Re-sent ${queueLabel(row.queue_number)} to POS (${result.receipt_no ?? result.status}).`,
      );
    } catch (error) {
      toast.error(error.message);
    } finally {
      setRetryingId(null);
    }
  }

  const filteredMenu = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return menuItems.filter((item) => {
      const matchesCat = selectedCat === 'ALL' || item.cat_id === selectedCat;
      const matchesQuery =
        !query ||
        item.name_en.toLowerCase().includes(query) ||
        item.item_id.toLowerCase().includes(query) ||
        (item.pos_code ?? '').toLowerCase().startsWith(query);
      return matchesCat && matchesQuery;
    });
  }, [menuItems, selectedCat, searchQuery]);

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
        <div className="table-row-actions">
          <Button variant="wide-view" onClick={() => setInspecting(row)}>
            {t('pos.viewPayload')}
          </Button>
          {row.txn_id ? (
            <Button
              variant="secondary"
              loading={retryingId === row.audit_id}
              onClick={() => handleRetransmit(row)}
            >
              Re-send
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  const latest = rows.find((row) => row.status === 'acknowledged') ?? null;

  return (
    <main
      className="content-area"
      style={{
        maxWidth: '100%',
        width: '100%',
        padding: 'var(--space-4) var(--space-5)',
      }}
    >
      <header
        className="page-header"
        style={{ marginBottom: 'var(--space-3)' }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Cashier POS Register</h1>
          <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)' }}>
            Unified Counter Terminal · Walk-In Orders & QR Queue Recall
          </span>
        </div>
        <div className="page-header-actions">
          <label className="switch-field">
            <input
              type="checkbox"
              role="switch"
              checked={showBarcodes}
              onChange={(event) => setShowBarcodes(event.target.checked)}
            />
            <span>{t('pos.showBarcodes')}</span>
          </label>
          <Button
            variant={activeTab === 'register' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('register')}
          >
            POS Terminal ({pendingQrOrders.length} QR Unpaid)
          </Button>
          <Button
            variant={activeTab === 'log' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('log')}
          >
            {t('pos.logTab', { count: rows.length })}
          </Button>
          <Button variant="secondary" icon={RefreshCw} onClick={load}>
            {t('pos.refresh')}
          </Button>
        </div>
      </header>

      <AssistanceAlerts />

      {activeTab === 'register' ? (
        <div className="stack-4">
          <section
            style={{
              background: 'var(--surface, #ffffff)',
              border: '1px solid var(--border-strong, #c9c4bc)',
              padding: 'var(--space-3) var(--space-4)',
              display: 'grid',
              gridTemplateColumns: 'minmax(320px, 460px) 1fr',
              gap: 'var(--space-4)',
              alignItems: 'center',
            }}
          >
            <form onSubmit={handleRecallSubmit}>
              <label
                htmlFor="pos-qr-recall-input"
                className="eyebrow"
                style={{ display: 'block', marginBottom: '6px' }}
              >
                Recall Customer QR Order by Queue Code
              </label>
              <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'stretch' }}>
                <input
                  id="pos-qr-recall-input"
                  type="text"
                  className="text-input"
                  placeholder="Type Q-049 or 49…"
                  maxLength={12}
                  value={queueCodeInput}
                  onChange={(event) => setQueueCodeInput(event.target.value)}
                  style={{ flex: 1, minWidth: '140px' }}
                />
                <Button type="submit" variant="primary" icon={Search}>
                  Recall QR
                </Button>
                {recalledOrder ? (
                  <Button
                    type="button"
                    variant="secondary"
                    icon={RotateCcw}
                    onClick={switchToWalkInMode}
                  >
                    Walk-In Mode
                  </Button>
                ) : null}
              </div>
            </form>

            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '6px',
                }}
              >
                <span className="eyebrow">
                  Waiting Unpaid QR Orders at Counter ({pendingQrOrders.length}) — Tap to Ring Up
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 'var(--space-2)',
                  maxHeight: '88px',
                  overflowY: 'auto',
                }}
              >
                {pendingQrOrders.length === 0 ? (
                  <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)' }}>
                    No unpaid QR orders waiting right now. Tap any dish below to punch a walk-in counter order.
                  </span>
                ) : (
                  pendingQrOrders.map((entry) => {
                    const isSelected = recalledOrder?.txn_id === entry.txn_id;
                    const due =
                      Number(entry.unpaid_amount) > 0
                        ? Number(entry.unpaid_amount)
                        : Number(entry.net_amount ?? 0);
                    return (
                      <Button
                        key={entry.txn_id}
                        variant={isSelected ? 'primary' : 'secondary'}
                        icon={QrCode}
                        onClick={() => selectRecalledOrder(entry)}
                      >
                        {queueLabel(entry.queue_number)} · T{entry.table_number} · {peso(due)}
                      </Button>
                    );
                  })
                )}
              </div>
            </div>
          </section>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) 460px',
              gap: 'var(--space-4)',
              alignItems: 'start',
            }}
          >
            <Card title={`POS Menu Catalog (${filteredMenu.length} dishes)`}>
              {recalledOrder ? (
                <div
                  style={{
                    padding: 'var(--space-3)',
                    marginBottom: 'var(--space-3)',
                    border: '2px solid var(--red-primary, #9e1b1b)',
                    background: 'var(--cream, #f7f3eb)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                  }}
                >
                  <div>
                    <strong>
                      Settling Recalled QR Order {queueLabel(recalledOrder.queue_number)} · Table {recalledOrder.table_number}
                    </strong>
                    <p style={{ margin: '2px 0 0', fontSize: 'var(--font-sm)' }}>
                      Key the codes into Columbia POS, then settle on the right, or switch to Walk-In Mode to punch a new counter order.
                    </p>
                  </div>
                  <Button variant="secondary" icon={RotateCcw} onClick={switchToWalkInMode}>
                    Switch to Walk-In
                  </Button>
                </div>
              ) : null}

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(220px, 320px) 1fr',
                  gap: 'var(--space-3)',
                  alignItems: 'center',
                  marginBottom: 'var(--space-3)',
                }}
              >
                <input
                  type="text"
                  className="text-input"
                  placeholder={t('pos.searchPlaceholder')}
                  maxLength={60}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />

                <div
                  className="menu-category-tabs"
                  role="tablist"
                  style={{ margin: 0 }}
                >
                  <button
                    type="button"
                    role="tab"
                    className="menu-category-tab"
                    aria-selected={selectedCat === 'ALL'}
                    onClick={() => setSelectedCat('ALL')}
                  >
                    All ({menuItems.length})
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.cat_id}
                      type="button"
                      role="tab"
                      className="menu-category-tab"
                      aria-selected={selectedCat === cat.cat_id}
                      onClick={() => setSelectedCat(cat.cat_id)}
                    >
                      {cat.name_en}
                    </button>
                  ))}
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(185px, 1fr))',
                  gap: 'var(--space-3)',
                }}
              >
                {filteredMenu.map((item) => {
                  const src = menuImageUrl(item.image_filename);
                  const inTicket = posCart.find((l) => l.item_id === item.item_id);
                  return (
                    <button
                      key={item.item_id}
                      type="button"
                      onClick={() => addToPosCart(item)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        textAlign: 'left',
                        padding: 'var(--space-2)',
                        border: inTicket
                          ? '2px solid var(--red-primary, #9e1b1b)'
                          : '1px solid var(--border, #d6d3cd)',
                        background: 'var(--surface, #ffffff)',
                        cursor: 'pointer',
                        gap: '6px',
                        opacity: recalledOrder ? 0.6 : 1,
                      }}
                    >
                      <div
                        style={{
                          width: '100%',
                          height: '110px',
                          background: 'var(--cream, #f7f3eb)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                        }}
                      >
                        {src ? (
                          <img
                            src={src}
                            alt=""
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <UtensilsCrossed size={24} />
                        )}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          width: '100%',
                        }}
                      >
                        {item.pos_code ? (
                          <RegisterCode code={item.pos_code} />
                        ) : (
                          <span className="eyebrow numeric">{item.item_id}</span>
                        )}
                        {inTicket ? (
                          <Badge value="available" label={`${inTicket.quantity}×`} />
                        ) : null}
                      </div>
                      <strong
                        style={{
                          fontSize: 'var(--font-sm)',
                          lineHeight: 1.25,
                          minHeight: '2.5em',
                        }}
                      >
                        {item.name_en}
                      </strong>
                      <span className="numeric font-bold">{peso(item.price)}</span>
                    </button>
                  );
                })}
              </div>
            </Card>

            <div style={{ position: 'sticky', top: 'calc(var(--h-navbar, 64px) + var(--space-3))' }}>
              <Card
                title={
                  recalledOrder
                    ? `Active Ticket · QR Order ${queueLabel(recalledOrder.queue_number)}`
                    : 'Active Ticket · Walk-In Counter Order'
                }
              >
                {recalledOrder ? (
                  <div className="stack-3">
                    <div
                      style={{
                        padding: 'var(--space-3)',
                        border: '2px solid var(--red-primary, #9e1b1b)',
                        background: 'var(--cream, #f7f3eb)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                      }}
                    >
                      <div>
                        <span className="eyebrow">Recalled QR Table Order</span>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-2)',
                            marginTop: '4px',
                          }}
                        >
                          <strong className="numeric" style={{ fontSize: 'var(--font-lg)' }}>
                            {queueLabel(recalledOrder.queue_number)}
                          </strong>
                          <span>· Table {recalledOrder.table_number}</span>
                          <Badge value={recalledOrder.declared_priority_status} />
                          <Badge value={recalledOrder.payment_status} />
                        </div>
                      </div>
                      <Button variant="secondary" onClick={switchToWalkInMode}>
                        Clear
                      </Button>
                    </div>

                    <p className="eyebrow">{t('staff.keyIntoColumbia')}</p>
                    <RegisterCodeList
                      items={recalledOrder.items ?? []}
                      isDiscounted={recalledDiscounted}
                      showBarcodes={showBarcodes}
                    />

                    <dl className="receipt-totals">
                      <div className="receipt-total-row">
                        <dt>{t('checkout.gross')}</dt>
                        <dd className="numeric">{peso(recalledOrder.gross_amount)}</dd>
                      </div>
                      {Number(recalledOrder.discount_amount) > 0 ? (
                        <>
                          {Number(recalledOrder.vat_exempt_sales) > 0 ? (
                            <div className="receipt-total-row">
                              <dt>{t('checkout.vatExempt')}</dt>
                              <dd className="numeric">{peso(recalledOrder.vat_exempt_sales)}</dd>
                            </div>
                          ) : null}
                          <div className="receipt-total-row receipt-discount-row">
                            <dt>{t('checkout.discount')}</dt>
                            <dd className="numeric">−{peso(recalledOrder.discount_amount)}</dd>
                          </div>
                        </>
                      ) : (
                        <>
                          {Number(recalledOrder.vatable_sales) > 0 ? (
                            <div className="receipt-total-row">
                              <dt>{t('checkout.vatable')}</dt>
                              <dd className="numeric">{peso(recalledOrder.vatable_sales)}</dd>
                            </div>
                          ) : null}
                          <div className="receipt-total-row">
                            <dt>{t('checkout.vat')}</dt>
                            <dd className="numeric">{peso(recalledOrder.vat_amount)}</dd>
                          </div>
                        </>
                      )}
                      <div className="receipt-total-row receipt-net-row">
                        <dt className="receipt-net">Order Total</dt>
                        <dd className="receipt-net numeric">{peso(recalledOrder.net_amount)}</dd>
                      </div>
                      {Number(recalledOrder.unpaid_amount) > 0 &&
                        Number(recalledOrder.unpaid_amount) < Number(recalledOrder.net_amount) ? (
                        <div className="receipt-total-row receipt-net-row">
                          <dt className="receipt-net">Balance Due Now</dt>
                          <dd className="receipt-net numeric">{peso(recalledOrder.unpaid_amount)}</dd>
                        </div>
                      ) : null}
                    </dl>

                    {recalledOrder.payment_status === 'paid' ? (
                      <div
                        style={{
                          padding: 'var(--space-3)',
                          border: '1px solid var(--border, #d6d3cd)',
                          background: 'var(--cream, #f7f3eb)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--space-2)',
                        }}
                      >
                        <CheckCircle2 size={20} className="text-green" />
                        <strong>This QR order is already Paid in full.</strong>
                      </div>
                    ) : (
                      <>
                        {recalledOrder.pending_verifications?.length ? (
                          <p className="cash-id-needed">{t('pos.idCheckNext')}</p>
                        ) : null}
                        <Button
                          variant="checkout"
                          icon={ShoppingBag}
                          onClick={() => setSettling(recalledOrder)}
                        >
                          {t('pos.settleOrder', { amount: peso(recalledDue) })}
                        </Button>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="stack-3">
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 'var(--space-2)',
                      }}
                    >
                      <SelectField
                        label="Table"
                        required
                        value={tableId}
                        onChange={(event) => setTableId(event.target.value)}
                        options={tables.map((tbl) => ({
                          value: tbl.table_id,
                          label: `Table ${tbl.table_number} (${tbl.occupancy_status})`,
                        }))}
                      />

                      <SelectField
                        label="Customer Type"
                        required
                        value={priorityStatus}
                        onChange={(event) => {
                          setPriorityStatus(event.target.value);
                          setWalkInIdConfirmed(false);
                        }}
                        options={PRIORITY_OPTIONS}
                      />
                    </div>

                    {walkInDiscounted ? (
                      <div
                        className="stack-2"
                        style={{
                          padding: 'var(--space-3)',
                          border: '1px solid var(--border, #d6d3cd)',
                          background: 'var(--cream, #f7f3eb)',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <strong style={{ fontSize: 'var(--font-sm)' }}>
                            Physical OSCA / PWD ID Verification (20% Off + VAT Exempt)
                          </strong>
                          {walkInIdConfirmed ? (
                            <Badge value="paid" label="ID Verified" />
                          ) : (
                            <Badge value="pending" label="Inspect Physical ID" />
                          )}
                        </div>
                        <p className="cash-id-prompt">{t('staff.idLookPrompt')}</p>
                        {walkInIdConfirmed ? (
                          <Button variant="secondary" onClick={() => setWalkInIdConfirmed(false)}>
                            Undo ID Confirmation
                          </Button>
                        ) : (
                          <Button
                            variant="primary"
                            icon={ShieldCheck}
                            onClick={() => setWalkInIdConfirmed(true)}
                          >
                            Confirm ID is Legit
                          </Button>
                        )}
                      </div>
                    ) : null}

                    <div
                      style={{
                        borderTop: '1px solid var(--border, #d6d3cd)',
                        paddingTop: 'var(--space-2)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 'var(--space-2)',
                        }}
                      >
                        <strong>Ticket Items ({walkInTotals.count})</strong>
                        {posCart.length > 0 ? (
                          <Button variant="ghost" icon={Trash2} onClick={clearPosTicket}>
                            Clear
                          </Button>
                        ) : null}
                      </div>

                      {posCart.length === 0 ? (
                        <p className="verifications-note" style={{ margin: 'var(--space-2) 0' }}>
                          Tap dishes on the left to build a walk-in order, or recall a QR Queue # above.
                        </p>
                      ) : (
                        <ul
                          className="receipt-item-list"
                          style={{ maxHeight: '220px', overflowY: 'auto' }}
                        >
                          {posCart.map((line) => (
                            <li
                              key={line.item_id}
                              className="receipt-item-row"
                              style={{ alignItems: 'center' }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                }}
                              >
                                <Button
                                  variant="secondary"
                                  onClick={() => updatePosQty(line.item_id, -1)}
                                >
                                  −
                                </Button>
                                <span className="numeric font-bold">{line.quantity}×</span>
                                <Button
                                  variant="secondary"
                                  onClick={() => updatePosQty(line.item_id, 1)}
                                >
                                  +
                                </Button>
                              </div>
                              <span
                                className="receipt-item-name"
                                style={{ marginLeft: 'var(--space-2)' }}
                              >
                                <RegisterCode code={line.pos_code} /> {line.name}
                              </span>
                              <span className="receipt-item-price numeric">
                                {peso(line.price * line.quantity)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <dl className="receipt-totals">
                      <div className="receipt-total-row">
                        <dt>{t('checkout.gross')}</dt>
                        <dd className="numeric">{peso(walkInTotals.gross)}</dd>
                      </div>
                      {walkInDiscounted ? (
                        <>
                          <div className="receipt-total-row">
                            <dt>{t('checkout.vatExempt')}</dt>
                            <dd className="numeric">{peso(walkInTotals.vatExempt)}</dd>
                          </div>
                          <div className="receipt-total-row receipt-discount-row">
                            <dt>{t('checkout.discount')}</dt>
                            <dd className="numeric">−{peso(walkInTotals.discount)}</dd>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="receipt-total-row">
                            <dt>{t('checkout.vatable')}</dt>
                            <dd className="numeric">{peso(walkInTotals.vatable)}</dd>
                          </div>
                          <div className="receipt-total-row">
                            <dt>{t('checkout.vat')}</dt>
                            <dd className="numeric">{peso(walkInTotals.vat)}</dd>
                          </div>
                        </>
                      )}
                      <div className="receipt-total-row receipt-net-row">
                        <dt className="receipt-net">{t('checkout.net')}</dt>
                        <dd className="numeric receipt-net">{peso(walkInTotals.net)}</dd>
                      </div>
                    </dl>

                    {walkInTotals.net > 0 ? (
                      <TenderPicker
                        due={walkInTotals.net}
                        tender={walkInTender}
                        cash={walkInCash}
                        onTenderChange={setWalkInTender}
                        onCashChange={setCashTendered}
                      />
                    ) : null}

                    <Button
                      variant="checkout"
                      icon={ShoppingBag}
                      loading={submittingOrder}
                      disabled={posCart.length === 0 || !walkInReady}
                      onClick={handlePunchCounterOrder}
                    >
                      {t('pos.punchOrder', { amount: peso(walkInTotals.net) })}
                    </Button>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'log' ? (
        <>
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
            <RegisterReceipt transmission={latest} showBarcodes={showBarcodes} />
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
        </>
      ) : null}

      {issuedReceipt ? (
        <Modal
          title={t('pos.slipTitle', { receipt: issuedReceipt.receipt_no ?? '—' })}
          size="small"
          onClose={() => setIssuedReceipt(null)}
          footer={
            <>
              <Button variant="secondary" icon={Printer} onClick={() => window.print()}>
                {t('staff.printSlip')}
              </Button>
              <Button
                variant="primary"
                data-modal-cancel="true"
                onClick={() => setIssuedReceipt(null)}
              >
                {t('common.done')}
              </Button>
            </>
          }
        >
          <RegisterReceipt transmission={issuedReceipt} showBarcodes={showBarcodes} />
        </Modal>
      ) : null}

      {settling ? (
        <CashierConfirmModal
          key={settling.txn_id}
          entry={settling}
          showBarcodes={showBarcodes}
          onSettled={handleSettled}
          onClose={() => setSettling(null)}
        />
      ) : null}

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
