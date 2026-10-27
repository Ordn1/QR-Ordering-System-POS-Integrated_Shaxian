import { Plus, Shield, UserCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import * as authApi from '../../api/auth';
import Badge from '../../components/shared/Badge';
import Button from '../../components/shared/Button';
import DataTable from '../../components/shared/DataTable';
import IconButton from '../../components/shared/IconButton';
import Modal from '../../components/shared/Modal';
import Pagination from '../../components/shared/Pagination';
import SelectField from '../../components/shared/SelectField';
import TextInput from '../../components/shared/TextInput';
import ViewToggle from '../../components/shared/ViewToggle';
import usePagination from '../../hooks/usePagination';
import { shortDate } from '../../lib/format';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';
import { useUiStore } from '../../store/uiStore';

const BLANK = {
    username: '',
    full_name: '',
    role: 'service_crew',
    password: '',
    is_active: true,
};

export default function StaffPage() {
    const { t } = useTranslation();
    const currentStaff = useAuthStore((state) => state.staff);
    const adminView = useUiStore((state) => state.adminView);
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewing, setViewing] = useState(null);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(BLANK);
    const [fieldErrors, setFieldErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(null);
    const [deletingBusy, setDeletingBusy] = useState(false);
    const [togglingId, setTogglingId] = useState(null);
    const paged = usePagination(accounts);

    const load = useCallback(
        () =>
            authApi
                .listStaff()
                .then(setAccounts)
                .catch((error) => toast.error(error.message))
                .finally(() => setLoading(false)),
        [],
    );

    useEffect(() => {
        load();
    }, [load]);

    function openForm(account) {
        setEditing({ account });
        setFieldErrors({});
        setForm(
            account
                ? {
                    username: account.username,
                    full_name: account.full_name,
                    role: account.role,
                    password: '',
                    is_active: account.is_active,
                }
                : BLANK,
        );
    }

    const set = (key) => (event) =>
        setForm((current) => ({ ...current, [key]: event.target.value }));

    async function save() {
        const editingAccount = editing?.account;
        const trimmedPassword = form.password.trim();

        if (!editingAccount && trimmedPassword.length < 12) {
            setFieldErrors({ password: t('admin.staffPasswordMin') });
            return;
        }
        if (editingAccount && trimmedPassword.length > 0 && trimmedPassword.length < 12) {
            setFieldErrors({ password: t('admin.staffPasswordMin') });
            return;
        }

        setSaving(true);
        setFieldErrors({});

        try {
            if (editingAccount) {
                const payload = {
                    username: form.username.trim(),
                    full_name: form.full_name.trim(),
                    role: form.role,
                    is_active: form.is_active,
                };
                if (trimmedPassword.length >= 12) {
                    payload.password = trimmedPassword;
                }
                await authApi.updateStaff(editingAccount.staff_id, payload);
            } else {
                await authApi.createStaff({
                    username: form.username.trim(),
                    full_name: form.full_name.trim(),
                    role: form.role,
                    password: trimmedPassword,
                    is_active: form.is_active,
                });
            }
            setEditing(null);
            await load();
            toast.success(t(editingAccount ? 'admin.staffSaved' : 'admin.staffAdded'));
        } catch (error) {
            if (error.fieldErrors) {
                setFieldErrors(error.fieldErrors);
            }
            toast.error(error.message);
        } finally {
            setSaving(false);
        }
    }

    async function handleToggleStatus(row) {
        if (row.staff_id === currentStaff?.staff_id) {
            toast.error(t('admin.staffSelfDeactivateError'));
            return;
        }
        setTogglingId(row.staff_id);
        try {
            const updated = await authApi.toggleStaffStatus(row.staff_id, !row.is_active);
            setAccounts((current) =>
                current.map((item) => (item.staff_id === row.staff_id ? updated : item)),
            );
            toast.success(t('admin.staffSaved'));
        } catch (error) {
            toast.error(error.message);
        } finally {
            setTogglingId(null);
        }
    }

    async function confirmDelete() {
        setDeletingBusy(true);
        try {
            await authApi.deleteStaff(deleting.staff_id);
            setDeleting(null);
            await load();
            toast.success(t('admin.staffDeleted'));
        } catch (error) {
            toast.error(error.message);
        } finally {
            setDeletingBusy(false);
        }
    }

    const roleOptions = [
        { value: 'service_crew', label: t('admin.roleServiceCrew') },
        { value: 'admin', label: t('admin.roleAdmin') },
    ];

    const columns = [
        {
            key: 'id',
            header: t('auth.staffId'),
            render: (row) => <span className="numeric font-bold">{row.staff_id}</span>,
        },
        { key: 'name', header: t('admin.colName'), render: (row) => row.full_name },
        { key: 'username', header: t('auth.username'), render: (row) => row.username },
        {
            key: 'role',
            header: t('auth.role'),
            render: (row) => <Badge value={row.role} />,
        },
        {
            key: 'lastLogin',
            header: t('admin.colLastLogin'),
            render: (row) => (row.last_login_at ? shortDate(row.last_login_at) : '—'),
        },
        {
            key: 'status',
            header: t('common.status'),
            render: (row) => (
                <button
                    type="button"
                    disabled={togglingId === row.staff_id || row.staff_id === currentStaff?.staff_id}
                    onClick={() => handleToggleStatus(row)}
                    style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: row.staff_id === currentStaff?.staff_id ? 'default' : 'pointer',
                    }}
                >
                    <Badge value={row.is_active ? 'active' : 'ended'} />
                </button>
            ),
        },
        {
            key: 'actions',
            header: t('common.actions'),
            render: (row) => (
                <>
                    <IconButton
                        variant="view"
                        label={`${t('common.view')} ${row.full_name}`}
                        onClick={() => setViewing(row)}
                    />
                    <IconButton
                        variant="edit"
                        label={`${t('common.edit')} ${row.full_name}`}
                        onClick={() => openForm(row)}
                    />
                    <IconButton
                        variant="delete"
                        label={`${t('common.delete')} ${row.full_name}`}
                        disabled={row.staff_id === currentStaff?.staff_id}
                        onClick={() => setDeleting(row)}
                    />
                </>
            ),
        },
    ];

    return (
        <main className="content-area">
            <header className="page-header">
                <h1>{t('admin.staffTitle')}</h1>
                <div className="page-header-actions">
                    <Button variant="wide-create" icon={Plus} onClick={() => openForm(null)}>
                        {t('admin.addStaff')}
                    </Button>
                    <ViewToggle />
                </div>
            </header>

            {adminView === 'list' ? (
                <div className="admin-table-scroll">
                    <DataTable
                        columns={columns}
                        rows={paged.slice}
                        rowKey={(row) => row.staff_id}
                        loading={loading}
                        emptyMessage={t('admin.staffEmpty')}
                    />
                </div>
            ) : loading ? null : accounts.length === 0 ? (
                <p className="tile-empty">{t('admin.staffEmpty')}</p>
            ) : (
                <div className="tile-grid">
                    {paged.slice.map((account) => {
                        const RoleIcon = account.role === 'admin' ? Shield : UserCheck;
                        return (
                            <article className="tile category-tile" key={account.staff_id}>
                                <div className="tile-media">
                                    <RoleIcon className="tile-icon" size={44} strokeWidth={1.5} />
                                    <span className="tile-status">
                                        <Badge value={account.is_active ? 'active' : 'ended'} />
                                    </span>
                                </div>

                                <div className="tile-body">
                                    <span className="eyebrow numeric">{account.staff_id}</span>
                                    <span className="tile-name">{account.full_name}</span>
                                    <span className="tile-meta">@{account.username}</span>
                                    <div style={{ marginTop: 'var(--space-2)' }}>
                                        <Badge value={account.role} />
                                    </div>
                                </div>

                                <div className="tile-actions">
                                    <IconButton
                                        variant="view"
                                        label={`${t('common.view')} ${account.full_name}`}
                                        onClick={() => setViewing(account)}
                                    />
                                    <IconButton
                                        variant="edit"
                                        label={`${t('common.edit')} ${account.full_name}`}
                                        onClick={() => openForm(account)}
                                    />
                                    <IconButton
                                        variant="delete"
                                        label={`${t('common.delete')} ${account.full_name}`}
                                        disabled={account.staff_id === currentStaff?.staff_id}
                                        onClick={() => setDeleting(account)}
                                    />
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}

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
                    title={viewing.full_name}
                    size="small"
                    onClose={() => setViewing(null)}
                    footer={
                        <>
                            {viewing.staff_id !== currentStaff?.staff_id ? (
                                <Button
                                    variant="secondary"
                                    loading={togglingId === viewing.staff_id}
                                    onClick={async () => {
                                        await handleToggleStatus(viewing);
                                        setViewing((prev) =>
                                            prev ? { ...prev, is_active: !prev.is_active } : null,
                                        );
                                    }}
                                >
                                    {viewing.is_active
                                        ? t('admin.deactivateStaff')
                                        : t('admin.activateStaff')}
                                </Button>
                            ) : null}
                            <Button
                                variant="secondary"
                                data-modal-cancel="true"
                                onClick={() => setViewing(null)}
                            >
                                {t('common.close')}
                            </Button>
                        </>
                    }
                >
                    <dl className="detail-list">
                        <dt className="eyebrow">{t('auth.staffId')}</dt>
                        <dd className="numeric">{viewing.staff_id}</dd>
                        <dt className="eyebrow">{t('auth.name')}</dt>
                        <dd>{viewing.full_name}</dd>
                        <dt className="eyebrow">{t('auth.username')}</dt>
                        <dd>{viewing.username}</dd>
                        <dt className="eyebrow">{t('auth.role')}</dt>
                        <dd>
                            <Badge value={viewing.role} />
                        </dd>
                        <dt className="eyebrow">{t('common.status')}</dt>
                        <dd>
                            <Badge value={viewing.is_active ? 'active' : 'ended'} />
                        </dd>
                        <dt className="eyebrow">{t('admin.colLastLogin')}</dt>
                        <dd>{viewing.last_login_at ? shortDate(viewing.last_login_at) : '—'}</dd>
                        <dt className="eyebrow">{t('admin.colCreatedAt')}</dt>
                        <dd>{shortDate(viewing.created_at)}</dd>
                    </dl>
                </Modal>
            ) : null}

            {editing ? (
                <Modal
                    title={t(editing.account ? 'admin.editStaff' : 'admin.addStaff')}
                    onClose={() => setEditing(null)}
                    footer={
                        <>
                            <Button
                                variant="secondary"
                                data-modal-cancel="true"
                                onClick={() => setEditing(null)}
                            >
                                {t('common.cancel')}
                            </Button>
                            <Button variant="primary" loading={saving} onClick={save}>
                                {t(editing.account ? 'common.save' : 'admin.addStaff')}
                            </Button>
                        </>
                    }
                >
                    <TextInput
                        label={t('auth.name')}
                        required
                        inputClass="alpha"
                        maxLength={80}
                        value={form.full_name}
                        error={fieldErrors.full_name}
                        onChange={set('full_name')}
                    />
                    <TextInput
                        label={t('auth.username')}
                        required
                        inputClass="alphanumeric"
                        maxLength={30}
                        value={form.username}
                        error={fieldErrors.username}
                        onChange={set('username')}
                    />
                    <SelectField
                        label={t('auth.role')}
                        required
                        value={form.role}
                        error={fieldErrors.role}
                        onChange={set('role')}
                        options={roleOptions}
                    />
                    <TextInput
                        label={
                            editing.account
                                ? t('admin.fieldNewPasswordOptional')
                                : t('auth.password')
                        }
                        type="password"
                        required={!editing.account}
                        maxLength={72}
                        hint={t('admin.staffPasswordHint')}
                        value={form.password}
                        error={fieldErrors.password}
                        onChange={set('password')}
                    />
                    <label className="checkbox-field">
                        <input
                            type="checkbox"
                            checked={form.is_active}
                            disabled={editing.account?.staff_id === currentStaff?.staff_id}
                            onChange={(event) =>
                                setForm((current) => ({ ...current, is_active: event.target.checked }))
                            }
                        />
                        {t('admin.fieldStaffActive')}
                    </label>
                </Modal>
            ) : null}

            {deleting ? (
                <Modal
                    title={t('admin.deleteStaff')}
                    size="small"
                    destructive
                    onClose={() => setDeleting(null)}
                    footer={
                        <>
                            <Button
                                variant="wide-delete"
                                loading={deletingBusy}
                                onClick={confirmDelete}
                            >
                                {t('admin.deleteStaffConfirm')}
                            </Button>
                            <Button
                                variant="secondary"
                                data-modal-cancel="true"
                                onClick={() => setDeleting(null)}
                            >
                                {t('common.cancel')}
                            </Button>
                        </>
                    }
                >
                    <p>{t('admin.confirmDeleteStaff', { name: deleting.full_name })}</p>
                </Modal>
            ) : null}
        </main>
    );
}