import {
  BadgePercent,
  Clock,
  Receipt,
  ShoppingBag,
  Utensils,
} from 'lucide-react';
import { useState } from 'react';

import Badge from '../../components/shared/Badge';
import Button from '../../components/shared/Button';
import Card from '../../components/shared/Card';
import DataTable from '../../components/shared/DataTable';
import IconButton from '../../components/shared/IconButton';
import KpiCard from '../../components/shared/KpiCard';
import Modal from '../../components/shared/Modal';
import QtyStepper from '../../components/shared/QtyStepper';
import SelectField from '../../components/shared/SelectField';
import TextInput from '../../components/shared/TextInput';
import { useUiStore } from '../../store/uiStore';
import { toast } from '../../store/toastStore';

const BRAND_TOKENS = [
  '--cream',
  '--cream-deep',
  '--red',
  '--red-deep',
  '--ink',
  '--bg',
  '--surface',
  '--surface-2',
  '--border',
  '--border-strong',
];

const SEMANTIC_TOKENS = [
  '--green',
  '--amber',
  '--amber-strong',
  '--danger',
  '--blue',
  '--green-tint',
  '--amber-tint',
  '--danger-tint',
  '--blue-tint',
];

const TYPE_TOKENS = [
  ['--font-xl / 700', 'font-xl', 700],
  ['--font-lg / 600', 'font-lg', 600],
  ['--font-md / 600', 'font-md', 600],
  ['--font-base / 400', 'font-base', 400],
  ['--font-sm / 400', 'font-sm', 400],
  ['--font-xs / 500', 'font-xs', 500],
];

const LABELLED_VARIANTS = [
  'primary',
  'secondary',
  'ghost',
  'wide-create',
  'wide-edit',
  'wide-delete',
  'wide-view',
];

const ICON_VARIANTS = ['view', 'edit', 'delete', 'create', 'remove'];

const BADGE_GROUPS = [
  ['Order', ['pending', 'preparing', 'ready', 'completed', 'abandoned', 'voided']],
  ['Payment', ['paid', 'failed']],
  ['Table', ['vacant', 'occupied', 'reserved']],
  ['Priority', ['standard', 'senior', 'pwd', 'pregnant']],
  ['Menu', ['available', 'sold out']],
  ['Session', ['active', 'ended']],
  ['Segment', ['standard', 'priority', 'group']],
];

const ROWS = [
  { id: 'MNU-0001', name: '1pc Fried Chicken', category: 'Chicken', price: '89.00', status: 'available' },
  { id: 'MNU-0002', name: 'Steamed Rice', category: 'Rice Meals', price: '25.00', status: 'available' },
  { id: 'MNU-0027', name: 'Halo-Halo', category: 'Desserts', price: '79.00', status: 'sold out' },
];

