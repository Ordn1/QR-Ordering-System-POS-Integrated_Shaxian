import { api } from './client';

export const listQueue = () => api.get('/queue');

export const advanceStatus = (txnId, status) =>
  api.patch(`/queue/${txnId}/status`, { status });

export const confirmPayment = (txnId) => api.post(`/queue/${txnId}/payment`);

export const latestOrders = (sessionId) => api.get(`/orders/${sessionId}/latest`);

export const recordVerification = (txnId, check) =>
  api.post(`/queue/${txnId}/verification`, check);
