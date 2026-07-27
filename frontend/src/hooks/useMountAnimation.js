import { useCallback, useState } from 'react';

/**
 * UIDesign.md §13 wants the chart entrance animation to run once, on mount.
 * Recharts re-runs it whenever its ResponsiveContainer is re-measured, so a
 * window resize replays every bar from zero. Latching the flag off once the
 * first pass finishes keeps the entrance and drops the replays.
 *
 * Returns the props to spread onto the animated Recharts series.
 */
export default function useMountAnimation(duration) {
  const [active, setActive] = useState(true);
  const settle = useCallback(() => setActive(false), []);

  return {
    isAnimationActive: active,
    animationDuration: duration,
    onAnimationEnd: settle,
  };
}
