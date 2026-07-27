import { Minus, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function QtyStepper({
  value,
  min = 1,
  max = 99,
  onChange,
  itemLabel = 'item',
}) {
  const { t } = useTranslation();

  return (
    <div className="qty-stepper">
      <button
        type="button"
        aria-label={t('qty.reduce', { name: itemLabel })}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
      >
        <Minus size={18} strokeWidth={1.75} />
      </button>
      <span className="qty-stepper-value" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        aria-label={t('qty.increase', { name: itemLabel })}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Plus size={18} strokeWidth={1.75} />
      </button>
    </div>
  );
}
