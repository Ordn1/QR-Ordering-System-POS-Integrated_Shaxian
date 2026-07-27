import { Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import * as menuApi from '../../api/menu';
import MenuItemModal from '../../components/admin/MenuItemModal';
import MenuTile from '../../components/admin/MenuTile';
import Badge from '../../components/shared/Badge';
import DataTable from '../../components/shared/DataTable';
import IconButton from '../../components/shared/IconButton';
import ViewToggle from '../../components/shared/ViewToggle';
import Button from '../../components/shared/Button';
import Modal from '../../components/shared/Modal';
import { peso } from '../../lib/format';
import { toast } from '../../store/toastStore';
import { useUiStore } from '../../store/uiStore';
import Pagination from '../../components/shared/Pagination';
import usePagination from '../../hooks/usePagination';

export default function MenuPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const adminView = useUiStore((state) => state.adminView);
  const paged = usePagination(items);

  const load = useCallback(
    () =>
      Promise.all([menuApi.listItems(), menuApi.listCategories()])
        .then(([nextItems, nextCategories]) => {
          setItems(nextItems);
          setCategories(nextCategories);
          return nextItems;
        })
        .catch((error) => toast.error(error.message))
        .finally(() => setLoading(false)),
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  const categoryName = (catId) =>
    categories.find((category) => category.cat_id === catId)?.name_en ?? catId;

  async function save(payload) {
    const editingItem = editing?.item;
    let created;
    try {
      if (editingItem) {
        await menuApi.updateItem(editingItem.item_id, payload);
      } else {
        created = await menuApi.createItem(payload);
      }
    } catch (error) {
      toast.error(error.message);
      throw error;
    }
    setEditing(null);
    const nextItems = await load();
    // A new item lands at the end of the list, which is rarely the page being
    // viewed. Follow it rather than leaving the user staring at an unchanged page.
    if (created && Array.isArray(nextItems)) {
      paged.revealIndex(nextItems.findIndex((row) => row.item_id === created.item_id));
    }
    toast.success(t(editingItem ? 'admin.itemSaved' : 'admin.itemAdded'));
  }

  async function confirmDelete() {
    setDeletingBusy(true);
    try {
      await menuApi.deleteItem(deleting.item_id);
      setDeleting(null);
      await load();
      toast.success(t('admin.itemDeleted'));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setDeletingBusy(false);
    }
  }

  const columns = [
    { key: 'name', header: t('admin.colName'), render: (row) => row.name_en },
    { key: 'category', header: t('admin.colCategory'), render: (row) => categoryName(row.cat_id) },
    { key: 'price', header: t('admin.colPrice'), align: 'right', render: (row) => peso(row.price) },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => <Badge value={row.is_available ? 'available' : 'sold out'} />,
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) => (
        <>
          <IconButton
            variant="view"
            label={`${t('common.view')} ${row.name_en}`}
            onClick={() => setViewing(row)}
          />
          <IconButton
            variant="edit"
            label={`${t('common.edit')} ${row.name_en}`}
            onClick={() => setEditing({ item: row })}
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
        <h1>{t('admin.menuTitle')}</h1>
        <div className="page-header-actions">
          <Button variant="wide-create" icon={Plus} onClick={() => setEditing({ item: null })}>
            {t('admin.addItem')}
          </Button>
          <ViewToggle />
        </div>
      </header>

      {adminView === 'list' ? (
        <DataTable
          columns={columns}
          rows={paged.slice}
          rowKey={(row) => row.item_id}
          loading={loading}
          emptyMessage={t('admin.itemsEmpty')}
        />
      ) : loading ? null : items.length === 0 ? (
        <p className="tile-empty">{t('admin.itemsEmpty')}</p>
      ) : (
        <div className="tile-grid">
          {paged.slice.map((item) => (
            <MenuTile
              key={item.item_id}
              item={item}
              categoryName={categoryName(item.cat_id)}
              onView={() => setViewing(item)}
              onEdit={() => setEditing({ item })}
              onDelete={() => setDeleting(item)}
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
        <MenuItemModal
          item={editing.item}
          categories={categories}
          onCancel={() => setEditing(null)}
          onSubmit={save}
        />
      ) : null}

      {viewing ? (
        <Modal
          title={viewing.name_en}
          onClose={() => setViewing(null)}
          footer={
            <Button variant="secondary" data-modal-cancel="true" onClick={() => setViewing(null)}>
              {t('common.close')}
            </Button>
          }
        >
          <dl className="detail-list">
            <dt className="eyebrow">{t('admin.itemId')}</dt>
            <dd className="numeric">{viewing.item_id}</dd>
            <dt className="eyebrow">{t('admin.fieldCategory')}</dt>
            <dd>{categoryName(viewing.cat_id)}</dd>
            <dt className="eyebrow">{t('admin.colFilipino')}</dt>
            <dd>{viewing.name_fil}</dd>
            <dt className="eyebrow">{t('admin.colBisaya')}</dt>
            <dd>{viewing.name_bis}</dd>
            <dt className="eyebrow">{t('admin.fieldPrice')}</dt>
            <dd className="numeric">{peso(viewing.price)}</dd>
            <dt className="eyebrow">{t('admin.fieldCalories')}</dt>
            <dd className="numeric">{viewing.calories ?? '—'}</dd>
            <dt className="eyebrow">{t('admin.fieldAllergens')}</dt>
            <dd>{viewing.allergens ?? '—'}</dd>
            <dt className="eyebrow">{t('admin.fieldDietary')}</dt>
            <dd>{viewing.dietary_flags ?? '—'}</dd>
            <dt className="eyebrow">{t('admin.sectionDescription')}</dt>
            <dd>{viewing.description_en ?? '—'}</dd>
          </dl>
        </Modal>
      ) : null}

      {deleting ? (
        <Modal
          title={t('admin.deleteItem')}
          size="small"
          destructive
          onClose={() => setDeleting(null)}
          footer={
            <>
              <Button variant="wide-delete" loading={deletingBusy} onClick={confirmDelete}>
                {t('admin.deleteItemConfirm')}
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
          <p>
            {t('admin.confirmDeleteItem', { name: deleting.name_en })}
          </p>
        </Modal>
      ) : null}
    </main>
  );
}
