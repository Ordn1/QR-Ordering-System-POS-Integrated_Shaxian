import { api } from './client';

export const listTransactions = () => api.get('/transactions');
