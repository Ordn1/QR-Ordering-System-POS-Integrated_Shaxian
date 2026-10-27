import { Pencil, Smartphone, Trash2, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { fetchTableCart } from '../../api/sessions';
import Badge from '../../components/shared/Badge';
import Button from '../../components/shared/Button';
import IconButton from '../../components/shared/IconButton';
import Modal from '../../components/shared/Modal';
import TextInput from '../../components/shared/TextInput';
import { useWebSocket } from '../../hooks/useWebSocket';
import { peso } from '../../lib/format';
import { useCartStore } from '../../store/cartStore';
import { useSessionStore } from '../../store/sessionStore';
import { toast } from '../../store/toastStore';

export default function SplitBillPage() {
  const { t, i18n } = useTranslation();
  const { qrToken } = useParams();
  const navigate = useNavigate();
  const session = useSessionStore((state) => state.session);
  const setDisplayName = useSessionStore((state) => state.setDisplayName);
  const removeDevice = useSessionStore((state) => state.removeDevice);
  const localLines = useCartStore((state) => state.lines);
  const [tableCart, setTableCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nickname, setNickname] = useState(session?.display_name ?? '');
  const [savingName, setSavingName] = useState(false);
  const [removingShare, setRemovingShare] = useState(null);
  const [removingBusy, setRemovingBusy] = useState(false);

  const loadCart = useCallback(() => {
    if (!session?.session_id) {
      return Promise.resolve();
    }
    return fetchTableCart(session.session_id, i18n.language)
      .then(setTableCart)
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, [session?.session_id, i18n.language]);

  useEffect(() => {
    loadCart();
  }, [loadCart, localLines]);

  const handleSocket = useCallback(
    (payload) => {
      if (
        payload?.type === 'cart_changed' ||
        payload?.type === 'session_changed' ||
        payload?.type === 'order_status'
      ) {
        loadCart();
      }
    },
    [loadCart],
  );

  useWebSocket(
    session
      ? `/ws/orders/${session.session_id}?device=${session.device_token}`
      : null,
    handleSocket,
  );

  async function handleSaveNickname() {
    setSavingName(true);
    try {
      await setDisplayName(nickname.trim());
      setEditingName(false);
      await loadCart();
      toast.success(
        t('group.nicknameSaved', { defaultValue: 'Display name updated' }),
      );
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSavingName(false);
    }
  }

  async function handleConfirmRemoveDevice() {
    if (!removingShare) {
      return;
    }
    setRemovingBusy(true);
    try {
      await removeDevice(removingShare.device_id);
      setRemovingShare(null);
      await loadCart();
      toast.success(
        t('group.deviceRemoved', {
          defaultValue: 'Phone removed from this table session.',
        }),
      );
    } catch (error) {
      toast.error(error.message);
    } finally {
      setRemovingBusy(false);
    }
  }

  const shares = tableCart?.shares ?? [];
  const deviceCount = tableCart?.device_count ?? Math.max(session?.device_count ?? 1, 1);
  const tableTotal = Number(tableCart?.table_total ?? 0);
  const myShareTotal = Number(tableCart?.my_share_total ?? 0);
  const unpaidTotal = Number(tableCart?.unpaid_total ?? tableTotal);
  const canPayMyShare = myShareTotal > 0;
  const canPayAll = unpaidTotal > 0;

  return (
    <main className="customer-page">
      <div className="customer-page-head">
        <h1>{t('split.title')}</h1>
        {!session?.display_name ? (
          <Button
            variant="secondary"
            icon={Pencil}
            onClick={() => {
              setNickname('');
              setEditingName(true);
            }}
          >
            {t('group.setName', { defaultValue: 'Set my name' })}
          </Button>
        ) : null}
      </div>

      {!session?.display_name ? (
        <p className="declaration-prompt">{t('split.prompt', { count: deviceCount })}</p>
      ) : null}

      {loading && !tableCart ? (
        <div className="entry-status-wrap">
          <span className="btn-spinner entry-spinner" role="status" aria-label="Loading" />
        </div>
      ) : (
        <div className="split-shares-container">
          {shares.map((share) => {
            const defaultLabel = share.is_host
              ? t('split.deviceHost', { number: share.device_number })
              : t('split.device', { number: share.device_number });
            const titleLabel = share.display_name
              ? `${share.display_name} (${defaultLabel})`
              : defaultLabel;

            return (
              <section className="split-share-card" key={share.device_id}>
                <header className="split-share-header">
                  <div className="split-share-title-wrap">
                    <Smartphone size={18} strokeWidth={1.75} className="split-share-icon" />
                    <h2 className="split-share-name">
                      {titleLabel}
                      {share.is_me ? ' (You)' : ''}
                    </h2>
                  </div>
                  <div className="table-row-actions">
                    {share.payment_status ? (
                      <Badge value={share.payment_status} domain="payment" />
                    ) : null}
                    <span className="split-share-total numeric">{peso(share.subtotal)}</span>
                    {session?.is_host && !share.is_me && share.payment_status !== 'paid' ? (
                      <IconButton
                        variant="delete"
                        label={t('group.removeDevice', {
                          defaultValue: `Remove ${titleLabel}`,
                        })}
                        onClick={() => setRemovingShare({ ...share, titleLabel })}
                      />
                    ) : null}
                  </div>
                </header>
                {share.lines.length > 0 ? (
                  <ul className="split-share-item-list">
                    {share.lines.map((line) => (
                      <li key={line.item_id} className="split-share-item-row">
                        <span className="split-share-item-qty">{line.quantity}×</span>
                        <span className="split-share-item-name">{line.name}</span>
                        <span className="split-share-item-price numeric">
                          {peso(line.subtotal)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="split-share-empty">{t('split.noItems')}</p>
                )}
              </section>
            );
          })}
        </div>
      )}

      <div className="split-table-total-card">
        <div className="split-total-row">
          <span>{t('split.total')}</span>
          <span className="numeric">{peso(tableTotal)}</span>
        </div>
        <div className="cart-actions">
          <Button
            variant="checkout"
            disabled={!canPayMyShare}
            onClick={() => navigate(`/t/${qrToken}/checkout?scope=split`)}
          >
            {t('split.payShare')}
            {canPayMyShare ? ` · ${peso(myShareTotal)}` : ''}
          </Button>
          <Button
            variant="secondary"
            icon={Users}
            disabled={!canPayAll}
            onClick={() => navigate(`/t/${qrToken}/checkout?scope=table`)}
          >
            {unpaidTotal < tableTotal
              ? `Pay remaining balance · ${peso(unpaidTotal)}`
              : `Pay for entire table · ${peso(tableTotal)}`}
          </Button>
          {tableCart?.active_txn_id ? (
            <Button
              variant="secondary"
              onClick={() => navigate(`/t/${qrToken}/status`)}
            >
              {t('nav.status', { defaultValue: 'Order Status' })}
            </Button>
          ) : null}
        </div>
        <p className="login-hint">{t('split.settleNote')}</p>
      </div>

      {editingName ? (
        <Modal
          title={t('group.nameModalTitle', { defaultValue: 'Your display name at this table' })}
          size="small"
          onClose={() => setEditingName(false)}
          footer={
            <>
              <Button
                variant="secondary"
                data-modal-cancel="true"
                onClick={() => setEditingName(false)}
              >
                {t('common.cancel')}
              </Button>
              <Button variant="primary" loading={savingName} onClick={handleSaveNickname}>
                {t('common.save')}
              </Button>
            </>
          }
        >
          <TextInput
            label={t('group.nicknameLabel', { defaultValue: 'Nickname shown to tablemates' })}
            inputClass="alphanumeric"
            maxLength={30}
            hint="e.g. Justin, Faith"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
          />
        </Modal>
      ) : null}

      {removingShare ? (
        <Modal
          title={t('group.removeDeviceTitle', { defaultValue: 'Remove phone from table' })}
          size="small"
          destructive
          onClose={() => setRemovingShare(null)}
          footer={
            <>
              <Button
                variant="wide-delete"
                icon={Trash2}
                loading={removingBusy}
                onClick={handleConfirmRemoveDevice}
              >
                {t('group.removeDeviceConfirm', { defaultValue: 'Remove phone' })}
              </Button>
              <Button
                variant="secondary"
                data-modal-cancel="true"
                onClick={() => setRemovingShare(null)}
              >
                {t('common.cancel')}
              </Button>
            </>
          }
        >
          <p>
            {t('group.confirmRemoveDeviceBody', {
              name: removingShare.titleLabel,
              defaultValue: `${removingShare.titleLabel} will be disconnected from this table session and its unsubmitted cart items will be cleared.`,
            })}
          </p>
        </Modal>
      ) : null}
    </main>
  );
}