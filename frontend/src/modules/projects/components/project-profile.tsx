import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Project } from "../types";
import { todayISO } from "../data/project-calculations";
import { Editor, SaveFooter } from "./project-forms";

export function ProjectForm({ project, onSave, onClose, onOpen, initialSection }: {
  project: Project; onSave: (p: Project, reason: string) => Promise<void>;
  onClose: () => void; onOpen?: () => void; initialSection?: "conditions";
}) {
  const [draft, setDraft] = useState(project);
  const [retention, setRetention] = useState(String(project.edpConditions?.retentionPercent ?? 5));
  const [recovery, setRecovery] = useState(String(project.edpConditions?.recoveryPercent ?? 20));
  const [ceec, setCeec] = useState(String(project.edpConditions?.ceecPercent ?? 3.09));
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const conditionsRef = useRef<HTMLElement>(null);
  useEffect(() => { if (initialSection === "conditions") conditionsRef.current?.scrollIntoView({ block: "start" }); }, [initialSection]);
  const signed = draft.lifecycle !== "Potencial";
  const update = <K extends keyof Project>(key: K, value: Project[K]) => setDraft(p => ({ ...p, [key]: value }));
  const close = () => { if (!busy) onClose(); };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    const retentionPercent = Number(retention), recoveryPercent = Number(recovery), ceecPercent = Number(ceec);
    if ([retention, recovery, ceec].some(v => !v.trim()) || [retentionPercent, recoveryPercent, ceecPercent].some(n => !Number.isFinite(n) || n < 0 || n > 100)) {
      setError("Indica porcentajes entre 0 y 100."); return;
    }
    if (retentionPercent + recoveryPercent > 100) { setError("Las devoluciones de anticipo y retenciones no pueden superar juntas el 100%."); return; }
    if (draft.startDate && draft.endDate && draft.endDate < draft.startDate) { setError("La fecha de término no puede ser anterior al inicio del proyecto."); return; }
    const open = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "open";
    setBusy(true);
    try {
      await onSave({ ...draft, edpConditions: { ...draft.edpConditions, reference: draft.edpConditions?.reference ?? "", retentionPercent, recoveryPercent, ceecPercent } }, "Ficha del proyecto actualizada");
      onClose(); if (open) onOpen?.();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar la ficha."); }
    finally { setBusy(false); }
  }
  return <Editor title="Ficha del proyecto" onClose={close}><form className="project-form" onSubmit={submit}>
    <section className="project-full project-profile-section" aria-labelledby="profile-general">
      <h3 id="profile-general">Datos generales</h3>
      <div className="project-profile-fields">
        <label className="project-field project-full">Nombre proyecto<input required maxLength={180} value={draft.name} onChange={e => update("name", e.target.value)} /></label>
        <label className="project-field">Mandante<input required maxLength={200} value={draft.customer} onChange={e => update("customer", e.target.value)} /></label>
        <label className="project-field">RUT<input maxLength={30} value={draft.customerRut} onChange={e => update("customerRut", e.target.value)} /></label>
      </div>
    </section>
    <section className="project-full project-profile-section" aria-labelledby="profile-contract">
      <h3 id="profile-contract">Contrato</h3>
      <label className="project-check"><input type="checkbox" checked={signed} disabled={project.lifecycle !== "Potencial"} onChange={e => setDraft(p => ({ ...p, lifecycle: e.target.checked ? "Firmado" : "Potencial", signedDate: e.target.checked ? p.signedDate || project.simulation?.asOf || todayISO() : null }))} />Contrato firmado</label>
      {signed && <div className="project-profile-fields">
        <label className="project-field">Fecha de firma<input type="date" required max={project.simulation?.asOf || todayISO()} value={draft.signedDate ?? ""} onChange={e => update("signedDate", e.target.value || null)} /></label>
        <label className="project-field">Tipo de contrato<select required value={draft.nature ?? ""} onChange={e => setDraft(p => ({ ...p, nature: e.target.value as Project["nature"] || null, includedWorks: e.target.value === "llave_en_mano" ? p.includedWorks || [] : [] }))}><option value="">Selecciona el tipo de contrato</option><option value="llave_en_mano">Completo</option><option value="fabricacion_montaje">Fabricación y Montaje</option></select></label>
        <label className="project-field">Fecha inicio proyecto<input type="date" value={draft.startDate ?? ""} onChange={e => update("startDate", e.target.value || null)} /></label>
        <label className="project-field">Fecha término proyecto<input type="date" min={draft.startDate || undefined} value={draft.endDate ?? ""} onChange={e => update("endDate", e.target.value || null)} /></label>
      </div>}
    </section>
    <section ref={conditionsRef} className="project-full project-profile-section" aria-labelledby="profile-conditions">
      <h3 id="profile-conditions">Condiciones de pago y EDP</h3>
      <div className="project-profile-fields">
        <label className="project-field">Devolución retenciones (%)<input type="number" required min="0" max="100" step="any" value={retention} onChange={e => setRetention(e.target.value)} /></label>
        <label className="project-field">Devolución anticipo (%)<input type="number" required min="0" max="100" step="any" value={recovery} onChange={e => setRecovery(e.target.value)} /></label>
        <label className="project-field">Condiciones CEEC (%)<input type="number" required min="0" max="100" step="any" value={ceec} onChange={e => setCeec(e.target.value)} /></label>
        <label className="project-field">UF proyección<input type="number" min="0.01" step="any" value={draft.ufValue ?? ""} onChange={e => update("ufValue", e.target.value === "" ? null : Number(e.target.value))} /><span>Valor de la UF en pesos para la proyección.</span></label>
      </div>
      <p className="project-footnote">Los porcentajes se aplican a los nuevos EDP. Los EDP ya guardados conservan sus condiciones.</p>
    </section>
    <SaveFooter busy={busy} error={error} onClose={close} label="Guardar ficha" />
    {signed && onOpen && <button type="submit" value="open" disabled={busy} className="project-button project-full">Guardar y abrir seguimiento</button>}
  </form></Editor>;
}
