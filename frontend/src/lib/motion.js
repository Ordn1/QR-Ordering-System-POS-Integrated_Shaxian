export const EASE_OUT = [0.22, 1, 0.36, 1];

export const DURATION = {
  enter: 0.15,
  move: 0.24,
  fly: 0.45,
  hold: 0.4,
};

export const MOVE = { duration: DURATION.move, ease: EASE_OUT };

export const LEAVE = { duration: DURATION.fly, ease: EASE_OUT };

export const SWAP = {
  hidden: { opacity: 0, scale: 0.85, transition: { duration: DURATION.enter, ease: EASE_OUT } },
  shown: { opacity: 1, scale: 1, transition: { type: 'spring', bounce: 0.4, duration: 0.5 } },
};

export const OFFSET = {
  swap: 16,
  enter: 8,
  rise: 32,
};

export const FLY = {
  landedSize: 24,
  bumpScale: 1.18,
  fallEase: [0.4, 0, 0.9, 0.6],
  hapticMs: 10,
};

export const SHEET = {
  dismissOffset: 120,
  dismissVelocity: 500,
  settle: { bounceStiffness: 600, bounceDamping: 60 },
};

export const cssEase = (curve) => `cubic-bezier(${curve.join(', ')})`;

export function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
