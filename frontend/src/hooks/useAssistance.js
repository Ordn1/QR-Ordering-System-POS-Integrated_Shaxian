import { useCallback, useEffect, useRef, useState } from 'react';

import { recordEvent } from '../api/recommendations';
import {
  MISSED_TAP_COUNT,
  MISSED_TAP_REACH_PX,
  MISSED_TAP_WINDOW_SEC,
  TAP_SLOP_PX,
  UNDO_SEC,
  ZOOM_HOLD_SEC,
  ZOOM_SCALE,
} from '../lib/confusionConfig';
import { recall, remember as keep } from '../lib/sessionMemory';
import { useSessionStore } from '../store/sessionStore';
import { MENU_SIZES, useUiStore } from '../store/uiStore';

const CONTROLS = 'button, a[href], input, select, textarea, label, [role="tab"], [role="button"]';
const REACH = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [0.7, 0.7],
  [-0.7, 0.7],
  [0.7, -0.7],
  [-0.7, -0.7],
];

function answeredKey(sessionId) {
  return `shaxian.assist_answered.${sessionId}`;
}

function readAnswered(sessionId) {
  try {
    return new Set(JSON.parse(recall(answeredKey(sessionId))) ?? []);
  } catch {
    return new Set();
  }
}

function controlName(control) {
  const raw = control.classList[0] || control.getAttribute('role') || control.tagName;
  return raw.toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 40) || 'control';
}

function nearbyControl(x, y) {
  for (const [dx, dy] of REACH) {
    const element = document.elementFromPoint(x + dx * MISSED_TAP_REACH_PX, y + dy * MISSED_TAP_REACH_PX);
    const control = element?.closest(CONTROLS);
    if (control) {
      return control;
    }
  }
  return null;
}

function nextSize(menuSize) {
  return MENU_SIZES[MENU_SIZES.indexOf(menuSize) + 1] ?? null;
}

export function useAssistance({ sessionId, screenId, onCrew }) {
  const [offer, setOffer] = useState(null);
  const [undo, setUndo] = useState(null);
  const offerRef = useRef(null);
  const answered = useRef(new Set());
  const screenRef = useRef(screenId);
  const setDisplay = useSessionStore((state) => state.setDisplay);

  useEffect(() => {
    screenRef.current = screenId;
  }, [screenId]);

  useEffect(() => {
    answered.current = sessionId ? readAnswered(sessionId) : new Set();
  }, [sessionId]);

  const log = useCallback(
    (payload) => {
      if (sessionId) {
        recordEvent(sessionId, { screen_id: screenRef.current, ...payload }).catch(() => { });
      }
    },
    [sessionId],
  );

  const remember = useCallback(
    (kind) => {
      answered.current.add(kind);
      keep(answeredKey(sessionId), JSON.stringify([...answered.current]));
    },
    [sessionId],
  );

  const propose = useCallback(
    (kind) => {
      if (!sessionId || offerRef.current || answered.current.has(kind)) {
        return;
      }
      const display = useUiStore.getState().display;
      if (kind === 'display' && !nextSize(display.menuSize)) {
        return;
      }
      if (kind === 'taps' && display.steadyTaps) {
        return;
      }
      offerRef.current = kind;
      setOffer({ kind });
      log({ event_type: 'assist_offered', offer: kind });
    },
    [log, sessionId],
  );

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) {
      return undefined;
    }
    let timer = null;
    let reported = false;
    function check() {
      if (viewport.scale <= ZOOM_SCALE) {
        clearTimeout(timer);
        timer = null;
        return;
      }
      if (timer) {
        return;
      }
      timer = setTimeout(() => {
        timer = null;
        if (!reported) {
          reported = true;
          log({ event_type: 'zoom_detected', zoom_scale: Math.round(viewport.scale * 100) / 100 });
        }
        propose('display');
      }, ZOOM_HOLD_SEC * 1000);
    }
    viewport.addEventListener('resize', check);
    return () => {
      viewport.removeEventListener('resize', check);
      clearTimeout(timer);
    };
  }, [log, propose]);

  useEffect(() => {
    let start = null;
    let misses = [];
    function onDown(event) {
      start = { x: event.clientX, y: event.clientY };
    }
    function onUp(event) {
      if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > TAP_SLOP_PX) {
        return;
      }
      if (event.target.closest?.(CONTROLS)) {
        return;
      }
      const control = nearbyControl(event.clientX, event.clientY);
      if (!control) {
        return;
      }
      const now = Date.now();
      misses = misses.filter((at) => now - at < MISSED_TAP_WINDOW_SEC * 1000);
      misses.push(now);
      if (misses.length >= MISSED_TAP_COUNT) {
        misses = [];
        log({
          event_type: 'missed_tap',
          target: controlName(control),
          distance_px: MISSED_TAP_REACH_PX,
        });
        propose('taps');
      }
    }
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('pointerup', onUp, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('pointerup', onUp, true);
    };
  }, [log, propose]);

  useEffect(() => {
    if (!undo) {
      return undefined;
    }
    const timer = setTimeout(() => setUndo(null), UNDO_SEC * 1000);
    return () => clearTimeout(timer);
  }, [undo]);

  const close = useCallback(
    (kind) => {
      remember(kind);
      offerRef.current = null;
      setOffer(null);
    },
    [remember],
  );

  const accept = useCallback(() => {
    const kind = offerRef.current;
    if (!kind) {
      return;
    }
    log({ event_type: 'assist_accepted', offer: kind });
    close(kind);
    const before = useUiStore.getState().display;
    if (kind === 'display') {
      setDisplay({ menuSize: nextSize(before.menuSize) }, 'offer').catch(() => { });
      setUndo({ menuSize: before.menuSize });
    } else if (kind === 'taps') {
      setDisplay({ steadyTaps: true }, 'offer').catch(() => { });
      setUndo({ steadyTaps: before.steadyTaps });
    } else {
      onCrew('offered');
    }
  }, [close, log, onCrew, setDisplay]);

  const decline = useCallback(() => {
    const kind = offerRef.current;
    if (!kind) {
      return;
    }
    log({ event_type: 'assist_declined', offer: kind });
    close(kind);
  }, [close, log]);

  const revert = useCallback(() => {
    if (undo) {
      setDisplay(undo, 'button').catch(() => { });
      setUndo(null);
    }
  }, [setDisplay, undo]);

  return { offer, undo: Boolean(undo), propose, accept, decline, revert };
}
