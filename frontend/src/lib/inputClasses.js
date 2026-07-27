const LATIN = 'A-Za-zÀ-ÖØ-öø-ÿ';

const FORBIDDEN_RANGES = [
  [0x0000, 0x001f],
  [0x007f, 0x007f],
  [0x200b, 0x200d],
  [0x2060, 0x2060],
  [0xfe0f, 0xfe0f],
  [0xfeff, 0xfeff],
  [0x2600, 0x27bf],
  [0x2b00, 0x2bff],
  [0x1f000, 0x1faff],
];

const FORBIDDEN = new RegExp(
  `[${FORBIDDEN_RANGES.map(
    ([low, high]) =>
      `\\u{${low.toString(16)}}-\\u{${high.toString(16)}}`,
  ).join('')}]`,
  'u',
);

const PARTIAL = {
  alpha: new RegExp(`^[${LATIN} '\\-.]*$`),
  alphanumeric: new RegExp(`^[${LATIN}0-9 '\\-.()]*$`),
  numeric: /^[0-9]*$/,
  currency: /^[0-9]*(\.[0-9]{0,2})?$/,
  freetext: null,
};

export function guardInput(inputClass) {
  const allowed = PARTIAL[inputClass];

  return (event) => {
    const inserted = event.data;
    if (inserted === null || inserted === undefined) {
      return;
    }

    if (FORBIDDEN.test(inserted)) {
      event.preventDefault();
      return;
    }

    if (!allowed) {
      return;
    }

    const field = event.currentTarget;
    const next =
      field.value.slice(0, field.selectionStart) +
      inserted +
      field.value.slice(field.selectionEnd);

    if (!allowed.test(next)) {
      event.preventDefault();
    }
  };
}
