import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';

import { peso, queueLabel } from '../../lib/format';
import RegisterCodeLine from './RegisterCodeLine';

function legacySlip(lines = []) {
  const pick = (discounted) => ({
    lines: lines.filter((line) => Boolean(line.discounted) === discounted),
  });
  return { senior_pwd: pick(true), regular: pick(false) };
}

function SlipSection({ title, section, rows, subtotalLabel, showBarcodes }) {
  if (!section?.lines?.length) {
    return null;
  }

  return (
    <section className="register-section">
      <h3 className="register-section-title">{title}</h3>
      <ul className="register-code-lines">
        {section.lines.map((line, index) => (
          <RegisterCodeLine
            key={`${line.pos_code ?? line.description}-${index}`}
            code={line.pos_code}
            quantity={line.quantity}
            name={line.description}
            amount={line.subtotal}
            showBarcode={showBarcodes}
          />
        ))}
      </ul>
      {section.net !== undefined ? (
        <dl className="register-totals">
          {rows.map(([label, amount, deducted]) => (
            <Fragment key={label}>
              <dt>{label}</dt>
              <dd className="numeric">
                {deducted ? '−' : ''}
                {peso(amount)}
              </dd>
            </Fragment>
          ))}
          <dt className="register-net">{subtotalLabel}</dt>
          <dd className="register-net numeric">{peso(section.net)}</dd>
        </dl>
      ) : null}
    </section>
  );
}

export default function RegisterReceipt({ transmission, showBarcodes = false }) {
  const { t } = useTranslation();

  if (!transmission) {
    return <p className="register-empty">{t('pos.registerEmpty')}</p>;
  }

  const { payload, receipt_no: receiptNo, status } = transmission;
  const slip = payload.slip ?? legacySlip(payload.lines);
  const totals = payload.totals ?? {};
  const payment = payload.payment ?? {};
  const senior = slip.senior_pwd ?? {};
  const regular = slip.regular ?? {};

  return (
    <div className="register-slip">
      <p className="register-store">{t('auth.brand')}</p>
      <p className="register-branch">
        {payload.store_code} · {payload.terminal_code}
      </p>

      <dl className="register-head">
        <dt>{t('pos.queue')}</dt>
        <dd className="register-queue numeric">{queueLabel(payload.queue_number)}</dd>
        <dt>{t('staff.tableNumber', { number: payload.table_number })}</dt>
        <dd className="numeric">{payload.queue_date}</dd>
      </dl>

      <SlipSection
        title={t('pos.sectionSeniorPwd')}
        section={senior}
        rows={[
          [t('checkout.vatExempt'), senior.vat_exempt, false],
          [t('checkout.discount'), senior.discount, true],
        ]}
        subtotalLabel={t('pos.subtotalSeniorPwd')}
        showBarcodes={showBarcodes}
      />

      <SlipSection
        title={t('pos.sectionRegular')}
        section={regular}
        rows={[
          [t('checkout.vatable'), regular.vatable, false],
          [t('checkout.vat'), regular.vat, false],
        ]}
        subtotalLabel={t('pos.subtotalRegular')}
        showBarcodes={showBarcodes}
      />

      <dl className="register-totals register-grand">
        <dt className="register-net">{t('checkout.net')}</dt>
        <dd className="register-net numeric">{peso(totals.net)}</dd>
        {payment.tender === 'cash' ? (
          <>
            <dt>{t('pos.cashTendered')}</dt>
            <dd className="numeric">{peso(payment.cash_tendered)}</dd>
            <dt>{t('pos.changeDue')}</dt>
            <dd className="numeric">{peso(payment.change_due ?? 0)}</dd>
          </>
        ) : null}
        {payment.tender && payment.tender !== 'cash' ? (
          <>
            <dt>{t('pos.paidBy')}</dt>
            <dd>{t(`pos.tender_${payment.tender}`)}</dd>
          </>
        ) : null}
      </dl>

      <p className="register-ref numeric">
        {t('pos.slipRef')} {receiptNo ?? '—'}
        {status ? ` · ${t(`pos.status_${status}`)}` : ''}
      </p>
      <p className="register-notice">{t('pos.notFiscal')}</p>
    </div>
  );
}
