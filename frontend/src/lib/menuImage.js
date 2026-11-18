export const MENU_IMAGE_BASE = '/menu';

export function menuImageUrl(filename) {
  return filename ? `${MENU_IMAGE_BASE}/${encodeURIComponent(filename)}` : null;
}

export function menuDepthUrl(filename) {
  return filename ? `${MENU_IMAGE_BASE}/depth/${encodeURIComponent(filename)}` : null;
}
