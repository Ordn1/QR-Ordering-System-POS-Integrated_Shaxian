import { create } from 'zustand';

import * as authApi from '../api/auth';

export const useAuthStore = create((set) => ({
  staff: null,
  status: 'unknown',

  restore: async () => {
    try {
      const staff = await authApi.fetchCurrentStaff();
      set({ staff, status: 'authenticated' });
    } catch {
      set({ staff: null, status: 'anonymous' });
    }
  },

  signIn: async (username, password) => {
    const staff = await authApi.login(username, password);
    set({ staff, status: 'authenticated' });
    return staff;
  },

  signOut: async () => {
    await authApi.logout();
    set({ staff: null, status: 'anonymous' });
  },
}));
