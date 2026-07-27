import { create } from 'zustand';

export const useCartStore = create((set, get) => ({
  lines: [],

  add: (item) =>
    set((state) => {
      const existing = state.lines.find((line) => line.item_id === item.item_id);
      if (existing) {
        return {
          lines: state.lines.map((line) =>
            line.item_id === item.item_id
              ? { ...line, quantity: line.quantity + 1 }
              : line,
          ),
        };
      }
      return { lines: [...state.lines, { ...item, quantity: 1 }] };
    }),

  setQuantity: (itemId, quantity) =>
    set((state) => ({
      lines:
        quantity <= 0
          ? state.lines.filter((line) => line.item_id !== itemId)
          : state.lines.map((line) =>
              line.item_id === itemId ? { ...line, quantity } : line,
            ),
    })),

  remove: (itemId) =>
    set((state) => ({ lines: state.lines.filter((line) => line.item_id !== itemId) })),

  clear: () => set({ lines: [] }),

  count: () => get().lines.reduce((total, line) => total + line.quantity, 0),

  subtotal: () =>
    get().lines.reduce((total, line) => total + Number(line.price) * line.quantity, 0),
}));
