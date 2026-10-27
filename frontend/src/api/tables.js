import { api } from './client';

export const listTables = (includeInactive = false) =>
  api.get(`/tables${includeInactive ? '?include_inactive=true' : ''}`);

export const createTable = (payload) => api.post('/tables', payload);

export const updateTable = (tableId, payload) =>
  api.patch(`/tables/${tableId}`, payload);

export const deleteTable = (tableId) => api.delete(`/tables/${tableId}`);

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