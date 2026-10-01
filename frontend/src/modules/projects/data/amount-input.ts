export function parseAmountInput(text: string, signed = false): number | null {
  const pattern = signed ? /^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d*)?$/ : /^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d*)?$/;
  if (!pattern.test(text.trim())) return null;
  const value = Number(text.trim().replace(/\./g, "").replace(",", "."));
  const rounded = Math.sign(value) * Math.round(Math.abs(value));
  return Number.isSafeInteger(rounded) ? rounded : null;
}
