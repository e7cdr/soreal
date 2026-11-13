export function normalizePhoneForWhatsApp(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, "");
  if (!digits) return null;
  // Dominican Republic numbers use the +1 country code.
  return digits.startsWith("1") ? digits : `1${digits}`;
}

export function buildWhatsAppUrl(phone, text) {
  const normalized = normalizePhoneForWhatsApp(phone);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(text || "")}`;
}