export default function AtomsPage() {
  const uiMode = useUiStore((state) => state.uiMode);
  const setUiMode = useUiStore((state) => state.setUiMode);
  const [quantity, setQuantity] = useState(2);
  const [name, setName] = useState('1pc Fried Chicken');
  const [openModal, setOpenModal] = useState(null);

  const columns = [
    { key: 'name', header: 'Name', render: (row) => row.name },
    { key: 'category', header: 'Category', render: (row) => row.category },
    { key: 'price', header: 'Price', align: 'right', render: (row) => `₱${row.price}` },
    { key: 'status', header: 'Status', render: (row) => <Badge value={row.status} /> },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <>
          <IconButton variant="view" label={`View ${row.name}`} />
          <IconButton variant="edit" label={`Edit ${row.name}`} />
          <IconButton variant="delete" label={`Delete ${row.name}`} />
        </>
      ),
    },
  ];

  return (
    <>
      <div className="atoms-mode-bar">
        <span className="eyebrow">UI mode</span>
        <Button
          variant={uiMode === 'standard' ? 'primary' : 'secondary'}
          onClick={() => setUiMode('standard')}
        >
          Standard
        </Button>
        <Button
          variant={uiMode === 'accessible' ? 'primary' : 'secondary'}
          onClick={() => setUiMode('accessible')}
        >
          Accessible
        </Button>
      </div>

      <main className="content-area">
        <header className="page-header">
          <h1>Design system</h1>
          <div className="page-header-actions">
            <Button variant="secondary" onClick={() => toast.info('Nothing to export yet')}>
              Show info toast
            </Button>
            <Button variant="wide-create" onClick={() => toast.success('Menu item saved')}>
              Show success toast
            </Button>
            <Button
              variant="wide-delete"
              onClick={() => toast.error('A menu item named ‘Halo-Halo’ already exists.')}
            >
              Show error toast
            </Button>
          </div>
        </header>

        <section className="atoms-section">
          <h2 className="section-heading">
            <span className="seal" aria-hidden="true" />
            Palette
          </h2>
          <div className="atoms-swatch-grid">
            {[...BRAND_TOKENS, ...SEMANTIC_TOKENS].map((token) => (
              <div className="atoms-swatch" key={token}>
                <div
                  className="atoms-swatch-chip"
                  style={{ background: `var(${token})` }}
                />
                <div className="atoms-swatch-label">{token}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="atoms-section">
          <h2 className="section-heading">
            <span className="seal" aria-hidden="true" />
            Typography
          </h2>
          {TYPE_TOKENS.map(([label, token, weight]) => (
            <div className="atoms-type-row" key={token}>
              <span className="atoms-type-token">{label}</span>
              <span style={{ fontSize: `var(--${token})`, fontWeight: weight }}>
                Halo-Halo · Ma. Teresa Dela Cruz · ₱1,234.50
              </span>
            </div>
          ))}
        </section>

        <section className="atoms-section">
          <h2 className="section-heading">
            <span className="seal" aria-hidden="true" />
            Buttons
          </h2>
          <div className="row-4">
            {LABELLED_VARIANTS.map((variant) => (
              <Button key={variant} variant={variant}>
                {variant}
              </Button>
            ))}
          </div>
          <div className="row-4" style={{ marginTop: 'var(--space-4)' }}>
            <Button variant="primary" disabled>
              Disabled
            </Button>
            <Button variant="primary" loading>
              Loading
            </Button>
            <Button variant="add-to-cart" icon={ShoppingBag}>
              Add to cart
            </Button>
            {ICON_VARIANTS.map((variant) => (
              <IconButton key={variant} variant={variant} label={variant} />
            ))}
          </div>
        </section>

        <section className="atoms-section">
          <h2 className="section-heading">
            <span className="seal" aria-hidden="true" />
            Badges
          </h2>
          <div className="stack-2">
            {BADGE_GROUPS.map(([group, values]) => (
              <div className="row-3" key={group}>
                <span className="atoms-type-token">{group}</span>
                {values.map((value) => (
                  <Badge key={`${group}-${value}`} value={value} />
                ))}
              </div>
            ))}
            <div className="row-3">
              <span className="atoms-type-token">Payment pending</span>
              <Badge value="pending" domain="payment" />
            </div>
          </div>
        </section>

        <section className="atoms-section">
          <h2 className="section-heading">
            <span className="seal" aria-hidden="true" />
            KPI cards
          </h2>
          <div className="kpi-grid">
            <KpiCard label="Orders today" value="248" delta="▲ 12% vs yesterday" direction="up" icon={Receipt} />
            <KpiCard label="Gross sales" value="₱48,120.00" delta="▼ 3% vs yesterday" direction="down" icon={BadgePercent} />
            <KpiCard label="Avg prep time" value="7m 20s" icon={Clock} />
            <KpiCard label="Priority orders" value="36" icon={Utensils} />
          </div>
        </section>

        <section className="atoms-section">
          <h2 className="section-heading">
            <span className="seal" aria-hidden="true" />
            Tables
          </h2>
          <div className="stack-6">
            <DataTable columns={columns} rows={ROWS} rowKey={(row) => row.id} />
            <DataTable columns={columns} rows={ROWS} rowKey={(row) => row.id} variant="compact" />
            <DataTable
              columns={columns}
              rows={ROWS}
              rowKey={(row) => row.id}
              variant="queue"
              rowClassName={(row) => (row.status === 'sold out' ? 'table-row-priority' : undefined)}
            />
            <DataTable columns={columns} rows={[]} rowKey={(row) => row.id} loading />
            <DataTable
              columns={columns}
              rows={[]}
              rowKey={(row) => row.id}
              emptyMessage="No menu items yet. Add your first item to get started."
              emptyAction={<Button variant="wide-create">Add menu item</Button>}
            />
          </div>
        </section>

        <section className="atoms-section">
          <h2 className="section-heading">
            <span className="seal" aria-hidden="true" />
            Forms
          </h2>
          <div className="atoms-grid-two">
            <Card title="Fields">
              <TextInput
                label="Item name"
                required
                maxLength={60}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <TextInput
                label="Price"
                required
                value="89.00"
                error="Price must be between ₱0.00 and ₱999,999.99."
                readOnly
              />
              <TextInput label="Image filename" value="" hint="fried-chicken-1pc.webp" readOnly />
              <TextInput label="Disabled" value="Not editable" disabled readOnly />
              <SelectField
                label="Category"
                required
                options={[
                  { value: 'CAT-0001', label: 'Chicken' },
                  { value: 'CAT-0002', label: 'Rice Meals' },
                ]}
              />
            </Card>
            <Card title="Controls">
              <div className="stack-4">
                <label className="checkbox-field">
                  <input type="checkbox" defaultChecked />
                  Available
                </label>
                <label className="checkbox-field">
                  <input type="checkbox" />
                  Featured
                </label>
                <label className="radio-field">
                  <input type="radio" name="pay" defaultChecked />
                  Pay at cashier
                </label>
                <label className="radio-field">
                  <input type="radio" name="pay" />
                  Pay online
                </label>
                <div className="row-3">
                  <span className="atoms-type-token">Quantity</span>
                  <QtyStepper value={quantity} onChange={setQuantity} itemLabel="1pc Fried Chicken" />
                </div>
              </div>
            </Card>
          </div>
        </section>

        <section className="atoms-section">
          <h2 className="section-heading">
            <span className="seal" aria-hidden="true" />
            Modals
          </h2>
          <div className="row-4">
            <Button variant="secondary" onClick={() => setOpenModal('default')}>
              Open form modal
            </Button>
            <Button variant="wide-delete" onClick={() => setOpenModal('destructive')}>
              Open destructive confirm
            </Button>
          </div>
        </section>
      </main>

      {openModal === 'default' ? (
        <Modal
          title="Edit menu item"
          onClose={() => setOpenModal(null)}
          footer={
            <>
              <Button
                variant="secondary"
                data-modal-cancel="true"
                onClick={() => setOpenModal(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setOpenModal(null);
                  toast.success('Menu item saved');
                }}
              >
                Save changes
              </Button>
            </>
          }
        >
          <TextInput label="Item name" required maxLength={60} value={name} onChange={(event) => setName(event.target.value)} />
          <SelectField
            label="Category"
            options={[
              { value: 'CAT-0001', label: 'Chicken' },
              { value: 'CAT-0002', label: 'Rice Meals' },
            ]}
          />
          <Button variant="secondary" onClick={() => toast.error('That price is not valid.')}>
            Raise an error inside this modal
          </Button>
        </Modal>
      ) : null}

      {openModal === 'destructive' ? (
        <Modal
          title="Delete menu item"
          size="small"
          destructive
          onClose={() => setOpenModal(null)}
          footer={
            <>
              <Button
                variant="wide-delete"
                onClick={() => {
                  setOpenModal(null);
                  toast.success('Menu item deleted');
                }}
              >
                Delete item
              </Button>
              <Button
                variant="secondary"
                data-modal-cancel="true"
                onClick={() => setOpenModal(null)}
              >
                Cancel
              </Button>
            </>
          }
        >
          <p>
            1pc Fried Chicken will be removed from the menu. This cannot be undone.
          </p>
        </Modal>
      ) : null}
    </>
  );
}
