const SPREAD_IN = 1.3;
const SPREAD_OUT = 0.77;

export function watchPinch(element, { onIn, onOut }) {
  const pointers = new Map();
  let start = null;
  let fired = true;

  function settle(ratio) {
    if (fired) {
      return;
    }
    if (ratio >= SPREAD_IN) {
      fired = true;
      onIn();
    } else if (ratio <= SPREAD_OUT) {
      fired = true;
      onOut();
    }
  }

  function spread() {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function down(event) {
    if (event.pointerType !== 'touch') {
      return;
    }
    if (event.isPrimary) {
      pointers.clear();
    }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) {
      start = spread();
      fired = false;
    }
  }

  function move(event) {
    if (!pointers.has(event.pointerId)) {
      return;
    }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2 && start) {
      settle(spread() / start);
    }
  }

  function up(event) {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) {
      start = null;
    }
  }

  function gestureStart(event) {
    event.preventDefault();
    fired = false;
  }

  function gestureChange(event) {
    event.preventDefault();
    settle(event.scale);
  }

  const onElement = [
    ['pointerdown', down],
    ['gesturestart', gestureStart],
    ['gesturechange', gestureChange],
  ];
  const onWindow = [
    ['pointermove', move],
    ['pointerup', up],
    ['pointercancel', up],
  ];
  for (const [type, handler] of onElement) {
    element.addEventListener(type, handler, { passive: false });
  }
  for (const [type, handler] of onWindow) {
    window.addEventListener(type, handler);
  }
  return () => {
    for (const [type, handler] of onElement) {
      element.removeEventListener(type, handler);
    }
    for (const [type, handler] of onWindow) {
      window.removeEventListener(type, handler);
    }
  };
}
