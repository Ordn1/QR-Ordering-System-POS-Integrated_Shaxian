import { create } from 'zustand';

import { prefersReducedMotion } from '../lib/motion';

const VIEW_KEY = 'shaxian.adminView';

function recallView() {
  const saved = localStorage.getItem(VIEW_KEY);
  return saved === 'list' || saved === 'tiles' ? saved : 'tiles';
}

function applyUiMode(uiMode) {
  document.documentElement.setAttribute('data-ui-mode', uiMode);
}

function applyLanguage(language) {
  document.documentElement.setAttribute('lang', language);
}

export const useUiStore = create((set, get) => ({
  uiMode: 'standard',
  language: 'en',
  adminView: recallView(),
  showcaseDeclined: false,
  sound: false,

  setAdminView: (adminView) => {
    localStorage.setItem(VIEW_KEY, adminView);
    set({ adminView });
  },

  setUiMode: (uiMode, { animate = false } = {}) => {
    const morph =
      animate &&
      uiMode !== get().uiMode &&
      typeof document.startViewTransition === 'function' &&
      !prefersReducedMotion();
    if (morph) {
      document.startViewTransition(() => applyUiMode(uiMode));
    } else {
      applyUiMode(uiMode);
    }
    set({ uiMode });
  },

  declineShowcase: () => set({ showcaseDeclined: true }),

  setSound: (sound) => set({ sound }),

  setLanguage: (language) => {
    applyLanguage(language);
    set({ language });
  },
}));

applyUiMode(useUiStore.getState().uiMode);
applyLanguage(useUiStore.getState().language);
