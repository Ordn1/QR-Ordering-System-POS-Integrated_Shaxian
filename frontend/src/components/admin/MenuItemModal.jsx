import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import Button from '../shared/Button';
import Modal from '../shared/Modal';
import SelectField from '../shared/SelectField';
import TextInput from '../shared/TextInput';

const BLANK = {
  cat_id: '',
  name_en: '',
  name_fil: '',
  name_bis: '',
  description_en: '',
  description_fil: '',
  description_bis: '',
  price: '',
  calories: '',
  allergens: '',
  dietary_flags: '',
  image_filename: '',
  is_available: true,
  is_featured: false,
};

function toPayload(form) {
  const optional = (value) => (value.trim() === '' ? null : value.trim());

  return {
    cat_id: form.cat_id,
    name_en: form.name_en.trim(),
    name_fil: form.name_fil.trim(),
    name_bis: form.name_bis.trim(),
    description_en: optional(form.description_en),
    description_fil: optional(form.description_fil),
    description_bis: optional(form.description_bis),
    price: form.price,
    calories: form.calories === '' ? null : Number(form.calories),
    allergens: optional(form.allergens),
    dietary_flags: optional(form.dietary_flags),
    image_filename: optional(form.image_filename),
    is_available: form.is_available,
    is_featured: form.is_featured,
  };
}

export default function MenuItemModal({ item, categories, onCancel, onSubmit }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(() =>
    item
      ? Object.fromEntries(
          Object.keys(BLANK).map((key) => [
            key,
            item[key] === null || item[key] === undefined ? BLANK[key] : item[key],
          ]),
        )
      : { ...BLANK, cat_id: categories[0]?.cat_id ?? '' },
  );
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (key) => (event) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const toggle = (key) => (event) =>
    setForm((current) => ({ ...current, [key]: event.target.checked }));

  async function submit() {
    setSaving(true);
    setFieldErrors({});
    try {
      await onSubmit(toPayload(form));
    } catch (error) {
      setFieldErrors(error.fieldErrors ?? {});
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={t(item ? 'admin.editItem' : 'admin.addItem')}
      size="large"
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" data-modal-cancel="true" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" loading={saving} onClick={submit}>
            {t(item ? 'common.save' : 'admin.addItemConfirm')}
          </Button>
        </>
      }
    >
      <h3 className="section-heading">
        <span className="seal" aria-hidden="true" />
        {t('admin.sectionNames')}
      </h3>
      <div className="form-grid">
        <TextInput
          label={t('admin.fieldNameEn')}
          required
          inputClass="alphanumeric"
          maxLength={60}
          value={form.name_en}
          error={fieldErrors.name_en}
          onChange={set('name_en')}
        />
        <SelectField
          label={t('admin.fieldCategory')}
          required
          value={form.cat_id}
          error={fieldErrors.cat_id}
          onChange={set('cat_id')}
          options={categories.map((category) => ({
            value: category.cat_id,
            label: category.name_en,
          }))}
        />
        <TextInput
          label={t('admin.fieldNameFil')}
          required
          inputClass="alphanumeric"
          maxLength={60}
          value={form.name_fil}
          error={fieldErrors.name_fil}
          onChange={set('name_fil')}
        />
        <TextInput
          label={t('admin.fieldNameBis')}
          required
          inputClass="alphanumeric"
          maxLength={60}
          value={form.name_bis}
          error={fieldErrors.name_bis}
          onChange={set('name_bis')}
        />
      </div>

      <h3 className="section-heading">
        <span className="seal" aria-hidden="true" />
        {t('admin.sectionPricing')}
      </h3>
      <div className="form-grid">
        <TextInput
          label={t('admin.fieldPrice')}
          required
          inputClass="currency"
          maxLength={9}
          value={form.price}
          error={fieldErrors.price}
          onChange={set('price')}
          hint="89.00"
        />
        <TextInput
          label={t('admin.fieldCalories')}
          inputClass="numeric"
          maxLength={5}
          value={form.calories}
          error={fieldErrors.calories}
          onChange={set('calories')}
        />
        <TextInput
          label={t('admin.fieldAllergens')}
          inputClass="freetext"
          maxLength={120}
          value={form.allergens}
          error={fieldErrors.allergens}
          onChange={set('allergens')}
          hint="wheat, milk, egg"
        />
        <TextInput
          label={t('admin.fieldDietary')}
          inputClass="freetext"
          maxLength={60}
          value={form.dietary_flags}
          error={fieldErrors.dietary_flags}
          onChange={set('dietary_flags')}
          hint="vegetarian"
        />
        <TextInput
          label={t('admin.fieldImage')}
          inputClass="freetext"
          maxLength={80}
          value={form.image_filename}
          error={fieldErrors.image_filename}
          onChange={set('image_filename')}
          hint="fried-chicken-1pc.webp"
        />
      </div>

      <h3 className="section-heading">
        <span className="seal" aria-hidden="true" />
        {t('admin.sectionDescription')}
      </h3>
      <div className="form-grid">
        <TextInput
          label={t('admin.fieldDescEn')}
          inputClass="freetext"
          maxLength={160}
          value={form.description_en}
          error={fieldErrors.description_en}
          onChange={set('description_en')}
        />
        <TextInput
          label={t('admin.fieldDescFil')}
          inputClass="freetext"
          maxLength={160}
          value={form.description_fil}
          onChange={set('description_fil')}
        />
        <TextInput
          label={t('admin.fieldDescBis')}
          inputClass="freetext"
          maxLength={160}
          value={form.description_bis}
          onChange={set('description_bis')}
        />
      </div>

      <h3 className="section-heading">
        <span className="seal" aria-hidden="true" />
        {t('admin.sectionAvailability')}
      </h3>
      <div className="stack-4">
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={form.is_available}
            onChange={toggle('is_available')}
          />
          {t('admin.available')}
        </label>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={form.is_featured}
            onChange={toggle('is_featured')}
          />
          {t('admin.featured')}
        </label>
      </div>
    </Modal>
  );
}
