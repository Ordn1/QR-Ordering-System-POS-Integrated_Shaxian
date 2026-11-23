import { peso } from '../../lib/format';
import RegisterCode from '../shared/RegisterCode';
import Barcode from './Barcode';

export default function RegisterCodeLine({ code, quantity, name, amount, showBarcode = false }) {
  return (
    <li className="register-code-line">
      <RegisterCode code={code ?? '—'} size="large" />
      <span className="register-code-qty numeric">× {quantity}</span>
      <span className="register-code-name">{name}</span>
      {amount !== undefined ? (
        <span className="register-code-amount numeric">{peso(amount)}</span>
      ) : null}
      {showBarcode && code ? (
        <span className="register-code-barcode">
          <Barcode value={code} />
        </span>
      ) : null}
    </li>
  );
}
