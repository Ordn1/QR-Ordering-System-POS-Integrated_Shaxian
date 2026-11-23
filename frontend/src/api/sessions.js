import { api } from './client';

export const openSession = (qrToken, deviceToken, mode = 'auto') =>
  api.post('/sessions', { qr_token: qrToken, device_token: deviceToken ?? null, mode });

export const readSession = (sessionId) => api.get(`/sessions/${sessionId}`);

export const declarePriority = (sessionId, status) =>
  api.patch(`/sessions/${sessionId}/declaration`, { declared_priority_status: status });

export const savePreferences = (sessionId, preferences) =>
  api.patch(`/sessions/${sessionId}/preferences`, preferences);

export const updateDeviceProfile = (sessionId, displayName) =>
  api.patch(`/sessions/${sessionId}/device`, { display_name: displayName || null });

export const removeSessionDevice = (sessionId, targetDeviceId) =>
  api.delete(`/sessions/${sessionId}/devices/${targetDeviceId}`);

export const fetchTableCart = (sessionId, language = 'en') =>
  api.get(`/sessions/${sessionId}/cart?language=${encodeURIComponent(language)}`);

export const syncDeviceCart = (sessionId, items, language = 'en') =>
  api.patch(`/sessions/${sessionId}/cart`, { items, language });
export const requestAssistance = (sessionId, reason = 'asked') =>
  api.post(`/sessions/${sessionId}/assistance`, { reason });

export const readAssistance = (sessionId) => api.get(`/sessions/${sessionId}/assistance`);

export const addCompanion = (sessionId, companion) =>
  api.post(`/sessions/${sessionId}/companions`, companion);

export const removeCompanion = (sessionId, companionId) =>
  api.delete(`/sessions/${sessionId}/companions/${companionId}`);
