import { create } from 'zustand';

import { prefersReducedMotion } from '../lib/motion';

const VIEW_KEY = 'shaxian.adminView';

function recallView() {
  const saved = localStorage.getItem(VIEW_KEY);
  return saved === 'list' || saved === 'tiles' ? saved : 'tiles';
}

export const DEFAULT_DISPLAY = { menuSize: 'grid', highContrast: false, steadyTaps: false };

export const MENU_SIZES = ['grid', 'list', 'large'];

function applyDisplay({ menuSize, highContrast, steadyTaps }) {
  const root = document.documentElement;
  root.setAttribute('data-menu-size', menuSize);
  root.setAttribute('data-contrast', highContrast ? 'high' : 'standard');
  root.setAttribute('data-steady-taps', steadyTaps ? 'true' : 'false');
}

function sameDisplay(a, b) {
  return (
    a.menuSize === b.menuSize && a.highContrast === b.highContrast && a.steadyTaps === b.steadyTaps
  );
}

function applyLanguage(language) {
  document.documentElement.setAttribute('lang', language);
}

export const useUiStore = create((set, get) => ({
  display: DEFAULT_DISPLAY,
  language: 'en',
  adminView: recallView(),
  showcaseDeclined: false,
  sound: false,

  setAdminView: (adminView) => {
    localStorage.setItem(VIEW_KEY, adminView);
    set({ adminView });
  },

  setDisplay: (changes, { animate = false } = {}) => {
    const current = get().display;
    const display = { ...current, ...changes };
    if (sameDisplay(current, display)) {
      return;
    }
    const morph =
      animate && typeof document.startViewTransition === 'function' && !prefersReducedMotion();
    if (morph) {
      document.startViewTransition(() => applyDisplay(display));
    } else {
      applyDisplay(display);
    }
    set({ display });
  },

  declineShowcase: () => set({ showcaseDeclined: true }),

  setSound: (sound) => set({ sound }),

  setLanguage: (language) => {
    applyLanguage(language);
    set({ language });
  },
}));

applyDisplay(useUiStore.getState().display);
applyLanguage(useUiStore.getState().language);
