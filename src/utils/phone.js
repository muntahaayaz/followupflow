export function normalizePhone(value, defaultCountryCode = "92") {
  const input = String(value ?? "").trim();
  if (!input) return "";

  let digits = input.replace(/\D/g, "");

  if (input.startsWith("+")) {
    // International number: retain its digits.
  } else if (digits.startsWith("00")) {
    digits = digits.slice(2);
  } else if (digits.startsWith("0")) {
    digits = String(defaultCountryCode).replace(/\D/g, "") + digits.slice(1);
  }

  if (digits.length < 8 || digits.length > 15) return "";
  return digits;
}
