import { Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import * as menuApi from '../../api/menu';
import CategoryTile from '../../components/admin/CategoryTile';
import Badge from '../../components/shared/Badge';
import DataTable from '../../components/shared/DataTable';
import IconButton from '../../components/shared/IconButton';
import ViewToggle from '../../components/shared/ViewToggle';
import Button from '../../components/shared/Button';
import Modal from '../../components/shared/Modal';
import TextInput from '../../components/shared/TextInput';
import { toast } from '../../store/toastStore';
import { useUiStore } from '../../store/uiStore';
import Pagination from '../../components/shared/Pagination';
import usePagination from '../../hooks/usePagination';

const BLANK = {
  name_en: '',
  name_fil: '',
  name_bis: '',
  display_order: '0',
  is_active: true,
};

export default function CategoriesPage() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const adminView = useUiStore((state) => state.adminView);
  const paged = usePagination(categories);

  const load = useCallback(
    () =>
      Promise.all([menuApi.listCategories(), menuApi.listItems()])
        .then(([nextCategories, items]) => {
          setCategories(nextCategories);
          setCounts(
            items.reduce(
              (tally, item) => ({ ...tally, [item.cat_id]: (tally[item.cat_id] ?? 0) + 1 }),
              {},
            ),
          );
        })
        .catch((error) => toast.error(error.message))
        .finally(() => setLoading(false)),
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  function open(category) {
    setEditing({ category });
    setFieldErrors({});
    setForm(
      category
        ? {
            name_en: category.name_en,
            name_fil: category.name_fil,
            name_bis: category.name_bis,
            display_order: String(category.display_order),
            is_active: category.is_active,
          }
        : BLANK,
    );
  }

  const set = (key) => (event) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  async function save() {
    setSaving(true);
    setFieldErrors({});
    const payload = {
      name_en: form.name_en.trim(),
      name_fil: form.name_fil.trim(),
      name_bis: form.name_bis.trim(),
      display_order: form.display_order === '' ? 0 : Number(form.display_order),
      is_active: form.is_active,
    };

    try {
      if (editing.category) {
        await menuApi.updateCategory(editing.category.cat_id, payload);
      } else {
        await menuApi.createCategory(payload);
      }
      setEditing(null);
      await load();
      toast.success(t(editing.category ? 'admin.categorySaved' : 'admin.categoryAdded'));
    } catch (error) {
      if (error.fieldErrors) {
        setFieldErrors(error.fieldErrors);
      }
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    try {
      await menuApi.deleteCategory(deleting.cat_id);
      setDeleting(null);
      await load();
      toast.success(t('admin.categoryDeleted'));
    } catch (error) {
      toast.error(error.message);
    }
  }

  const columns = [
    { key: 'order', header: t('admin.colOrder'), align: 'right', render: (row) => row.display_order },
    { key: 'name', header: t('admin.colEnglish'), render: (row) => row.name_en },
    { key: 'fil', header: t('admin.colFilipino'), render: (row) => row.name_fil },
    { key: 'bis', header: t('admin.colBisaya'), render: (row) => row.name_bis },
    {
      key: 'items',
      header: t('admin.colItems'),
      align: 'right',
      render: (row) => counts[row.cat_id] ?? 0,
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => <Badge value={row.is_active ? 'active' : 'ended'} />,
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) => (
        <>
          <IconButton
            variant="edit"
            label={`${t('common.edit')} ${row.name_en}`}
            onClick={() => open(row)}
          />
          <IconButton
            variant="delete"
            label={`${t('common.delete')} ${row.name_en}`}
            onClick={() => setDeleting(row)}
          />
        </>
      ),
    },
  ];

  return (
    <main className="content-area">
      <header className="page-header">
        <h1>{t('admin.categoriesTitle')}</h1>
        <div className="page-header-actions">
          <Button variant="wide-create" icon={Plus} onClick={() => open(null)}>
            {t('admin.addCategory')}
          </Button>
          <ViewToggle />
        </div>
      </header>

      {adminView === 'list' ? (
        <DataTable
          columns={columns}
          rows={paged.slice}
          rowKey={(row) => row.cat_id}
          loading={loading}
          emptyMessage={t('admin.categoriesEmpty')}
        />
      ) : loading ? null : categories.length === 0 ? (
        <p className="tile-empty">{t('admin.categoriesEmpty')}</p>
      ) : (
        <div className="tile-grid">
          {paged.slice.map((category, index) => (
            <CategoryTile
              key={category.cat_id}
              category={category}
              position={paged.from - 1 + index}
              itemCount={counts[category.cat_id] ?? 0}
              onEdit={() => open(category)}
              onDelete={() => setDeleting(category)}
            />
          ))}
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

      {editing ? (
        <Modal
          title={t(editing.category ? 'admin.editCategory' : 'admin.addCategory')}
          onClose={() => setEditing(null)}
          footer={
            <>
              <Button variant="secondary" data-modal-cancel="true" onClick={() => setEditing(null)}>
                {t('common.cancel')}
              </Button>
              <Button variant="primary" loading={saving} onClick={save}>
                {t(editing.category ? 'common.save' : 'admin.addCategory')}
              </Button>
            </>
          }
        >
          <TextInput
            label={t('admin.fieldNameEn')}
            required
            inputClass="alphanumeric"
            maxLength={40}
            value={form.name_en}
            error={fieldErrors.name_en}
            onChange={set('name_en')}
          />
          <TextInput
            label={t('admin.fieldNameFil')}
            required
            inputClass="alphanumeric"
            maxLength={40}
            value={form.name_fil}
            error={fieldErrors.name_fil}
            onChange={set('name_fil')}
          />
          <TextInput
            label={t('admin.fieldNameBis')}
            required
            inputClass="alphanumeric"
            maxLength={40}
            value={form.name_bis}
            error={fieldErrors.name_bis}
            onChange={set('name_bis')}
          />
          <TextInput
            label={t('admin.fieldDisplayOrder')}
            inputClass="numeric"
            maxLength={5}
            value={form.display_order}
            error={fieldErrors.display_order}
            onChange={set('display_order')}
          />
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) =>
                setForm((current) => ({ ...current, is_active: event.target.checked }))
              }
            />
            {t('admin.fieldVisible')}
          </label>
        </Modal>
      ) : null}

      {deleting ? (
        <Modal
          title={t('admin.deleteCategory')}
          size="small"
          destructive
          onClose={() => setDeleting(null)}
          footer={
            <>
              <Button variant="wide-delete" onClick={confirmDelete}>
                {t('admin.deleteCategoryConfirm')}
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
          <p>{t('admin.confirmDeleteCategory', { name: deleting.name_en })}</p>
        </Modal>
      ) : null}
    </main>
  );
}
