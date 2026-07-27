import { api } from './client';

export const fetchBridgeStatus = () => api.get('/pos/status');

export const fetchTransmissions = () => api.get('/pos/transmissions');

export const transmit = (txnId) => api.post(`/pos/transmit/${txnId}`, {});
