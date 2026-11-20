import { create } from 'zustand';

const ownerOf = (forDeviceId) => forDeviceId ?? null;

const sameLine = (line, itemId, forDeviceId) =>
  line.item_id === itemId && ownerOf(line.for_device_id) === ownerOf(forDeviceId);

export const lineKey = (line) => `${line.item_id}:${line.for_device_id ?? 'me'}`;

export const cartPayload = (lines) =>
  lines.map((line) => ({
    item_id: line.item_id,
    quantity: line.quantity,
    for_device_id: line.for_device_id ?? null,
  }));

export const useCartStore = create((set, get) => ({
  lines: [],
  orderingFor: null,

  add: (item, qty = 1, forDeviceId) =>
    set((state) => {
      const owner = forDeviceId === undefined ? state.orderingFor : ownerOf(forDeviceId);
      const existing = state.lines.find((line) => sameLine(line, item.item_id, owner));
      if (existing) {
        return {
          lines: state.lines.map((line) =>
            line === existing ? { ...line, quantity: line.quantity + qty } : line,
          ),
        };
      }
      return { lines: [...state.lines, { ...item, for_device_id: owner, quantity: qty }] };
    }),

  setQuantity: (itemId, quantity, forDeviceId = null) =>
    set((state) => ({
      lines:
        quantity <= 0
          ? state.lines.filter((line) => !sameLine(line, itemId, forDeviceId))
          : state.lines.map((line) =>
              sameLine(line, itemId, forDeviceId) ? { ...line, quantity } : line,
            ),
    })),

  remove: (itemId, forDeviceId = null) =>
    set((state) => ({
      lines: state.lines.filter((line) => !sameLine(line, itemId, forDeviceId)),
    })),

  setOrderingFor: (forDeviceId) => set({ orderingFor: ownerOf(forDeviceId) }),

  retainFor: (companionIds) =>
    set((state) => ({
      lines: state.lines.filter(
        (line) => line.for_device_id == null || companionIds.has(line.for_device_id),
      ),
      orderingFor: companionIds.has(state.orderingFor) ? state.orderingFor : null,
    })),

  clear: () => set({ lines: [] }),

  count: () => get().lines.reduce((total, line) => total + line.quantity, 0),

  subtotal: () =>
    get().lines.reduce((total, line) => total + Number(line.price) * line.quantity, 0),
}));
