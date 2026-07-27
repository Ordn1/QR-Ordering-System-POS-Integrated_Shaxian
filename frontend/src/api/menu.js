import { api } from './client';

export const listCategories = () => api.get('/menu/categories');
export const createCategory = (payload) => api.post('/menu/categories', payload);
export const updateCategory = (catId, payload) =>
  api.patch(`/menu/categories/${catId}`, payload);
export const deleteCategory = (catId) => api.delete(`/menu/categories/${catId}`);

export const listItems = () => api.get('/menu/items');
export const createItem = (payload) => api.post('/menu/items', payload);
export const updateItem = (itemId, payload) => api.patch(`/menu/items/${itemId}`, payload);
export const deleteItem = (itemId) => api.delete(`/menu/items/${itemId}`);
