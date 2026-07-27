import { api } from './client';

export const login = (username, password) =>
  api.post('/auth/login', { username, password });

export const logout = () => api.post('/auth/logout');

export const fetchCurrentStaff = () => api.get('/auth/me');
