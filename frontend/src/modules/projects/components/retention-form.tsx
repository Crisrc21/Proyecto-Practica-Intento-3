import { useState, type FormEvent } from "react";
import type { Milestone, Project } from "../types";
import { amount, shortDate, todayISO } from "../data/project-calculations";
import { appliedRetentions, retentionForSave } from "../data/retention-settlement";
import { Editor, SaveFooter } from "./project-forms";

export function RetentionForm({ project, milestone, cutoff, onSave, onClose }: {
  project: Project; milestone: Milestone; cutoff: string;
  onSave: (m: Milestone, reason: string) => Promise<void>; onClose: () => void;
}) {
  const [draft, setDraft] = useState<Milestone>({ ...milestone, expectedReceiptDate: milestone.expectedReceiptDate === undefined ? milestone.cashDate : milestone.expectedReceiptDate });
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const applied = appliedRetentions(project, cutoff);
  const currentDate = project.simulation?.asOf || todayISO();
  const currentApplied = appliedRetentions(project, currentDate);
  const close = () => { if (!busy) onClose(); };
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      await onSave(retentionForSave(project, draft, todayISO()), "Ficha de retenciones actualizada");
      onClose();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudieron guardar las retenciones."); }
    finally { setBusy(false); }
  }
  return <Editor title="Gestionar retenciones" onClose={close}><form className="project-form" onSubmit={submit}>
    <h3 className="project-full">Datos retenciones</h3>
    <p className="project-note project-full">El cobro se completa cuando los pagos cubren el total de retenciones registrado y las facturas vinculadas están pagadas. Para montos en UF, la comparación con pagos en pesos usa la UF de proyección del proyecto; si falta, queda por verificar.</p>
    <label className="project-field project-full">Nombre<input required maxLength={200} value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} /></label>
    <label className="project-field">Retenciones aplicadas vigentes<input readOnly value={amount(currentApplied, project.currency)} /><span>Descuentos de los EDP presentados al {shortDate(currentDate)}. Este es el monto que se guarda.</span></label>
    {cutoff !== currentDate && <label className="project-field">Retenciones al corte consultado<input readOnly value={amount(applied, project.currency)} /><span>Al {shortDate(cutoff)}. Solo consulta; este monto no reemplaza el vigente al guardar.</span></label>}
    <label className="project-field">Fecha esperada de recepción<input type="date" required value={draft.expectedReceiptDate ?? ""} onChange={e => setDraft(d => ({ ...d, expectedReceiptDate: e.target.value || null }))} /><span>Informativa. No modifica las fechas de las facturas ni la programación de cobros.</span></label>
    <label className="project-field project-full">Observaciones<textarea rows={3} maxLength={4000} value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} /></label>
    <p className="project-note project-full">Al guardar, la liberación de retenciones aparece al final de Estados de pago, adicional a los EDP de avance. Allí puedes vincular sus facturas y consultar los cobros.</p>
    <SaveFooter busy={busy} error={error} onClose={close} label="Guardar retenciones" />
  </form></Editor>;
}
