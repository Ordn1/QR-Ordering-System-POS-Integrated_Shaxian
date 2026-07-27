import { api } from './client';

export const placeOrder = (sessionId, payload) => api.post(`/orders/${sessionId}`, payload);

export const quoteOrder = (sessionId, items) =>
  api.post(`/orders/${sessionId}/quote`, { items });
