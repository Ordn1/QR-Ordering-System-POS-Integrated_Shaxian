import { api } from './client';

export const placeOrder = (sessionId, payload) => api.post(`/orders/${sessionId}`, payload);

export const quoteOrder = (sessionId, items) =>
  api.post(`/orders/${sessionId}/quote`, { items });

export const fetchReceipt = (sessionId, txnId, language = 'en') =>
  api.get(`/orders/${sessionId}/receipt/${txnId}?language=${encodeURIComponent(language)}`);

export const verifyOrderPayment = (sessionId, txnId, language = 'en') =>
  api.post(`/orders/${sessionId}/verify/${txnId}?language=${encodeURIComponent(language)}`);