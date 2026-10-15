import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchRecommendations, recordEvent } from '../api/recommendations';
import {
  BACKNAV_THRESHOLD,
  CART_ABANDON_REARM_SEC,
  CONFUSION_COOLDOWN_SEC,
  CONFUSION_MAX_PER_SESSION,
  CONFUSION_WINDOW_SEC,
  DWELL_THRESHOLD_SEC,
  DWELL_VISIBILITY_RATIO,
  REQUIRED_SIGNALS,
} from '../lib/confusionConfig';

const SIGNAL_EVENT = {
  dwell: 'dwell_timeout',
  back: 'back_navigation',
  abandon: 'cart_abandon',
  scroll: 'scroll_reversal',
};

export function useConfusionSignals({
  sessionId,
  language,
  cart,
  activeCategory,
  triggerCount,
  lastTriggerAt,
}) {
  const [suggestions, setSuggestions] = useState(null);

  const cartRef = useRef(cart);

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  const active = useRef(new Map());
  const dwelt = useRef(new Set());
  const backCount = useRef(0);
  const visited = useRef(new Set());
  const lastCategory = useRef(null);
  const armedAt = useRef(null);
  const previousCount = useRef(cart.length);
  const triggers = useRef(0);
  const lastTrigger = useRef(0);
  const observers = useRef(new Map());
  const timers = useRef(new Map());

  useEffect(() => {
    triggers.current = triggerCount ?? 0;
    lastTrigger.current = lastTriggerAt ? new Date(lastTriggerAt).getTime() : 0;
  }, [triggerCount, lastTriggerAt]);

  const log = useCallback(
    (payload) => {
      recordEvent(sessionId, payload).catch(() => {});
    },
    [sessionId],
  );

  const evaluate = useCallback(
    (name, detail) => {
      const now = Date.now();
      active.current.set(name, now + CONFUSION_WINDOW_SEC * 1000);
      log({ event_type: SIGNAL_EVENT[name], screen_id: 'menu', ...detail });

      for (const [key, expiry] of active.current) {
        if (expiry <= now) {
          active.current.delete(key);
        }
      }

      if (active.current.size < REQUIRED_SIGNALS) {
        return;
      }
      if (now - lastTrigger.current < CONFUSION_COOLDOWN_SEC * 1000) {
        return;
      }
      if (triggers.current >= CONFUSION_MAX_PER_SESSION) {
        return;
      }

      const firing = [...active.current.keys()];
      active.current.clear();
      triggers.current += 1;
      lastTrigger.current = now;

      fetchRecommendations(sessionId, cartRef.current, language)
        .then((response) => {
          if (response.suggestions.length === 0) {
            return;
          }
          setSuggestions(response.suggestions);
          log({
            event_type: 'recommendation_shown',
            screen_id: 'menu',
            signals: firing,
          });
        })
        .catch(() => {});
    },
    [language, log, sessionId],
  );

  // fireOnce: guards against the same signal type being added to the active
  // window more than once while it is already live. Repeatable signals like
  // 'scroll' bypass this and call evaluate() directly so two distinct
  // category-revisit events can accumulate to REQUIRED_SIGNALS.
  const fireOnce = useCallback(
    (name, detail) => {
      // Already active in the current window — skip duplicate
      if (active.current.has(name)) {
        return;
      }
      evaluate(name, detail);
    },
    [evaluate],
  );

  // evaluateRepeatable: used for signals that should contribute every time
  // they fire (e.g. scroll reversal / category revisit). Unlike fireOnce it
  // does NOT skip if the same type is already in the active window — each
  // new occurrence extends the window timestamp and may push size to REQUIRED.
  const evaluateRepeatable = useCallback(
    (name, detail) => {
      evaluate(name, detail);
    },
    [evaluate],
  );

  const fireRef = useRef(evaluateRepeatable);

  useEffect(() => {
    fireRef.current = evaluateRepeatable;
  }, [evaluateRepeatable]);

  useEffect(() => {
    function onPopState() {
      backCount.current += 1;
      if (backCount.current >= BACKNAV_THRESHOLD) {
        fireRef.current('back', {});
      }
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const count = cart.length;
    if (previousCount.current > 0 && count === 0) {
      armedAt.current = Date.now();
    }
    if (count > previousCount.current) {
      active.current.clear();
      armedAt.current = null;
    }
    previousCount.current = count;
  }, [cart]);

  useEffect(() => {
    if (!activeCategory || activeCategory === lastCategory.current) {
      return;
    }

    const returning = visited.current.has(activeCategory);
    visited.current.add(activeCategory);
    lastCategory.current = activeCategory;

    if (
      armedAt.current !== null &&
      Date.now() - armedAt.current < CART_ABANDON_REARM_SEC * 1000
    ) {
      armedAt.current = null;
      fireOnce('abandon', {});
    }
    if (returning) {
      // scroll reversal is repeatable — each revisit is a fresh confusion signal
      evaluateRepeatable('scroll', {});
    }
  }, [activeCategory, fireOnce, evaluateRepeatable]);

  const observeItem = useCallback(
    (element) => {
      if (!element) {
        return;
      }
      const itemId = element.dataset.itemId;
      if (observers.current.has(itemId)) {
        return;
      }

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            if (!timers.current.has(itemId) && !dwelt.current.has(itemId)) {
              timers.current.set(
                itemId,
                setTimeout(() => {
                  dwelt.current.add(itemId);
                  timers.current.delete(itemId);
                  fireOnce('dwell', {
                    item_id: itemId,
                    dwell_seconds: DWELL_THRESHOLD_SEC,
                  });
                }, DWELL_THRESHOLD_SEC * 1000),
              );
            }
          } else {
            clearTimeout(timers.current.get(itemId));
            timers.current.delete(itemId);
          }
        },
        { threshold: DWELL_VISIBILITY_RATIO },
      );

      observer.observe(element);
      observers.current.set(itemId, observer);
    },
    [fireOnce],
  );

  useEffect(() => {
    const running = observers.current;
    const pending = timers.current;
    return () => {
      running.forEach((observer) => observer.disconnect());
      running.clear();
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const accept = useCallback(
    (item) => {
      log({ event_type: 'recommendation_accepted', screen_id: 'menu', item_id: item.item_id });
      setSuggestions(null);
    },
    [log],
  );

  const dismiss = useCallback(() => {
    log({ event_type: 'recommendation_dismissed', screen_id: 'menu' });
    setSuggestions(null);
  }, [log]);

  return { suggestions, observeItem, accept, dismiss };
}
