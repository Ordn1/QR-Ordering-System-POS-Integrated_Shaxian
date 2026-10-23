import {
  CheckCircle2,
  Printer,
  QrCode,
  RefreshCw,
  RotateCcw,
  Search,
  ShoppingBag,
  Trash2,
  UtensilsCrossed,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { listCategories, listItems } from '../../api/menu';
import {
  createPosOrder,
  fetchBridgeStatus,
  fetchTransmissions,
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
import SelectField from '../../components/shared/SelectField';
import TextInput from '../../components/shared/TextInput';
import usePagination from '../../hooks/usePagination';
import { useWebSocket } from '../../hooks/useWebSocket';
import { peso, queueLabel, shortDate } from '../../lib/format';
import { menuImageUrl } from '../../lib/menuImage';
import { toast } from '../../store/toastStore';

const BILLS = [100, 200, 500, 1000];
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

  const [queueCodeInput, setQueueCodeInput] = useState('');
  const [recalledTxnId, setRecalledTxnId] = useState(null);

  const [tableId, setTableId] = useState('TBL-0001');
  const [priorityStatus, setPriorityStatus] = useState('standard');
  const [idLast4, setIdLast4] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [issuingLgu, setIssuingLgu] = useState('Davao City');
  const [posCart, setPosCart] = useState([]);
  const [cashTendered, setCashTendered] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [revokingDiscount, setRevokingDiscount] = useState(false);
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
        listItems(),
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

  useWebSocket('/ws/kitchen', load);

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

  function selectRecalledOrder(entry) {
    setRecalledTxnId(entry.txn_id);
    setQueueCodeInput(queueLabel(entry.queue_number));
    setIdLast4(entry.id_last4 || '');
    setCardholderName(entry.cardholder_name || '');
    setIssuingLgu(entry.issuing_lgu || 'Davao City');
    const due =
      Number(entry.unpaid_amount) > 0
        ? Number(entry.unpaid_amount)
        : Number(entry.net_amount ?? 0);
    setCashTendered(due > 0 ? due.toFixed(2) : '');
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
    setCashTendered('');
    setIdLast4('');
    setCardholderName('');
    setIssuingLgu('Davao City');
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

  const activeAmountDue = useMemo(() => {
    if (recalledOrder) {
      const unpaid = Number(recalledOrder.unpaid_amount ?? 0);
      const net = Number(recalledOrder.net_amount ?? 0);
      return unpaid > 0 ? unpaid : net;
    }
    return walkInTotals.net;
  }, [recalledOrder, walkInTotals.net]);

  const numericTendered = Number(cashTendered);
  const validTender =
    activeAmountDue > 0 &&
    String(cashTendered).trim() !== '' &&
    Number.isFinite(numericTendered) &&
    numericTendered >= activeAmountDue;
  const changeDue = validTender ? roundCentavo(numericTendered - activeAmountDue) : 0;

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
    setCashTendered('');
    setPriorityStatus('standard');
    setIdLast4('');
    setCardholderName('');
    setIssuingLgu('Davao City');
  }

  async function handleRevokeRecalledDiscount() {
    if (!recalledOrder) {
      return;
    }
    setRevokingDiscount(true);
    try {
      const updated = await queueApi.revokePriorityDiscount(recalledOrder.txn_id);
      await load();
      const nextDue = Number(updated?.unpaid_amount || updated?.net_amount || 0);
      if (nextDue > 0) {
        setCashTendered(nextDue.toFixed(2));
      }
      toast.success(
        `Reverted ${queueLabel(recalledOrder.queue_number)} to standard VAT-inclusive price.`,
      );
    } catch (error) {
      toast.error(error.message);
    } finally {
      setRevokingDiscount(false);
    }
  }

  async function handleCompleteRecalledQrSale() {
    if (!recalledOrder) {
      return;
    }
    const needsIdVerification =
      recalledOrder.declared_priority_status !== 'standard' &&
      !recalledOrder.id_verified;

    if (needsIdVerification) {
      if (!/^[0-9]{4}$/.test(idLast4.trim())) {
        toast.error(
          'Enter the last 4 digits of the presented Senior/PWD ID card (or click "No Valid ID Presented").',
        );
        return;
      }
      if (cardholderName.trim().length < 2) {
        toast.error('Enter the cardholder name from the Senior/PWD ID card.');
        return;
      }
      if (issuingLgu.trim().length < 2) {
        toast.error('Enter the issuing LGU from the Senior/PWD ID card.');
        return;
      }
    }

    if (!validTender) {
      toast.error(`Enter cash tendered of at least ${peso(activeAmountDue)}.`);
      return;
    }

    setSubmittingOrder(true);
    try {
      if (needsIdVerification) {
        await queueApi.verifyPriorityId(recalledOrder.txn_id, {
          id_last4: idLast4.trim(),
          cardholder_name: cardholderName.trim(),
          issuing_lgu: issuingLgu.trim(),
        });
      }

      const result = await queueApi.confirmPayment(
        recalledOrder.txn_id,
        numericTendered.toFixed(2),
      );
      const todayIso = new Date().toISOString().slice(0, 10);
      const receiptNo =
        result?.receipt_no ||
        `OR-${todayIso.replace(/-/g, '')}-${String(recalledOrder.queue_number).padStart(4, '0')}`;

      setIssuedReceipt({
        receipt_no: receiptNo,
        payload: {
          store_code: status?.store_code ?? 'SXN-SASA-01',
          terminal_code: status?.terminal_code ?? 'REG-01',
          queue_number: recalledOrder.queue_number,
          table_number: recalledOrder.table_number,
          queue_date: todayIso,
          lines: (recalledOrder.items || []).map((item) => ({
            item_code: item.item_id,
            description: item.name,
            quantity: item.qty,
            unit_price: String(item.unit_price),
            subtotal: String(item.subtotal ?? item.unit_price * item.qty),
          })),
          totals: {
            gross: String(recalledOrder.gross_amount),
            vatable_sales: String(recalledOrder.vatable_sales ?? '0.00'),
            vat_exempt_sales: String(recalledOrder.vat_exempt_sales ?? '0.00'),
            vat: String(recalledOrder.vat_amount),
            statutory_discount: String(recalledOrder.discount_amount),
            net: String(activeAmountDue.toFixed(2)),
          },
          payment: {
            method: 'cashier',
            cash_tendered: numericTendered.toFixed(2),
            change_due: changeDue.toFixed(2),
          },
        },
      });

      toast.success(
        `QR Order ${queueLabel(recalledOrder.queue_number)} settled (${receiptNo}).`,
      );
      switchToWalkInMode();
      await load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSubmittingOrder(false);
    }
  }

  async function handlePunchCounterOrder() {
    if (posCart.length === 0) {
      toast.error('Add at least one dish to the POS ticket first.');
      return;
    }
    if (walkInDiscounted) {
      if (!/^[0-9]{4}$/.test(idLast4.trim())) {
        toast.error('Enter the last 4 digits of the presented Senior/PWD ID card.');
        return;
      }
      if (cardholderName.trim().length < 2) {
        toast.error('Enter the cardholder name from the Senior/PWD ID card.');
        return;
      }
      if (issuingLgu.trim().length < 2) {
        toast.error('Enter the issuing LGU from the Senior/PWD ID card.');
        return;
      }
    }
    if (!validTender) {
      toast.error(`Enter cash tendered of at least ${peso(walkInTotals.net)}.`);
      return;
    }

    setSubmittingOrder(true);
    try {
      const result = await createPosOrder({
        table_id: tableId,
        declared_priority_status: priorityStatus,
        id_last4: walkInDiscounted ? idLast4.trim() : null,
        cardholder_name: walkInDiscounted ? cardholderName.trim() : null,
        issuing_lgu: walkInDiscounted ? issuingLgu.trim() : null,
        cash_tendered: numericTendered.toFixed(2),
        items: posCart.map((line) => ({
          item_id: line.item_id,
          quantity: line.quantity,
        })),
      });
      toast.success(
        `Order ${queueLabel(result.queue_number)} sent to Kitchen Queue (${result.receipt_no}).`,
      );
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
    return menuItems.filter((item) => {
      const matchesCat = selectedCat === 'ALL' || item.cat_id === selectedCat;
      const matchesQuery =
        !searchQuery.trim() ||
        item.name_en.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
        item.item_id.toLowerCase().includes(searchQuery.trim().toLowerCase());
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
            Official Receipts & Sync Log ({rows.length})
          </Button>
          <Button variant="secondary" icon={RefreshCw} onClick={load}>
            {t('pos.refresh')}
          </Button>
        </div>
      </header>

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
                      Collect cash on the right register panel, or switch to Walk-In Mode to punch a new counter order.
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
                  placeholder="Search dish or code (Wonton, MNU-0001)…"
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
                        <span className="eyebrow numeric">{item.item_id}</span>
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

                    {recalledOrder.declared_priority_status !== 'standard' ? (
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
                            Senior / PWD ID ({recalledOrder.declared_priority_status.toUpperCase()})
                          </strong>
                          {recalledOrder.id_verified ? (
                            <Badge value="paid" label={`Verified (•••• ${recalledOrder.id_last4})`} />
                          ) : (
                            <Badge value="pending" label="Inspect Physical ID" />
                          )}
                        </div>

                        {!recalledOrder.id_verified ? (
                          <>
                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '120px 1fr',
                                gap: 'var(--space-2)',
                              }}
                            >
                              <TextInput
                                label="ID Last 4"
                                required
                                inputClass="numeric"
                                inputMode="numeric"
                                maxLength={4}
                                value={idLast4}
                                onChange={(event) => setIdLast4(event.target.value)}
                              />
                              <TextInput
                                label="Issuing LGU"
                                required
                                inputClass="alpha"
                                maxLength={50}
                                value={issuingLgu}
                                onChange={(event) => setIssuingLgu(event.target.value)}
                              />
                            </div>
                            <TextInput
                              label="Cardholder Full Name"
                              required
                              inputClass="alpha"
                              maxLength={80}
                              value={cardholderName}
                              onChange={(event) => setCardholderName(event.target.value)}
                            />
                            <Button
                              variant="secondary"
                              loading={revokingDiscount}
                              onClick={handleRevokeRecalledDiscount}
                            >
                              No Valid ID Presented — Revert to Standard Price
                            </Button>
                          </>
                        ) : null}
                      </div>
                    ) : null}

                    <div
                      style={{
                        borderTop: '1px solid var(--border, #d6d3cd)',
                        paddingTop: 'var(--space-2)',
                      }}
                    >
                      <strong style={{ display: 'block', marginBottom: 'var(--space-2)' }}>
                        QR Order Items ({recalledOrder.item_count})
                      </strong>
                      <ul
                        className="receipt-item-list"
                        style={{ maxHeight: '220px', overflowY: 'auto' }}
                      >
                        {(recalledOrder.items || []).map((item, idx) => (
                          <li key={idx} className="receipt-item-row">
                            <span className="receipt-item-qty numeric">{item.qty}×</span>
                            <span className="receipt-item-name">{item.name}</span>
                            <span className="receipt-item-price numeric">
                              {peso(item.subtotal ?? item.unit_price * item.qty)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

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
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: 'var(--space-2)',
                            alignItems: 'end',
                          }}
                        >
                          <TextInput
                            label="Cash Tendered (₱)"
                            required
                            inputClass="currency"
                            inputMode="decimal"
                            maxLength={9}
                            value={cashTendered}
                            onChange={(event) => setCashTendered(event.target.value)}
                          />
                          <div
                            style={{
                              padding: '10px var(--space-3)',
                              border: '1px solid var(--border-strong, #c9c4bc)',
                              background: 'var(--cream, #f7f3eb)',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'center',
                            }}
                          >
                            <span className="eyebrow" style={{ margin: 0 }}>
                              Change Due
                            </span>
                            <strong className="numeric" style={{ fontSize: 'var(--font-md)' }}>
                              {validTender ? peso(changeDue) : '—'}
                            </strong>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          <Button
                            variant="secondary"
                            onClick={() => setCashTendered(activeAmountDue.toFixed(2))}
                          >
                            Exact ({peso(activeAmountDue)})
                          </Button>
                          {BILLS.filter((bill) => bill >= activeAmountDue).map((bill) => (
                            <Button
                              key={bill}
                              variant="secondary"
                              onClick={() => setCashTendered(bill.toFixed(2))}
                            >
                              ₱{bill}
                            </Button>
                          ))}
                        </div>

                        <Button
                          variant="checkout"
                          icon={ShoppingBag}
                          loading={submittingOrder}
                          disabled={!validTender}
                          onClick={handleCompleteRecalledQrSale}
                        >
                          Complete QR Payment & Print OR · {peso(activeAmountDue)}
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
                        onChange={(event) => setPriorityStatus(event.target.value)}
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
                        <strong style={{ fontSize: 'var(--font-sm)' }}>
                          Physical OSCA / PWD ID Verification (20% Off + VAT Exempt)
                        </strong>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '110px 1fr',
                            gap: 'var(--space-2)',
                          }}
                        >
                          <TextInput
                            label="ID Last 4"
                            required
                            inputClass="numeric"
                            inputMode="numeric"
                            maxLength={4}
                            value={idLast4}
                            onChange={(event) => setIdLast4(event.target.value)}
                          />
                          <TextInput
                            label="Issuing LGU"
                            required
                            inputClass="alpha"
                            maxLength={50}
                            value={issuingLgu}
                            onChange={(event) => setIssuingLgu(event.target.value)}
                          />
                        </div>
                        <TextInput
                          label="Cardholder Full Name"
                          required
                          inputClass="alpha"
                          maxLength={80}
                          value={cardholderName}
                          onChange={(event) => setCardholderName(event.target.value)}
                        />
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
                                {line.name}
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

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 'var(--space-2)',
                        alignItems: 'end',
                      }}
                    >
                      <TextInput
                        label="Cash Tendered (₱)"
                        required
                        inputClass="currency"
                        inputMode="decimal"
                        maxLength={9}
                        value={cashTendered}
                        onChange={(event) => setCashTendered(event.target.value)}
                      />
                      <div
                        style={{
                          padding: '10px var(--space-3)',
                          border: '1px solid var(--border-strong, #c9c4bc)',
                          background: 'var(--cream, #f7f3eb)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                        }}
                      >
                        <span className="eyebrow" style={{ margin: 0 }}>
                          Change Due
                        </span>
                        <strong className="numeric" style={{ fontSize: 'var(--font-md)' }}>
                          {validTender ? peso(changeDue) : '—'}
                        </strong>
                      </div>
                    </div>

                    {walkInTotals.net > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        <Button
                          variant="secondary"
                          onClick={() => setCashTendered(walkInTotals.net.toFixed(2))}
                        >
                          Exact ({peso(walkInTotals.net)})
                        </Button>
                        {BILLS.filter((bill) => bill >= walkInTotals.net).map((bill) => (
                          <Button
                            key={bill}
                            variant="secondary"
                            onClick={() => setCashTendered(bill.toFixed(2))}
                          >
                            ₱{bill}
                          </Button>
                        ))}
                      </div>
                    ) : null}

                    <Button
                      variant="checkout"
                      icon={ShoppingBag}
                      loading={submittingOrder}
                      disabled={posCart.length === 0 || !validTender}
                      onClick={handlePunchCounterOrder}
                    >
                      Punch Order & Print Official Receipt · {peso(walkInTotals.net)}
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
        </>
      ) : null}

      {issuedReceipt ? (
        <Modal
          title={`Official Receipt Issued · ${issuedReceipt.receipt_no}`}
          size="small"
          onClose={() => setIssuedReceipt(null)}
          footer={
            <>
              <Button variant="secondary" icon={Printer} onClick={() => window.print()}>
                Print Official Receipt
              </Button>
              <Button
                variant="primary"
                data-modal-cancel="true"
                onClick={() => setIssuedReceipt(null)}
              >
                Done
              </Button>
            </>
          }
        >
          <RegisterReceipt transmission={issuedReceipt} />
        </Modal>
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