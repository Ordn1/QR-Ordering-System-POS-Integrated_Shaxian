import { create } from 'zustand';

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

export const useUiStore = create((set) => ({
  uiMode: 'standard',
  language: 'en',
  adminView: recallView(),

  setAdminView: (adminView) => {
    localStorage.setItem(VIEW_KEY, adminView);
    set({ adminView });
  },

  setUiMode: (uiMode) => {
    applyUiMode(uiMode);
    set({ uiMode });
  },

  setLanguage: (language) => {
    applyLanguage(language);
    set({ language });
  },
}));

applyUiMode(useUiStore.getState().uiMode);
applyLanguage(useUiStore.getState().language);
