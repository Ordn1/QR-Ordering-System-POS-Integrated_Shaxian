const CODE_PARTS = /^([A-Z])([0-9]{1,2})([a-z+]?)$/;

export function compareCodes(a, b) {
  const left = CODE_PARTS.exec(a) ?? [];
  const right = CODE_PARTS.exec(b) ?? [];
  return (
    (left[1] ?? '').localeCompare(right[1] ?? '') ||
    Number(left[2] ?? 0) - Number(right[2] ?? 0) ||
    (left[3] ?? '').localeCompare(right[3] ?? '')
  );
}

export function codeStartsWith(code, typed) {
  return Boolean(code) && typed !== '' && code.toLowerCase().startsWith(typed.toLowerCase());
}

export function matchCode(items, typed) {
  const coded = items.filter((item) => item.menu_code);
  const candidates = coded
    .filter((item) => codeStartsWith(item.menu_code, typed))
    .sort((a, b) => compareCodes(a.menu_code, b.menu_code));
  const exact = coded.find((item) => item.menu_code === typed) ?? null;
  return { exact, candidates };
}

export function codeLetters(items) {
  return [...new Set(items.map((item) => item.menu_code?.[0]).filter(Boolean))].sort();
}

export function canType(items, typed, key) {
  const next = typed + key;
  return items.some((item) => item.menu_code?.startsWith(next));
}
