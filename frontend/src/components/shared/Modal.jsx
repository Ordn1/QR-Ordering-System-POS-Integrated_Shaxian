import { motion, useDragControls } from 'motion/react';
import { useEffect, useRef } from 'react';

import { DURATION, SHEET } from '../../lib/motion';
import { useToastStore } from '../../store/toastStore';
import { useUiStore } from '../../store/uiStore';
import ToastRegion from './ToastRegion';

const FOCUSABLE =
  'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

const FADE = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: DURATION.enter },
};

const SIZE_CLASS = {
  small: 'modal modal-small',
  default: 'modal',
  large: 'modal modal-large',
};

export default function Modal({
  title,
  size = 'default',
  destructive = false,
  onClose,
  footer,
  sheet = false,
  children,
}) {
  const containerRef = useRef(null);
  const previouslyFocused = useRef(null);
  const openModal = useToastStore((state) => state.openModal);
  const closeModal = useToastStore((state) => state.closeModal);
  const dragControls = useDragControls();
  const steadyTaps = useUiStore((state) => state.display.steadyTaps);
  const draggable = sheet && !steadyTaps;

  useEffect(() => {
    openModal();
    return closeModal;
  }, [openModal, closeModal]);

  useEffect(() => {
    previouslyFocused.current = document.activeElement;
    const container = containerRef.current;
    const focusable = container.querySelectorAll(FOCUSABLE);
    const initial = destructive
      ? container.querySelector('[data-modal-cancel]')
      : focusable[0];
    initial?.focus();

    return () => previouslyFocused.current?.focus();
  }, [destructive]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab') {
        return;
      }
      const focusable = Array.from(
        containerRef.current.querySelectorAll(FOCUSABLE),
      );
      if (focusable.length === 0) {
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const Backdrop = sheet ? motion.div : 'div';
  const Panel = sheet ? motion.div : 'div';
  const startDrag = draggable ? (event) => dragControls.start(event) : undefined;
  const sheetPanelProps = draggable
    ? {
        ...FADE,
        drag: 'y',
        dragListener: false,
        dragControls,
        dragConstraints: { top: 0, bottom: 0 },
        dragElastic: { top: 0, bottom: 1 },
        dragTransition: SHEET.settle,
        onDragEnd: (_event, info) => {
          if (info.offset.y > SHEET.dismissOffset || info.velocity.y > SHEET.dismissVelocity) {
            onClose();
          }
        },
      }
    : sheet
      ? FADE
      : {};

  return (
    <Backdrop
      className={sheet ? 'modal-backdrop modal-backdrop-sheet' : 'modal-backdrop'}
      {...(sheet ? FADE : {})}
      onMouseDown={(event) => {
        if (!destructive && event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <Panel
        className={`${SIZE_CLASS[size]}${destructive ? ' confirm-dialog' : ''}${
          sheet ? ' modal-sheet' : ''
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={containerRef}
        {...sheetPanelProps}
      >
        {draggable ? (
          <div className="modal-sheet-handle" onPointerDown={startDrag} aria-hidden="true" />
        ) : null}
        <ToastRegion inModal />
        <header className="modal-header" onPointerDown={startDrag}>
          <span className="seal" aria-hidden="true" />
          <h2 className="modal-title">{title}</h2>
        </header>
        <div className="modal-body">{children}</div>
        {footer ? (
          <footer
            className={
              destructive ? 'modal-footer modal-footer-destructive' : 'modal-footer'
            }
          >
            {footer}
          </footer>
        ) : null}
      </Panel>
    </Backdrop>
  );
}
