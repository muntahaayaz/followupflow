// Safe wrappers around localStorage. Browsers can throw when storage is blocked
// (privacy modes, disabled cookies, sandboxed iframes) or full, and even just
// reading `window.localStorage` can throw a SecurityError. None of these should
// ever crash the app.

export const THEME_KEY = "followupflow-theme";

export function getStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function safeGetItem(key, storage = getStorage()) {
  try {
    return storage ? storage.getItem(key) : null;
  } catch {
    return null;
  }
}

export function safeSetItem(key, value, storage = getStorage()) {
  try {
    if (!storage) return false;
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function loadTheme(storage) {
  return safeGetItem(THEME_KEY, storage) === "dark" ? "dark" : "light";
}

export function saveTheme(theme, storage) {
  return safeSetItem(THEME_KEY, theme === "dark" ? "dark" : "light", storage);
}
