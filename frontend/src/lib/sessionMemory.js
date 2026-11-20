export function remember(key, value) {
  try {
    sessionStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function recall(key) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
