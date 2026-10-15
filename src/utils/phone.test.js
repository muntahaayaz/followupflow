import { describe, expect, it } from "vitest";
import { isValidPhone, normalizePhone } from "./phone";

describe("normalizePhone", () => {
  it("returns an empty string for empty or missing input", () => {
    expect(normalizePhone("")).toBe("");
    expect(normalizePhone("   ")).toBe("");
    expect(normalizePhone(null)).toBe("");
    expect(normalizePhone(undefined)).toBe("");
  });

  it("keeps international numbers written with +", () => {
    expect(normalizePhone("+92 300 1234567")).toBe("923001234567");
    expect(normalizePhone("+1 (415) 555-2671")).toBe("14155552671");
    expect(normalizePhone("+44 20 7946 0958")).toBe("442079460958");
    expect(normalizePhone("+971-50-123-4567")).toBe("971501234567");
  });

  it("converts national numbers starting with 0 using the default country code", () => {
    expect(normalizePhone("0300-1234567")).toBe("923001234567");
    expect(normalizePhone("0300 1234567")).toBe("923001234567");
    expect(normalizePhone("(021) 3456 7890")).toBe("922134567890");
  });

  it("supports a different default country code", () => {
    expect(normalizePhone("07911 123456", "44")).toBe("447911123456");
    expect(normalizePhone("07911 123456", "+44")).toBe("447911123456");
  });

  it("strips the 00 international call prefix", () => {
    expect(normalizePhone("0092 300 1234567")).toBe("923001234567");
    expect(normalizePhone("00 44 20 7946 0958")).toBe("442079460958");
  });

  it("drops an optional trunk zero", () => {
    expect(normalizePhone("+44 (0)20 7946 0958")).toBe("442079460958");
    expect(normalizePhone("+92 0300 1234567")).toBe("923001234567");
  });

  it("accepts numbers that already include a country code", () => {
    expect(normalizePhone("923001234567")).toBe("923001234567");
    expect(normalizePhone("14155552671")).toBe("14155552671");
  });

  it("rejects letters, extensions and misplaced plus signs", () => {
    expect(normalizePhone("call me")).toBe("");
    expect(normalizePhone("0300 1234567 ext 5")).toBe("");
    expect(normalizePhone("0300-123-abc")).toBe("");
    expect(normalizePhone("0300+1234567")).toBe("");
    expect(normalizePhone("++923001234567")).toBe("");
  });

  it("rejects numbers that are too short or too long", () => {
    expect(normalizePhone("1234567")).toBe(""); // 7 digits
    expect(normalizePhone("+1234567")).toBe("");
    expect(normalizePhone("+1234567890123456")).toBe(""); // 16 digits
    expect(normalizePhone("+12345678")).toBe("12345678"); // 8 digits is the minimum
    expect(normalizePhone("+123456789012345")).toBe("123456789012345"); // 15 is the maximum
  });

  it("rejects numbers whose country code would start with 0", () => {
    expect(normalizePhone("+0300 1234567")).toBe("");
    expect(normalizePhone("+00 92 300 1234567")).toBe("");
  });

  it("returns digits only", () => {
    expect(normalizePhone("+92 (300) 123-4567")).toMatch(/^\d+$/);
  });
});

describe("isValidPhone", () => {
  it("mirrors normalizePhone", () => {
    expect(isValidPhone("+92 300 1234567")).toBe(true);
    expect(isValidPhone("hello")).toBe(false);
    expect(isValidPhone("")).toBe(false);
  });
});
