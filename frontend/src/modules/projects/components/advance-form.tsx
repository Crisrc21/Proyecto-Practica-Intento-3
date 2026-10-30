import { useState, type FormEvent } from "react";
import type { Milestone, Project } from "../types";
import { amount, shortDate } from "../data/project-calculations";
import { advanceReturns } from "../data/advance-settlement";
import { AmountInput } from "./amount-input";
import { Editor, SaveFooter } from "./project-forms";

export function AdvanceForm({ project, milestone, cutoff, onSave, onClose }: {
  project: Project; milestone: Milestone; cutoff: string;
  onSave: (m: Milestone, reason: string) => Promise<void>; onClose: () => void;
}) {
  const [draft, setDraft] = useState<Milestone>({ ...milestone, expectedReceiptDate: milestone.expectedReceiptDate === undefined ? milestone.cashDate : milestone.expectedReceiptDate });
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const totals = advanceReturns(project, draft, cutoff);
  const close = () => { if (!busy) onClose(); };
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (draft.cashAmount === null || !Number.isFinite(draft.cashAmount) || draft.cashAmount < 0) { setError("Indica un monto de anticipo pactado válido."); return; }
    setBusy(true); setError("");
    try {
      // The agreed advance is a standalone amount, not an EDP net of deductions.
      await onSave({ ...draft, type: "Anticipo", scope: "General", settlement: undefined }, "Ficha de anticipo actualizada");
      onClose();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar el anticipo."); }
    finally { setBusy(false); }
  }
  return <Editor title="Gestionar anticipo" onClose={close}><form className="project-form" onSubmit={submit}>
    <h3 className="project-full">Datos anticipo</h3>
    <label className="project-field project-full">Nombre<input required maxLength={200} value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} /></label>
    <label className="project-field">Monto anticipo pactado ({project.currency})<AmountInput required value={draft.cashAmount} onChange={cashAmount => setDraft(d => ({ ...d, cashAmount }))} /></label>
    <label className="project-field">Fecha esperada de recepción<input type="date" value={draft.expectedReceiptDate ?? ""} onChange={e => setDraft(d => ({ ...d, expectedReceiptDate: e.target.value || null }))} /><span>Informativa. No modifica las fechas de las facturas ni la programación de cobros.</span></label>
    <label className="project-field project-full">Observaciones<textarea rows={3} maxLength={4000} value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} /></label>
    <h3 className="project-full">Devolución</h3>
    <p className="project-note project-full">El anticipo se considera cobrado cuando los pagos de las facturas vinculadas cubren el monto pactado y esas facturas están pagadas. Para contratos en UF, la comparación con pagos en pesos utiliza la UF de proyección configurada en la ficha del proyecto.</p>
    <div className="project-full project-edp-settlement" aria-live="polite"><strong>Devolución aplicada: {amount(totals.applied, project.currency)}</strong><strong>Saldo pendiente de devolver: {amount(totals.balance === null ? null : Math.max(0, totals.balance), project.currency)}</strong></div>
    <p className="project-note project-full">Descuentos por devolución de anticipo de los EDP presentados al {shortDate(cutoff)}. El saldo compara el monto pactado con lo devuelto al mandante.</p>
    {totals.multiple && <p className="project-note project-full">El proyecto tiene varios anticipos. La devolución y el saldo corresponden al total del proyecto: monto pactado {amount(totals.agreed, project.currency)}.</p>}
    {totals.balance !== null && totals.balance < 0 && <p role="alert" className="project-error project-full">La devolución supera el monto pactado en {amount(-totals.balance, project.currency)}.</p>}
    <SaveFooter busy={busy} error={error} onClose={close} label="Guardar anticipo" />
  </form></Editor>;
}
