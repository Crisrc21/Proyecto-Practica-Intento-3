import { AmountInput } from "./amount-input";
import { useState, type FormEvent } from "react";
import { ArrowUpRight, Building2, CheckCircle2, CircleDashed, MapPin, Trash2 } from "lucide-react";
import type { Project } from "../types";
import { Editor } from "./project-forms";
import { todayISO, amount } from "../data/project-calculations";
import "../project-directory.css";

export function ProjectDirectory({ projects, onSelect, onOpenTracking, onDelete }: { projects: Project[]; onSelect: (p: Project) => void; onOpenTracking: (p: Project) => void; onDelete: (p: Project) => void }) {
  const [filter, setFilter] = useState<"all" | "signed" | "unsigned">("all");
  const visible = projects.filter(p => filter === "all" || (filter === "signed" ? p.lifecycle !== "Potencial" : p.lifecycle === "Potencial"));
  return <section className="project-directory"><div className="project-directory-heading"><div><h2>Proyectos</h2><p>Datos del contrato y acceso al seguimiento financiero.</p></div><div className="project-directory-filters" role="group" aria-label="Filtrar proyectos por firma">{([['all','Todos'],['signed','Firmados'],['unsigned','Sin firmar']] as const).map(([key,label])=><button key={key} type="button" aria-pressed={filter===key} onClick={()=>setFilter(key)}>{label}<span>{projects.filter(p=>key==='all'||(key==='signed'?p.lifecycle!=='Potencial':p.lifecycle==='Potencial')).length}</span></button>)}</div></div>
    <div className="project-directory-grid">{visible.map(p => {
      const signed = p.lifecycle !== "Potencial";
      const Icon = signed ? CheckCircle2 : CircleDashed;
      return <article className={`project-directory-card ${signed ? "is-signed" : "is-unsigned"}`} key={p.id}>
        <div className="project-directory-card-header"><span className="project-directory-icon"><Building2 size={21} aria-hidden="true" /></span><span className="project-signature-badge"><Icon size={14} aria-hidden="true" />{signed ? "Firmado" : "Sin firmar"}</span><button type="button" className="project-directory-delete" title="Eliminar proyecto" onClick={() => onDelete(p)} aria-label={`Eliminar proyecto ${p.name}`}><Trash2 size={16} /></button></div>
        <button type="button" className="project-directory-main" onClick={() => onSelect(p)} aria-label={`Ver datos de ${p.name}`}>
          <span className="project-directory-name">{p.name}</span><span className="project-directory-customer">({p.customer || "Mandante por definir"})</span>
        </button>
        <div className="project-directory-location"><MapPin size={14} aria-hidden="true" /><span>{p.location || "Ubicación por definir"}</span></div>
        <dl className="project-directory-facts"><div><dt>Monto contratado</dt><dd>{signed ? amount(p.contractAmount == null ? null : Math.round(p.contractAmount),p.currency) : "Por definir"}</dd></div><div><dt>Viviendas</dt><dd>{signed ? p.units.toLocaleString("es-CL") : "—"}</dd></div></dl>
        <div className="project-directory-actions"><button type="button" className="project-button" onClick={() => onSelect(p)}>Ver datos del proyecto</button><button type="button" className="project-button primary" onClick={() => onOpenTracking(p)}>{signed ? "Abrir seguimiento" : "Completar contrato"} <ArrowUpRight size={15} aria-hidden="true" /></button></div>
      </article>;
    })}</div>{!visible.length && <div className="project-empty"><Building2 size={28} /><h2>No hay proyectos para mostrar</h2><p>Agrega un proyecto o ajusta la búsqueda y los filtros.</p>{filter!=="all"&&<button className="project-button" onClick={()=>setFilter("all")}>Ver todos</button>}</div>}</section>;
}

