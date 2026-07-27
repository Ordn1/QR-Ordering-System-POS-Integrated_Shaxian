import { api } from './client';

export const fetchRecommendations = (sessionId, cart, language) =>
  api.post(`/recommendations/${sessionId}`, { cart, language });

export const recordEvent = (sessionId, payload) =>
  api.post(`/analytics/${sessionId}/events`, payload);
