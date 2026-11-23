import { api } from './client';

export const listQueue = () => api.get('/queue');

export const advanceStatus = (txnId, status) =>
  api.patch(`/queue/${txnId}/status`, { status });

export const settlePayment = (txnId, settlement) =>
  api.post(`/queue/${txnId}/payment`, settlement);

export const latestOrders = (sessionId) => api.get(`/orders/${sessionId}/latest`);

export const verifyPriorityId = (txnId) => api.post(`/queue/${txnId}/verify-id`);

export const revokePriorityDiscount = (txnId) =>
  api.post(`/queue/${txnId}/revoke-discount`);

export const listAssistance = () => api.get('/queue/assistance');

export const acknowledgeAssistance = (requestId) =>
  api.post(`/queue/assistance/${requestId}/acknowledge`);
