import { api } from './client';

export const placeOrder = (sessionId, payload) => api.post(`/orders/${sessionId}`, payload);

export const quoteOrder = (sessionId, items, checkoutScope = 'single') =>
  api.post(`/orders/${sessionId}/quote`, { items, checkout_scope: checkoutScope });

export const fetchReceipt = (sessionId, txnId, language = 'en') =>
  api.get(`/orders/${sessionId}/receipt/${txnId}?language=${encodeURIComponent(language)}`);

export const verifyOrderPayment = (sessionId, txnId, language = 'en') =>
  api.post(`/orders/${sessionId}/verify/${txnId}?language=${encodeURIComponent(language)}`);

// The QR Ph code for this phone's share; status flips to "paid" once the scan settles.
export const fetchQrPhCode = (sessionId, txnId) =>
  api.get(`/orders/${sessionId}/qrph/${txnId}`);