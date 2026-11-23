const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

export function compareRegisterCodes(a, b) {
  if (!a || !b) {
    return Number(!a) - Number(!b);
  }
  return collator.compare(a, b);
}

export function groupByCode(items) {
  const merged = new Map();
  for (const item of items) {
    const key = item.pos_code ?? item.item_id;
    const current = merged.get(key);
    merged.set(
      key,
      current
        ? { ...current, qty: current.qty + item.qty, subtotal: current.subtotal + Number(item.subtotal) }
        : { ...item, subtotal: Number(item.subtotal) },
    );
  }
  return [...merged.values()].sort(
    (a, b) => compareRegisterCodes(a.pos_code, b.pos_code) || a.name.localeCompare(b.name),
  );
}

export function codeSummary(items) {
  return groupByCode(items)
    .map((item) => `${item.pos_code ?? item.name} ×${item.qty}`)
    .join(' · ');
}

export function toCentavos(amount) {
  return Math.round(Number(amount) * 100);
}
