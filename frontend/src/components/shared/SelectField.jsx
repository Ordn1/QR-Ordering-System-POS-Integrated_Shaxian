import { ChevronDown } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

export default function SelectField({
  label,
  required = false,
  error,
  options,
  ...rest
}) {
  const { t } = useTranslation();
  const id = useId();

  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
        {required ? <span className="seal" aria-hidden="true" /> : null}
        {required ? <span className="visually-hidden">{t('common.required')}</span> : null}
      </label>
      <div className="select-wrap">
        <select
          id={id}
          className="select-field"
          aria-invalid={error ? 'true' : undefined}
          {...rest}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="select-chevron"
          size={16}
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </div>
      {error ? (
        <span className="field-error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
