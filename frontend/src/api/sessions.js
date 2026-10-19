import { api } from './client';

export const openSession = (qrToken, deviceToken) =>
  api.post('/sessions', { qr_token: qrToken, device_token: deviceToken ?? null });

export const readSession = (sessionId) => api.get(`/sessions/${sessionId}`);

export const declarePriority = (sessionId, status) =>
  api.patch(`/sessions/${sessionId}/declaration`, { declared_priority_status: status });

export const savePreferences = (sessionId, preferences) =>
  api.patch(`/sessions/${sessionId}/preferences`, preferences);

export const fetchTableCart = (sessionId, language = 'en') =>
  api.get(`/sessions/${sessionId}/cart?language=${encodeURIComponent(language)}`);

export const syncDeviceCart = (sessionId, items, language = 'en') =>
  api.patch(`/sessions/${sessionId}/cart`, { items, language });