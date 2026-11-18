import NumberFlow from '@number-flow/react';

const FORMAT = { minimumFractionDigits: 2, maximumFractionDigits: 2 };

export default function Money({ value, sign = '' }) {
  return <NumberFlow value={Number(value)} locales="en-PH" format={FORMAT} prefix={`${sign}₱`} />;
}
