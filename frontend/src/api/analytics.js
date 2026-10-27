import { api } from './client';

export const fetchSummary = () => api.get('/analytics/summary');

export const fetchVerifications = () => api.get('/analytics/verifications');

export const fetchVerificationDetail = (logId) =>
    api.get(`/analytics/verifications/${logId}`);

export const runApriori = () => api.post('/analytics/apriori/run', {});