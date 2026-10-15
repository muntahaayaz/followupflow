import { describe, expect, it } from "vitest";
import {
  THEME_KEY,
  getStorage,
  loadTheme,
  safeGetItem,
  safeSetItem,
  saveTheme,
} from "./storage";

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = String(value);
    },
  };
}

function throwingStorage() {
  return {
    getItem() {
      throw new DOMException("The operation is insecure.", "SecurityError");
    },
    setItem() {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    },
  };
}

describe("theme storage", () => {
  it("defaults to light when nothing is stored", () => {
    expect(loadTheme(memoryStorage())).toBe("light");
  });

  it("round-trips the dark theme", () => {
    const storage = memoryStorage();
    expect(saveTheme("dark", storage)).toBe(true);
    expect(storage.getItem(THEME_KEY)).toBe("dark");
    expect(loadTheme(storage)).toBe("dark");
  });

  it("treats unknown stored values as light", () => {
    expect(loadTheme(memoryStorage({ [THEME_KEY]: "purple" }))).toBe("light");
  });

  it("does not throw when reading is blocked", () => {
    expect(() => loadTheme(throwingStorage())).not.toThrow();
    expect(loadTheme(throwingStorage())).toBe("light");
  });

  it("does not throw when writing is blocked or the quota is exceeded", () => {
    expect(() => saveTheme("dark", throwingStorage())).not.toThrow();
    expect(saveTheme("dark", throwingStorage())).toBe(false);
  });

  it("handles missing storage", () => {
    expect(loadTheme(null)).toBe("light");
    expect(saveTheme("dark", null)).toBe(false);
  });

  it("survives a localStorage getter that throws", () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("denied", "SecurityError");
      },
    });
    try {
      expect(getStorage()).toBeNull();
      expect(loadTheme()).toBe("light");
      expect(saveTheme("dark")).toBe(false);
    } finally {
      if (original) Object.defineProperty(globalThis, "localStorage", original);
      else delete globalThis.localStorage;
    }
  });
});

describe("safeGetItem / safeSetItem", () => {
  it("return null / false instead of throwing", () => {
    expect(safeGetItem("k", throwingStorage())).toBeNull();
    expect(safeSetItem("k", "v", throwingStorage())).toBe(false);
  });

  it("work with a healthy storage", () => {
    const storage = memoryStorage();
    expect(safeSetItem("k", "v", storage)).toBe(true);
    expect(safeGetItem("k", storage)).toBe("v");
  });
});
