import { Banknote, CreditCard, Smartphone } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { peso } from '../../lib/format';
import { BILLS, TENDERS, changeDue, tenderReady } from '../../lib/tender';
import Button from '../shared/Button';
import TextInput from '../shared/TextInput';

const TENDER_ICON = { cash: Banknote, gcash: Smartphone, card: CreditCard };
const TENDER_NOTE = { gcash: 'staff.gcashNote', card: 'staff.cardNote' };

export default function TenderPicker({ due, tender, cash, onTenderChange, onCashChange }) {
  const { t } = useTranslation();
  const covered = tenderReady('cash', cash, due);

  return (
    <div className="tender-picker">
      <div className="tender-options" role="radiogroup" aria-label={t('staff.tenderLabel')}>
        {TENDERS.map((value) => (
          <Button
            key={value}
            variant={tender === value ? 'primary' : 'secondary'}
            icon={TENDER_ICON[value]}
            role="radio"
            aria-checked={tender === value}
            onClick={() => onTenderChange(value)}
          >
            {t(`pos.tender_${value}`)}
          </Button>
        ))}
      </div>

      {tender === 'cash' ? (
        <>
          <div className="tender-cash">
            <TextInput
              label={t('staff.cashTendered')}
              required
              inputClass="currency"
              inputMode="decimal"
              maxLength={9}
              value={cash}
              onChange={(event) => onCashChange(event.target.value)}
            />
            <div className="tender-change">
              <span className="eyebrow">{t('pos.changeDue')}</span>
              <strong className="numeric">
                {covered ? peso(changeDue(cash, due)) : t('staff.cashShort')}
              </strong>
            </div>
          </div>
          <div className="tender-bills">
            <Button variant="secondary" onClick={() => onCashChange(due.toFixed(2))}>
              {t('staff.exactCash', { amount: peso(due) })}
            </Button>
            {BILLS.filter((bill) => bill >= due).map((bill) => (
              <Button key={bill} variant="secondary" onClick={() => onCashChange(bill.toFixed(2))}>
                {peso(bill)}
              </Button>
            ))}
          </div>
        </>
      ) : (
        <p className="tender-note">{t(TENDER_NOTE[tender], { amount: peso(due) })}</p>
      )}
    </div>
  );
}