export function ProjectProfile({ project, onSave, onClose, onOpen }: { project: Project; onSave: (p: Project, reason: string) => Promise<void>; onClose: () => void; onOpen: () => void }) {
  const [draft, setDraft] = useState(project);
  const [area, setArea] = useState(project.units > 0 && project.areaM2 != null ? String(Number((project.areaM2 / project.units).toFixed(6))) : "");
  const [areaChanged, setAreaChanged] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const signed = draft.lifecycle !== "Potencial";
  const originalSigned = project.lifecycle !== "Potencial";
  const total = areaChanged ? area === "" ? null : Math.round(Number(area) * draft.units * 1000000) / 1000000 : draft.areaM2 ?? null;
  const update = <K extends keyof Project>(key: K, value: Project[K]) => setDraft(p => ({ ...p, [key]: value }));
  async function submit(event: FormEvent, open = false) {
    event.preventDefault();
    const form = event.currentTarget instanceof HTMLFormElement ? event.currentTarget : (event.currentTarget as HTMLButtonElement).form;
    if (form && !form.reportValidity()) return;
    setBusy(true); setError("");
    try {
      await onSave({ ...draft, areaM2: total }, !originalSigned && signed ? "Firma del contrato registrada desde la ficha del proyecto" : project.revision ? "Ficha general del proyecto actualizada" : "Proyecto agregado");
      onClose(); if (open) onOpen();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar el proyecto."); }
    finally { setBusy(false); }
  }
  return <Editor title={project.revision ? "Datos del proyecto" : "Agregar proyecto"} onClose={() => { if (!busy) onClose(); }}><form className="project-form project-profile-form" onSubmit={submit}>
    <div className={`project-profile-status project-full ${signed ? "is-signed" : "is-unsigned"}`}>{signed ? <CheckCircle2 size={20} /> : <CircleDashed size={20} />}<div><strong>{signed ? "Contrato firmado" : "Potencial contrato"}</strong><p>{signed ? "Proyecto incorporado al seguimiento contractual." : "Registra nombre y mandante. Los datos contractuales se habilitan al confirmar la firma."}</p></div></div>
    <label className="project-field project-full">Nombre del proyecto<input autoFocus required maxLength={180} value={draft.name} onChange={e => update("name", e.target.value)} /></label>
    <label className="project-field project-full">Mandante<input required maxLength={200} value={draft.customer} onChange={e => update("customer", e.target.value)} placeholder="Nombre del mandante" /></label>
    {!originalSigned && <label className="project-check project-full"><input type="checkbox" checked={signed} onChange={e => setDraft(p => ({ ...p, lifecycle: e.target.checked ? "Firmado" : "Potencial", signedDate: e.target.checked ? p.signedDate || todayISO() : null }))} />Contrato firmado · habilitar datos contractuales</label>}
    {signed && <>
    <label className="project-field">Cantidad de casas<input type="number" required min="0" step="1" value={draft.units} onChange={e => { update("units", Number(e.target.value)); setAreaChanged(true); }} /></label>
    <label className="project-field">{draft.currency === "UF" ? "Monto UF contratado" : "Monto contratado (CLP)"}<AmountInput value={draft.contractAmount} onChange={value => update("contractAmount", value)} />{draft.currency !== "UF" && <span>Contrato existente en pesos; conserva su moneda original.</span>}</label>
    <label className="project-field">m² por casa<input type="number" min="0" step="any" value={area} onChange={e => { setArea(e.target.value); setAreaChanged(true); }} /><span>Si las viviendas tienen distintas superficies, corresponde al promedio por casa.</span></label>
    <label className="project-field">Superficie total (m²)<input readOnly value={total == null ? "" : new Intl.NumberFormat("es-CL", { maximumFractionDigits: 6 }).format(total)} placeholder="Por definir" /><span>Cantidad de casas × m² por casa.</span></label>
    <label className="project-field project-full">Ubicación<input maxLength={250} value={draft.location} onChange={e => update("location", e.target.value)} /></label>
    <label className="project-field project-full">Tipo de contrato<select value={draft.nature ?? ""} onChange={e => setDraft(p => ({ ...p, nature: e.target.value as Project["nature"] || null, includedWorks: e.target.value === "llave_en_mano" ? p.includedWorks || [] : [] }))}><option value="">Por definir</option><option value="fabricacion_montaje">Fabricación y Montaje</option><option value="llave_en_mano">Completa</option></select></label>
    {signed && <label className="project-field project-full">Fecha de firma<input type="date" required max={project.simulation?.asOf || todayISO()} value={draft.signedDate || ""} onChange={e => update("signedDate", e.target.value || null)} /></label>}
    </>}
    {error && <p role="alert" className="project-error project-full">{error}</p>}
    <div className="project-form-actions project-full"><button type="button" className="project-button" disabled={busy} onClick={onClose}>Cerrar</button><button className="project-button primary" disabled={busy}>{busy ? "Guardando…" : "Guardar ficha"}</button>{signed && <button type="button" className="project-button" disabled={busy} onClick={e => submit(e, true)}>Guardar y abrir seguimiento<ArrowUpRight size={15} /></button>}</div>
  </form></Editor>;
}
