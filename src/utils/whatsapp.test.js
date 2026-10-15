import { describe, expect, it } from "vitest";
import { buildWhatsAppUrl, getWhatsAppPhoneError } from "./whatsapp";

describe("buildWhatsAppUrl", () => {
  it("builds a wa.me link with digits only and an encoded message", () => {
    expect(buildWhatsAppUrl("+92 300 1234567", "Hello there")).toBe(
      "https://wa.me/923001234567?text=Hello%20there"
    );
  });

  it("converts national numbers before linking", () => {
    expect(buildWhatsAppUrl("0300-1234567", "Hi")).toBe(
      "https://wa.me/923001234567?text=Hi"
    );
  });

  it("encodes line breaks and reserved characters in the message", () => {
    const url = buildWhatsAppUrl("+14155552671", "Hi Sam,\n\nQuote #5 & more?");
    expect(url).toBe(
      "https://wa.me/14155552671?text=Hi%20Sam%2C%0A%0AQuote%20%235%20%26%20more%3F"
    );
    expect(new URL(url).searchParams.get("text")).toBe("Hi Sam,\n\nQuote #5 & more?");
  });

  it("never puts +, spaces or punctuation in the phone part", () => {
    const url = buildWhatsAppUrl("+1 (415) 555-2671", "x");
    expect(url.startsWith("https://wa.me/14155552671?")).toBe(true);
  });

  it("returns an empty string for an invalid or missing phone", () => {
    expect(buildWhatsAppUrl("", "Hi")).toBe("");
    expect(buildWhatsAppUrl("abc", "Hi")).toBe("");
    expect(buildWhatsAppUrl("123", "Hi")).toBe("");
    expect(buildWhatsAppUrl(undefined, "Hi")).toBe("");
  });

  it("allows an empty message", () => {
    expect(buildWhatsAppUrl("+923001234567")).toBe("https://wa.me/923001234567?text=");
  });
});

describe("getWhatsAppPhoneError", () => {
  it("distinguishes missing from invalid numbers", () => {
    expect(getWhatsAppPhoneError("")).toBe("Add a phone number first.");
    expect(getWhatsAppPhoneError("  ", "Custom empty")).toBe("Custom empty");
    expect(getWhatsAppPhoneError("abc")).toBe(
      "Enter a valid phone number with 8-15 digits."
    );
  });
});
