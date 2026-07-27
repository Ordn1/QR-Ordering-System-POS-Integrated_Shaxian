import { api } from './client';

export const fetchSummary = () => api.get('/analytics/summary');

export const fetchVerifications = () => api.get('/analytics/verifications');
