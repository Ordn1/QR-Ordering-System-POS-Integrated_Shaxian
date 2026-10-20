import { api } from './client';

export const openSession = (qrToken, deviceToken) =>
  api.post('/sessions', { qr_token: qrToken, device_token: deviceToken ?? null });

export const readSession = (sessionId) => api.get(`/sessions/${sessionId}`);

export const scanPriorityId = (sessionId, status, imageBase64) =>
  api.post(`/sessions/${sessionId}/scan-id`, {
    declared_priority_status: status,
    image_base64: imageBase64,
  });

export const declarePriority = (sessionId, status, details = {}) =>
  api.patch(`/sessions/${sessionId}/declaration`, {
    declared_priority_status: status,
    id_last4: details.id_last4 || null,
    cardholder_name: details.cardholder_name || null,
    issuing_lgu: details.issuing_lgu || null,
  });

export const savePreferences = (sessionId, preferences) =>
  api.patch(`/sessions/${sessionId}/preferences`, preferences);

export const fetchTableCart = (sessionId, language = 'en') =>
  api.get(`/sessions/${sessionId}/cart?language=${encodeURIComponent(language)}`);

export const syncDeviceCart = (sessionId, items, language = 'en') =>
  api.patch(`/sessions/${sessionId}/cart`, { items, language });