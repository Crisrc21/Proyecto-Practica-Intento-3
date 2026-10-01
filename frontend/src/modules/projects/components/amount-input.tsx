import { useState } from "react";
import { parseAmountInput } from "../data/amount-input";

export function AmountInput({ value, onChange, signed = false, required = false, disabled = false }: {
  value: number | null; onChange: (value: number | null) => void; signed?: boolean; required?: boolean; disabled?: boolean;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const format = (n: number | null) => n == null ? "" : n.toLocaleString("es-CL", { maximumFractionDigits: 0 });
  return <input type="text" inputMode="decimal" required={required} disabled={disabled}
    placeholder="Ej.: 1.234,56" title="Puntos para miles y coma para decimales. El monto se redondea sin decimales."
    value={editing ?? format(value)}
    onFocus={e => { setEditing(format(value)); e.currentTarget.select(); }}
    onChange={e => {
      const text = e.target.value;
      setEditing(text);
      const parsed = parseAmountInput(text, signed);
      e.currentTarget.setCustomValidity(text.trim() && parsed === null ? "Escribe un monto válido: 1.234,56 (puntos para miles y coma para decimales)." : "");
      if (!text.trim() || parsed !== null) onChange(parsed);
    }}
    onBlur={e => {
      if (e.currentTarget.validity.customError) return;
      setEditing(null);
    }} />;
}
