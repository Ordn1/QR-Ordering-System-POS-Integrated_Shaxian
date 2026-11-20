const number = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const DWELL_THRESHOLD_SEC = number(import.meta.env.VITE_DWELL_THRESHOLD_SEC, 45);
export const DWELL_VISIBILITY_RATIO = 0.5;
export const BACKNAV_THRESHOLD = 3;
export const CART_ABANDON_REARM_SEC = 60;
export const CONFUSION_WINDOW_SEC = 120;
export const CONFUSION_COOLDOWN_SEC = 180;
export const CONFUSION_MAX_PER_SESSION = 3;
export const REQUIRED_SIGNALS = 2;

export const ZOOM_SCALE = 1.2;
export const ZOOM_HOLD_SEC = 1;
export const MISSED_TAP_COUNT = 3;
export const MISSED_TAP_WINDOW_SEC = 60;
export const MISSED_TAP_REACH_PX = 12;
export const TAP_SLOP_PX = 10;
export const UNDO_SEC = 6;
