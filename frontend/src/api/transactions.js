import { api } from './client';

export const listTransactions = () => api.get('/transactions');

export const getTransaction = (txnId) => api.get(`/transactions/${txnId}`);

export const voidTransaction = (txnId, reason) =>
    api.post(`/transactions/${txnId}/void`, { reason });