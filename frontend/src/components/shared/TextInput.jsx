import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { guardInput } from '../../lib/inputClasses';

const COUNTER_THRESHOLD = 0.8;

export default function TextInput({
  label,
  required = false,
  error,
  maxLength,
  value = '',
  hint,
  inputClass,
  ...rest
}) {
  const { t } = useTranslation();
  const id = useId();
  const showCounter =
    maxLength !== undefined && value.length >= maxLength * COUNTER_THRESHOLD;

  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
        {required ? <span className="seal" aria-hidden="true" /> : null}
        {required ? <span className="visually-hidden">{t('common.required')}</span> : null}
      </label>
      <input
        id={id}
        className="text-input"
        maxLength={maxLength}
        value={value}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        placeholder={hint}
        onBeforeInput={inputClass ? guardInput(inputClass) : undefined}
        {...rest}
      />
      {showCounter ? (
        <span className="field-counter numeric">
          {value.length} / {maxLength}
        </span>
      ) : null}
      {error ? (
        <span className="field-error" id={`${id}-error`} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
