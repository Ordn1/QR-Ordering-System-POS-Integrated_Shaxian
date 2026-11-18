import { useMemo, useRef } from 'react';

const CLICK_SLOP_PX = 6;

const clamp = (value) => Math.max(-1, Math.min(1, value));

export function useDragTilt() {
  const tilt = useRef({ x: 0, y: 0, dragging: false });
  const start = useRef(null);
  const moved = useRef(false);

  const handlers = useMemo(() => {
    const release = () => {
      start.current = null;
      tilt.current = { x: 0, y: 0, dragging: false };
    };
    return {
      onPointerDown: (event) => {
        start.current = { x: event.clientX, y: event.clientY, width: event.currentTarget.clientWidth };
        moved.current = false;
        tilt.current.dragging = true;
      },
      onPointerMove: (event) => {
        if (!start.current) {
          return;
        }
        const dx = event.clientX - start.current.x;
        const dy = event.clientY - start.current.y;
        if (Math.hypot(dx, dy) > CLICK_SLOP_PX) {
          moved.current = true;
        }
        tilt.current.x = clamp(dx / start.current.width);
        tilt.current.y = clamp(dy / start.current.width);
      },
      onPointerUp: release,
      onPointerCancel: release,
      onClickCapture: (event) => {
        if (moved.current) {
          event.preventDefault();
          event.stopPropagation();
          moved.current = false;
        }
      },
    };
  }, []);

  return { tilt, handlers };
}
