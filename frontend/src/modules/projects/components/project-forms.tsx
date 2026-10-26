import { AmountInput } from "./amount-input";
import { useEffect, useRef, useState, type ReactNode, type FormEvent } from "react";
import { X } from "lucide-react";
import { milestoneTypes, projectScopes, type Project, type Milestone } from "../types";
import { shortDate, todayISO } from "../data/project-calculations";
import { additionalWorks, natures } from "../data/project-workflow";

export function Editor({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} className="project-dialog" aria-label={title} onCancel={onClose}>
    <div className="project-dialog-heading"><h2>{title}</h2><button type="button" className="project-icon-button" aria-label="Cerrar formulario" onClick={onClose}><X size={19} /></button></div>
    {children}
  </dialog>;
}
export function SaveFooter({ busy, error, onClose, label = "Guardar cambios" }: { busy: boolean; error: string; onClose: () => void; label?: string }) {
  return <>
    {error && <p className="project-error project-full" role="alert">{error}</p>}
    <div className="project-form-actions project-full"><button type="button" className="project-button" onClick={onClose} disabled={busy}>Cancelar</button><button className="project-button primary" disabled={busy}>{busy ? "Guardando…" : label}</button></div></>;
}
function scopeForEditor(m: Milestone): Milestone["scope"] {
  if (projectScopes.some(scope => scope === m.scope)) return m.scope;
  const stages: Partial<Record<NonNullable<Milestone["stageKey"]>, Milestone["scope"]>> = { fabricacion: "Fabricación", despachos: "Despacho", fundaciones: "Fundaciones", montaje: "Montaje", interior: "Urbanización Interior", exterior: "Urbanización Exterior" };
  const previous: Partial<Record<Milestone["scope"], Milestone["scope"]>> = { Viviendas: "Fabricación", "Obra civil": "Fundaciones", "Urba interior": "Urbanización Interior", "Urba exterior": "Urbanización Exterior" };
  return (m.stageKey && stages[m.stageKey]) || previous[m.scope] || m.scope;
}
export function ProjectForm({ project, onSave, onClose }: { project: Project; onSave: (p: Project, reason: string) => Promise<void>; onClose: () => void }) {
  const [draft, setDraft] = useState(project);
  const reason = project.revision ? "Ficha del proyecto actualizada" : "Alta del proyecto";
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const update = <K extends keyof Project>(key: K, value: Project[K]) => setDraft(p => ({ ...p, [key]: value }));
  async function submit(e: FormEvent) { e.preventDefault(); setBusy(true); setError(""); try { await onSave(draft, reason); onClose(); } catch (err) { setError(err instanceof Error ? err.message : "No se pudo guardar."); } finally { setBusy(false); } }
  return <Editor title={project.revision ? "Editar ficha del proyecto" : "Nuevo contrato potencial"} onClose={onClose}><form className="project-form" onSubmit={submit}>
    <p className="project-note project-full">{draft.lifecycle === "Potencial" ? "Este contrato permanecerá en Potenciales hasta pulsar «Contrato firmado». Sus importes no se suman a la proyección de cobros." : "Contrato firmado · registra la información contractual y los alcances del proyecto."}</p>
    <label className="project-field project-full">Nombre del proyecto<input required maxLength={180} value={draft.name} onChange={e => update("name", e.target.value)} /></label>
    <label className="project-field">Cliente / mandante<input required maxLength={200} value={draft.customer} onChange={e => update("customer", e.target.value)} /></label>
    <label className="project-field">RUT del cliente<input value={draft.customerRut} onChange={e => update("customerRut", e.target.value)} placeholder="Para sugerir facturas del cliente" /></label>
    <label className="project-field">Ubicación<input value={draft.location} onChange={e => update("location", e.target.value)} /></label>
    <label className="project-field">Responsable CDG<input value={draft.owner} onChange={e => update("owner", e.target.value)} /></label>
    <label className="project-field">Cantidad de viviendas<input type="number" min="0" step="1" required value={draft.units} onChange={e => update("units", Number(e.target.value))} /></label>
    <label className="project-field">Superficie total contratada (m²)<input type="number" min="0" step="any" value={draft.areaM2 ?? ""} onChange={e => update("areaM2", e.target.value === "" ? null : Number(e.target.value))} /></label>
    <label className="project-field project-full">Tipo de contrato<select value={draft.nature ?? ""} required={draft.lifecycle !== "Potencial"} onChange={e => setDraft(p => ({ ...p, nature: e.target.value as Project["nature"] || null, includedWorks: e.target.value === "llave_en_mano" ? p.includedWorks || [] : [] }))}><option value="">Selecciona el tipo de contrato</option>{natures.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}</select><span>{draft.nature === "fabricacion_montaje" ? "El contrato contempla fabricación, transporte/coordinación y montaje." : "Describe cómo se conforma el proyecto según el contrato."}</span></label>
    {draft.nature === "llave_en_mano" && <fieldset className="project-full"><legend>Alcances adicionales incluidos</legend><div className="project-checks">{additionalWorks.map(w => <label key={w.key}><input type="checkbox" checked={draft.includedWorks?.includes(w.key) || false} onChange={e => update("includedWorks", e.target.checked ? [...(draft.includedWorks || []), w.key] : (draft.includedWorks || []).filter(key => key !== w.key))} />{w.label}</label>)}</div><p className="project-footnote">Selecciona las obras incluidas en el contrato. Detalla las otras obras y responsabilidades en las observaciones.</p></fieldset>}
    <label className="project-field">Moneda contractual<select value={draft.currency} onChange={e => update("currency", e.target.value as Project["currency"])}><option>UF</option><option>CLP</option></select></label>
    <label className="project-field">Monto contractual, IVA incluido<AmountInput value={draft.contractAmount} onChange={value => update("contractAmount", value)} /></label>
    <label className="project-field">Fecha de firma<input type="date" max={todayISO()} value={draft.signedDate ?? ""} onChange={e => update("signedDate", e.target.value || null)} /><span>Si queda vacía, «Contrato firmado» registrará la fecha del día.</span></label>
    <label className="project-field">Inicio de referencia<input type="date" value={draft.startDate ?? ""} onChange={e => update("startDate", e.target.value || null)} /></label>
    <label className="project-field">Término contractual<input type="date" value={draft.endDate ?? ""} onChange={e => update("endDate", e.target.value || null)} /></label>
    <label className="project-field">UF supuesta para proyección en pesos<input type="number" min="0.01" step="any" value={draft.ufValue ?? ""} onChange={e => update("ufValue", e.target.value === "" ? null : Number(e.target.value))} /><span>Supuesto de CDG. Los cobros reales mantienen su valor en pesos.</span></label>
    {!draft.nature && <fieldset className="project-full"><legend>Alcances registrados previamente</legend><div className="project-checks">{projectScopes.map(scope => <label key={scope}><input type="checkbox" checked={draft.scopes.includes(scope)} onChange={e => update("scopes", e.target.checked ? [...draft.scopes, scope] : draft.scopes.filter(s => s !== scope))} />{scope}</label>)}</div></fieldset>}
    <label className="project-field project-full">Carpeta de EDP aprobados<input type="url" value={draft.approvedFolder} onChange={e => update("approvedFolder", e.target.value)} placeholder="https://…sharepoint.com/…" /><span>Guarda el acceso a la carpeta. La detección y el correo automáticos aún requieren conectar Microsoft 365.</span></label>
    <label className="project-field project-full">Condiciones y eventos que habilitan el pago<textarea rows={3} value={draft.paymentTerms} onChange={e => update("paymentTerms", e.target.value)} /></label>
    <label className="project-field project-full">Observaciones / datos pendientes<textarea rows={3} value={draft.notes} onChange={e => update("notes", e.target.value)} /></label>
    <SaveFooter {...{ busy, error, onClose }} />
  </form></Editor>;
}
export function MilestoneForm({ milestone, currency, onSave, onClose }: { milestone: Milestone; currency: string; onSave: (m: Milestone, reason: string) => Promise<void>; onClose: () => void }) {
  const [draft, setDraft] = useState<Milestone>(() => ({ ...milestone, scope: milestone.type === "Anticipo" ? "General" : scopeForEditor(milestone) }));
  const reason = milestone.name ? "Hito actualizado" : "Hito agregado";
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const update = <K extends keyof Milestone>(key: K, value: Milestone[K]) => setDraft(m => ({ ...m, [key]: value }));
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    if (!["Contrato", "Anticipo", "Retenciones"].includes(draft.type) && !projectScopes.some(s => s === draft.scope)) { setError("Selecciona un alcance para este hito."); setBusy(false); return; }
    const next = !milestone.baselineApproved ? { ...draft, baselineDate: draft.forecastDate, baselineCashDate: draft.cashDate, baselineCashAmount: draft.cashAmount } : draft;
    try { await onSave(next, reason); onClose(); } catch (err) { setError(err instanceof Error ? err.message : "No se pudo guardar."); } finally { setBusy(false); }
  }
  return <Editor title={milestone.name ? "Actualizar hito" : "Agregar hito"} onClose={onClose}><form className="project-form" onSubmit={submit}>
    <label className="project-field project-full">Nombre del hito<input value={draft.name} required maxLength={200} onChange={e => update("name", e.target.value)} /></label>
    <label className="project-field">Tipo<select disabled={Boolean(draft.stageKey) || ["Contrato", "Anticipo", "Retenciones"].includes(draft.type)} value={draft.type} onChange={e => update("type", e.target.value as Milestone["type"])}>{milestoneTypes.filter(t => t !== "Etapa" || draft.stageKey).map(t => <option key={t}>{t}</option>)}</select></label>
    <label className="project-field">Alcance<select required={!(["Contrato", "Anticipo", "Retenciones"].includes(draft.type))} value={draft.scope === "General" || projectScopes.some(s => s === draft.scope) ? draft.scope : ""} onChange={e => update("scope", e.target.value as Milestone["scope"])}>{draft.type !== "Anticipo" && <option value="" disabled hidden>Selecciona un alcance</option>}{["Contrato", "Anticipo", "Retenciones"].includes(draft.type) && <option value="General">Contrato completo</option>}{draft.type !== "Anticipo" && projectScopes.map(s => <option key={s}>{s}</option>)}</select></label>
    <label className="project-field">Inicio de referencia<input type="date" value={draft.startDate ?? ""} onChange={e => update("startDate", e.target.value || null)} /></label>
    <label className="project-field">Fecha prevista / compromiso vigente<input type="date" value={draft.forecastDate ?? ""} onChange={e => update("forecastDate", e.target.value || null)} /></label>
    <div className="project-note project-full">Base {milestone.baselineApproved ? "confirmada" : "propuesta"}: {shortDate(milestone.baselineDate)}. {milestone.baselineApproved ? "La base se conserva al reprogramar." : "Al confirmar, las fechas e importes previstos quedarán como referencia del cumplimiento."}</div>
    {!milestone.baselineApproved && <label className="project-check project-full"><input type="checkbox" checked={draft.baselineApproved} onChange={e => update("baselineApproved", e.target.checked)} />Confirmar este hito y conservar su plan base</label>}
    {!draft.stageKey && <><label className="project-field">Estado de seguimiento<select value={draft.state} onChange={e => update("state", e.target.value as Milestone["state"])}><option>Pendiente</option><option>En curso</option><option>Observado</option></select></label>
    <label className="project-field">{draft.type === "Retenciones" ? "Fecha de liberación de retenciones" : draft.type === "Anticipo" ? "Fecha de aprobación documental" : "Fecha efectiva de cumplimiento"}<input type="date" max={todayISO()} value={draft.actualDate ?? ""} onChange={e => update("actualDate", e.target.value || null)} /><span>Anticipo y retenciones se consideran cobrados únicamente con pagos vinculados en CxC.</span></label>
    <label className="project-field project-full">Evidencia del cumplimiento<input value={draft.evidence} required={Boolean(draft.actualDate)} onChange={e => update("evidence", e.target.value)} placeholder="Enlace o referencia al EDP aprobado, acta o contrato" /></label></>}
    {draft.stageKey && <p className="project-note project-full">El anticipo se consulta desde los pagos de CxC. Aquí puedes programar las fechas del compromiso contractual.</p>}
    {["Anticipo", "EDP", "Retenciones"].includes(draft.type) && <>
      <label className="project-field">Monto previsto a cobrar ({currency})<AmountInput value={draft.cashAmount} onChange={value => update("cashAmount", value)} /><span>Después de anticipos, retenciones e impuestos aplicables.</span></label>
      <label className="project-field">Fecha esperada de cobro<input type="date" value={draft.cashDate ?? ""} onChange={e => update("cashDate", e.target.value || null)} /><span>Esta fecha no registra un pago real.</span></label>
      <label className="project-check project-full"><input type="checkbox" checked={draft.invoicingComplete === true} onChange={e => update("invoicingComplete", e.target.checked)} />Las facturas vinculadas cubren todo este hito</label>
      <p className="project-note project-full">Mientras la facturación sea parcial, se conserva la proyección del monto total del hito menos lo ya cobrado. Cuando esté completa, se utiliza el saldo de las facturas vinculadas.</p>
    </>}
    <label className="project-field project-full">Regla o fuente del hito<input value={draft.source} onChange={e => update("source", e.target.value)} /></label>
    <label className="project-field project-full">Observaciones y dependencias<textarea rows={3} value={draft.notes} onChange={e => update("notes", e.target.value)} placeholder="Ej.: cobro sujeto al giro bancario, fecha por confirmar" /></label>
    <SaveFooter {...{ busy, error, onClose }} />
  </form></Editor>;
}
