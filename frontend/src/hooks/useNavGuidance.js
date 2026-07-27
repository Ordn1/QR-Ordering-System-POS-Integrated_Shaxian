import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Context-aware navigation guidance.
 *
 * Distinct from the Apriori recommendation overlay: that one answers "what should I
 * order", this one answers "how do I get on with it". The trigger is a deterministic
 * rule, not a learned model — a control that is pressed repeatedly without its action
 * completing is a control the diner has not understood.
 *
 * Fires when either
 *   - a tracked control takes REPEAT_LIMIT pointerdowns inside WINDOW_MS without the
 *     matching action completing, or
 *   - the diner presses the help control.
 *
 * The highlighted target is chosen from cart and route state, so guidance always
 * points at the next step rather than at whatever was last touched.
 */
const WINDOW_MS = 10_000;
const REPEAT_LIMIT = 3;
const CLEAR_AFTER_MS = 6_000;

export function useNavGuidance({ route, cartCount }) {
  const controls = useRef(new Map());
  const presses = useRef(new Map());
  const [target, setTarget] = useState(null);

  const trackControl = useCallback(
    (name) => (node) => {
      if (node) {
        controls.current.set(name, node);
      } else {
        controls.current.delete(name);
      }
    },
    [],
  );

  /** The control the diner most likely needs next, given where they are. */
  const nextStep = useCallback(() => {
    if (route === 'checkout') {
      return 'place';
    }
    if (route === 'cart') {
      return 'checkout';
    }
    return cartCount > 0 ? 'cart' : 'add';
  }, [route, cartCount]);

  const show = useCallback(
    (name) => {
      const node = controls.current.get(name);
      if (!node) {
        return;
      }
      const box = node.getBoundingClientRect();
      setTarget({
        name,
        top: box.top + window.scrollY,
        left: box.left + window.scrollX,
        width: box.width,
        height: box.height,
      });
    },
    [],
  );

  const clear = useCallback(() => setTarget(null), []);

  /** Call when a tracked control's action actually completed. */
  const completed = useCallback((name) => {
    presses.current.delete(name);
    setTarget(null);
  }, []);

  const askForHelp = useCallback(() => show(nextStep()), [show, nextStep]);

  useEffect(() => {
    function onPointerDown(event) {
      const now = Date.now();
      for (const [name, node] of controls.current) {
        if (!node.contains(event.target)) {
          continue;
        }
        const recent = (presses.current.get(name) ?? []).filter(
          (at) => now - at < WINDOW_MS,
        );
        recent.push(now);
        presses.current.set(name, recent);
        if (recent.length >= REPEAT_LIMIT) {
          presses.current.set(name, []);
          show(nextStep());
        }
        return;
      }
    }

    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [show, nextStep]);

  useEffect(() => {
    if (!target) {
      return undefined;
    }
    const timer = setTimeout(() => setTarget(null), CLEAR_AFTER_MS);
    return () => clearTimeout(timer);
  }, [target]);

  return { trackControl, target, askForHelp, completed, clear };
}
