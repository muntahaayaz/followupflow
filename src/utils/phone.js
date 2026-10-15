// Phone helpers for WhatsApp links (wa.me expects digits only, with country code).

const ALLOWED_CHARACTERS = /^\+?[\d\s().-]+$/;

/**
 * Normalizes a phone number to the digits-only international format wa.me needs.
 * Returns "" when the input is empty or not a plausible phone number.
 *
 *   "+92 300 1234567"      -> "923001234567"
 *   "0300-1234567"         -> "923001234567" (national format, default country)
 *   "0092 300 1234567"     -> "923001234567" (00 international prefix)
 *   "+44 (0)20 7946 0958"  -> "442079460958" (optional trunk zero dropped)
 *   "+92 0300 1234567"     -> "923001234567" (trunk zero after default country code)
 *   "923001234567"         -> "923001234567" (already has a country code)
 *   "call me", "+1+2", "123" -> ""
 */
export function normalizePhone(value, defaultCountryCode = "92") {
  // "(0)" marks an optional trunk prefix in international notation.
  const input = String(value ?? "").trim().replace(/\(0\)/g, "");
  if (!input) return "";

  // Only digits, spaces, dots, dashes, parentheses and one leading "+".
  // This rejects letters, extensions ("x12") and stray "+" signs.
  if (!ALLOWED_CHARACTERS.test(input)) return "";

  const countryCode = String(defaultCountryCode).replace(/\D/g, "");
  let digits = input.replace(/\D/g, "");

  if (input.startsWith("+")) {
    // International number: keep its digits.
  } else if (digits.startsWith("00")) {
    digits = digits.slice(2);
  } else if (digits.startsWith("0")) {
    digits = countryCode + digits.slice(1);
  }

  // Drop a trunk zero typed right after the default country code ("+92 0300...").
  if (countryCode && digits.startsWith(`${countryCode}0`)) {
    digits = countryCode + digits.slice(countryCode.length + 1);
  }

  // Country codes never start with 0, and E.164 numbers have at most 15 digits.
  if (digits.startsWith("0")) return "";
  if (digits.length < 8 || digits.length > 15) return "";
  return digits;
}

export function isValidPhone(value) {
  return normalizePhone(value) !== "";
}
