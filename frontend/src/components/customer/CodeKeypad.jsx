import { Delete, UtensilsCrossed } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { recordEvent } from '../../api/recommendations';
import { peso } from '../../lib/format';
import { canType, codeLetters, matchCode } from '../../lib/menuCode';
import { menuImageUrl } from '../../lib/menuImage';
import Badge from '../shared/Badge';
import Button from '../shared/Button';
import MenuCode from '../shared/MenuCode';
import Modal from '../shared/Modal';
import QtyStepper from '../shared/QtyStepper';

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
const SHOWN_CANDIDATES = 6;

export default function CodeKeypad({ items, nameKey, sessionId, onAdd, onClose }) {
  const { t } = useTranslation();
  const [typed, setTyped] = useState('');
  const [quantity, setQuantity] = useState(1);
  const letters = useMemo(() => codeLetters(items), [items]);
  const { exact, candidates } = matchCode(items, typed);

  function type(next) {
    setTyped(next);
    setQuantity(1);
  }

  function add() {
    onAdd(exact, quantity);
    recordEvent(sessionId, {
      event_type: 'code_entered',
      screen_id: 'keypad',
      code: exact.menu_code,
      matched: true,
      item_id: exact.item_id,
    }).catch(() => { });
    type('');
  }

  function key(value) {
    const usable = typed !== '' && canType(items, typed, value);
    return (
      <button
        key={value}
        type="button"
        className="keypad-key"
        disabled={!usable}
        onClick={() => type(typed + value)}
      >
        {value}
      </button>
    );
  }

  function suffix(value) {
    const usable = typed !== '' && canType(items, typed, value);
    return (
      <button
        key={value}
        type="button"
        className={`keypad-key${usable ? '' : ' keypad-key-unused'}`}
        disabled={!usable}
        aria-hidden={!usable}
        onClick={() => type(typed + value)}
      >
        {value}
      </button>
    );
  }

  return (
    <Modal
      sheet
      title={t('keypad.title')}
      onClose={onClose}
      footer={
        <Button variant="secondary" data-modal-cancel="true" onClick={onClose}>
          {t('keypad.close')}
        </Button>
      }
    >
      <div className="keypad-readout-row">
        <output className="keypad-readout" aria-live="polite">
          {typed ? <MenuCode code={typed} /> : <span className="keypad-placeholder">A1</span>}
        </output>
        <button
          type="button"
          className="keypad-backspace"
          aria-label={t('keypad.erase')}
          disabled={typed === ''}
          onClick={() => type(typed.slice(0, -1))}
        >
          <Delete size={24} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>

      <div className="keypad-result">
        {typed === '' ? <p className="keypad-hint">{t('keypad.hint')}</p> : null}

        {exact ? (
          <div className="keypad-dish">
            <div className="keypad-dish-photo">
              {menuImageUrl(exact.image_filename) ? (
                <img src={menuImageUrl(exact.image_filename)} alt="" />
              ) : (
                <UtensilsCrossed size={28} strokeWidth={1.5} aria-hidden="true" />
              )}
            </div>
            <div className="keypad-dish-text">
              <span className="keypad-dish-name">{exact[nameKey] || exact.name_en}</span>
              {exact.name_zh ? (
                <span className="dish-name-zh" lang="zh-Hans">
                  {exact.name_zh}
                </span>
              ) : null}
              <span className="keypad-dish-price numeric">{peso(exact.price)}</span>
            </div>
            {exact.is_available ? (
              <div className="keypad-dish-actions">
                <QtyStepper
                  value={quantity}
                  onChange={setQuantity}
                  itemLabel={exact[nameKey] || exact.name_en}
                />
                <Button variant="add-to-cart" onClick={add}>
                  {t('menu.add')} · {peso(Number(exact.price) * quantity)}
                </Button>
              </div>
            ) : (
              <Badge value="sold out" label={t('menu.soldOut')} />
            )}
          </div>
        ) : null}

        {!exact && typed !== '' && candidates.length > 0 ? (
          <ul className="keypad-candidates">
            {candidates.slice(0, SHOWN_CANDIDATES).map((item) => (
              <li key={item.item_id}>
                <button type="button" className="keypad-candidate" onClick={() => type(item.menu_code)}>
                  <MenuCode code={item.menu_code} />
                  <span className="keypad-candidate-name">{item[nameKey] || item.name_en}</span>
                  <span className="numeric">{peso(item.price)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {typed !== '' && candidates.length === 0 ? (
          <p className="keypad-hint">{t('keypad.noMatch', { code: typed })}</p>
        ) : null}
      </div>

      <div className="keypad-letters" role="group" aria-label={t('keypad.letters')}>
        {letters.map((letter) => (
          <button
            key={letter}
            type="button"
            className="keypad-key"
            aria-pressed={typed.startsWith(letter)}
            onClick={() => type(letter)}
          >
            {letter}
          </button>
        ))}
      </div>

      <div className="keypad-digits" role="group" aria-label={t('keypad.numbers')}>
        {DIGITS.map(key)}
        {suffix('s')}
        {key('0')}
        {suffix('+')}
      </div>
    </Modal>
  );
}
