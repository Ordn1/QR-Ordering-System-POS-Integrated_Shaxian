import { api } from './client';

export const listQueue = () => api.get('/queue');

export const advanceStatus = (txnId, status) =>
  api.patch(`/queue/${txnId}/status`, { status });

export const confirmPayment = (txnId, cashTendered = null) =>
  api.post(
    `/queue/${txnId}/payment`,
    cashTendered !== null ? { cash_tendered: cashTendered } : {},
  );

export const verifyPriorityId = (txnId, payload) =>
  api.post(`/queue/${txnId}/verify-id`, payload);

export const revokePriorityDiscount = (txnId) =>
  api.post(`/queue/${txnId}/revoke-discount`);

export const latestOrders = (sessionId) => api.get(`/orders/${sessionId}/latest`);