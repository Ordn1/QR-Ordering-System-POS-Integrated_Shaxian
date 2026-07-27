import { useEffect, useRef } from 'react';

import { useToastStore } from '../../store/toastStore';
import ToastRegion from './ToastRegion';

const FOCUSABLE =
  'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

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
  children,
}) {
  const containerRef = useRef(null);
  const previouslyFocused = useRef(null);
  const openModal = useToastStore((state) => state.openModal);
  const closeModal = useToastStore((state) => state.closeModal);

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

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (!destructive && event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={`${SIZE_CLASS[size]}${destructive ? ' confirm-dialog' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={containerRef}
      >
        <ToastRegion inModal />
        <header className="modal-header">
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
      </div>
    </div>
  );
}
