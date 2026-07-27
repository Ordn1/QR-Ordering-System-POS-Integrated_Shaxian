import { create } from 'zustand';

const MAX_VISIBLE = 3;
const DURATION = { success: 3000, info: 4000, error: null };

const timers = new Map();

function clearTimer(id) {
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }
}

export const useToastStore = create((set, get) => ({
  toasts: [],
  modalDepth: 0,

  openModal: () => set((state) => ({ modalDepth: state.modalDepth + 1 })),
  closeModal: () => set((state) => ({ modalDepth: Math.max(0, state.modalDepth - 1) })),

  push: (type, message) => {
    const existing = get().toasts.find(
      (toast) => toast.type === type && toast.message === message,
    );

    if (existing) {
      clearTimer(existing.id);
      get().scheduleDismiss(existing.id, type);
      return existing.id;
    }

    const id = crypto.randomUUID();
    set((state) => {
      const next = [...state.toasts, { id, type, message }];
      const overflow = next.slice(0, Math.max(0, next.length - MAX_VISIBLE));
      overflow.forEach((toast) => clearTimer(toast.id));
      return { toasts: next.slice(-MAX_VISIBLE) };
    });

    get().scheduleDismiss(id, type);
    return id;
  },

  scheduleDismiss: (id, type) => {
    const duration = DURATION[type];
    if (duration === null) {
      return;
    }
    timers.set(
      id,
      setTimeout(() => get().dismiss(id), duration),
    );
  },

  dismiss: (id) => {
    clearTimer(id);
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
  },
}));

export const toast = {
  success: (message) => useToastStore.getState().push('success', message),
  info: (message) => useToastStore.getState().push('info', message),
  error: (message) => useToastStore.getState().push('error', message),
};
