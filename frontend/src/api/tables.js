import { api } from './client';

export const listTables = () => api.get('/tables');

export const resetTable = (tableId) => api.post(`/tables/${tableId}/reset`);

export const regenerateTableQr = (tableId) => api.post(`/tables/${tableId}/regenerate`);

export function tableQrImageUrl(tableId, baseUrl) {
  const params = new URLSearchParams();
  if (baseUrl) {
    params.set('base_url', baseUrl);
  }
  const query = params.toString();
  return `/api/v1/tables/${tableId}/qr${query ? `?${query}` : ''}`;
}
