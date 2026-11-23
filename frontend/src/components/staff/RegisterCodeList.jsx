import { useTranslation } from 'react-i18next';

import { groupByCode } from '../../lib/registerCodes';
import RegisterCodeLine from '../admin/RegisterCodeLine';

export default function RegisterCodeList({ items, isDiscounted, showBarcodes = false }) {
  const { t } = useTranslation();
  const sections = [
    ['senior', t('pos.sectionSeniorPwd'), groupByCode(items.filter(isDiscounted))],
    ['regular', t('pos.sectionRegular'), groupByCode(items.filter((item) => !isDiscounted(item)))],
  ].filter(([, , lines]) => lines.length > 0);

  return (
    <div className="register-code-list">
      {sections.map(([key, title, lines]) => (
        <section key={key} className="register-section">
          <h3 className="register-section-title">{title}</h3>
          <ul className="register-code-lines">
            {lines.map((item) => (
              <RegisterCodeLine
                key={item.pos_code ?? item.item_id}
                code={item.pos_code}
                quantity={item.qty}
                name={item.name}
                showBarcode={showBarcodes}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
