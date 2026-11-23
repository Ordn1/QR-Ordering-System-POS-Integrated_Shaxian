import { toCentavos } from './registerCodes';

export const TENDERS = ['cash', 'gcash', 'card'];

export const BILLS = [100, 200, 500, 1000];

export function tenderReady(tender, cash, due) {
  if (due <= 0) {
    return false;
  }
  if (tender !== 'cash') {
    return true;
  }
  return String(cash ?? '').trim() !== '' && toCentavos(cash) >= toCentavos(due);
}

export function changeDue(cash, due) {
  return Math.max(0, toCentavos(cash) - toCentavos(due)) / 100;
}
