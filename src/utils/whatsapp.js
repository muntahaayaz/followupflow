import { normalizePhone } from "./phone";

/**
 * Builds a click-to-chat link, or returns "" when the phone number is invalid.
 * The message is always URL-encoded so line breaks, "&" and "#" survive.
 */
export function buildWhatsAppUrl(phone, message = "") {
  const digits = normalizePhone(phone);
  if (!digits) return "";
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/** The notice shown when a lead's phone cannot be used for WhatsApp. */
export function getWhatsAppPhoneError(
  rawPhone,
  emptyMessage = "Add a phone number first."
) {
  return String(rawPhone ?? "").trim()
    ? "Enter a valid phone number with 8-15 digits."
    : emptyMessage;
}
