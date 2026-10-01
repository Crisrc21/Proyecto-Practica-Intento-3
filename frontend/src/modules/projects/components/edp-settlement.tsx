import { AmountInput } from "./amount-input";
import { useEffect } from "react";
import type { Milestone, Currency } from "../types";
import { amount } from "../data/project-calculations";
import { fixedEdpDeductions, settlementTotals } from "../data/edp-settlement";

export function EdpSettlementFields({ milestone, currency, onChange }: { milestone: Milestone; currency: Currency; onChange: (patch: Partial<Milestone>) => void }) {
  const fields = [["gross", "Total neto del avance"], ["advanceRecovery", "Devolución anticipo"], ["retention", "Devolución retenciones"]] as const;
  const s = milestone.settlement;
  const totals = s ? settlementTotals(s) : null;
  useEffect(() => {
    if (!s?.taxMode) return;
    const settlement = fixedEdpDeductions(s);
    const cashAmount = settlementTotals(settlement).total;
    if (s.advanceRecovery !== settlement.advanceRecovery || s.retention !== settlement.retention || milestone.cashAmount !== cashAmount) onChange({ settlement, cashAmount });
  }, [s, milestone.cashAmount, onChange]);
  function update(key: typeof fields[number][0], value: number) {
    const changed = { ...s!, [key]: value };
    const settlement = changed.taxMode ? fixedEdpDeductions(changed) : changed;
    onChange({ settlement, cashAmount: settlementTotals(settlement).total });
  }
  function activate() {
    const settlement = fixedEdpDeductions({ ...(s || { gross: milestone.cashAmount ?? 0, advanceRecovery: 0, retention: 0 }), taxMode: "iva19-ceec309" });
    onChange({ settlement, cashAmount: settlementTotals(settlement).total });
  }
  return <>
    {!s && <button type="button" className="project-button project-full" onClick={activate}>Completar montos del estado de pago</button>}
    {s && totals && <>
      {!s.taxMode && <p className="project-note project-full">Este registro conserva su cálculo anterior. <button type="button" className="project-text-link" onClick={activate}>Aplicar IVA 19% y descuento CEEC 3,09%</button></p>}
      {fields.map(([key, label]) => {
        const flag = key === "advanceRecovery" ? "applyAdvanceRecovery" : "applyRetention";
        const optional = Boolean(s.taxMode && key !== "gross");
        const enabled = s[flag] !== false;
        return <div key={key} className="project-full">
          {optional && <label className="project-check" style={{ marginBottom: 8 }}><input type="checkbox" checked={enabled} onChange={e => {
            const settlement = fixedEdpDeductions({ ...s, [flag]: e.target.checked });
            onChange({ settlement, cashAmount: settlementTotals(settlement).total });
          }} />Aplicar {label.toLocaleLowerCase("es")}</label>}
          <label className="project-field">{label}{optional ? key === "advanceRecovery" ? " (20%)" : " (5%)" : ""} ({currency})<AmountInput required disabled={optional} value={s[key]} onChange={value => update(key, value ?? 0)} />{optional && !enabled && <span>No se descuenta en este EDP.</span>}</label>
        </div>;
      })}
      {Boolean(s.discounts || s.penalties || s.adjustments) && <p className="project-note project-full">Otros ajustes conservados del documento: descuentos {amount(s.discounts || 0, currency)}, multas {amount(s.penalties || 0, currency)}, ajustes {amount(s.adjustments || 0, currency)}.</p>}
      <div className="project-full project-edp-settlement" aria-live="polite">
        <strong>Total neto a facturar: {amount(totals.net, currency)}</strong>
        {s.taxMode && <><span>+ IVA (19%): {amount(totals.iva, currency)}</span><span>− CEEC (3,09%): {amount(totals.ceec, currency)}</span><strong>Total bruto a facturar: {amount(totals.total, currency)}</strong></>}
      </div>
      <p className="project-note project-full">Solo las devoluciones seleccionadas se descuentan del avance. IVA y CEEC se calculan sobre el total neto a facturar; el CEEC se resta. Los montos se redondean sin decimales.</p>
      {totals.net < 0 && <p role="alert" className="project-error project-full">Las devoluciones no pueden superar el avance.</p>}
    </>}
  </>;
}
