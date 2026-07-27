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
