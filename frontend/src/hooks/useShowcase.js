import { prefersReducedMotion } from '../lib/motion';
import { useUiStore } from '../store/uiStore';

const MIN_DEVICE_MEMORY_GB = 4;

function hasWebGl2() {
  const context = document.createElement('canvas').getContext('webgl2');
  context?.getExtension('WEBGL_lose_context')?.loseContext();
  return Boolean(context);
}

const SUPPORTED =
  !prefersReducedMotion() &&
  (navigator.deviceMemory ?? MIN_DEVICE_MEMORY_GB) >= MIN_DEVICE_MEMORY_GB &&
  hasWebGl2();

export function useShowcase() {
  const accessible = useUiStore((state) => state.uiMode) === 'accessible';
  const declined = useUiStore((state) => state.showcaseDeclined);
  return SUPPORTED && !accessible && !declined;
}
