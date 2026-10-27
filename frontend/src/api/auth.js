import { api } from './client';

export const login = (username, password) =>
  api.post('/auth/login', { username, password });

export const logout = () => api.post('/auth/logout');

export const fetchCurrentStaff = () => api.get('/auth/me');

export const listStaff = (activeOnly = false) =>
  api.get(`/auth/staff${activeOnly ? '?active_only=true' : ''}`);

export const createStaff = (payload) => api.post('/auth/staff', payload);

export const updateStaff = (staffId, payload) =>
  api.patch(`/auth/staff/${staffId}`, payload);

export const toggleStaffStatus = (staffId, isActive) =>
  api.patch(`/auth/staff/${staffId}/status`, { is_active: isActive });

export const deleteStaff = (staffId) => api.delete(`/auth/staff/${staffId}`);