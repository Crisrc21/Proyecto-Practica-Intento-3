import { AmountInput } from "./amount-input";
import { useState } from "react";
import { ArrowUpRight, Building2, CheckCircle2, CircleDashed, MapPin, Trash2 } from "lucide-react";
import type { Project } from "../types";
export { ProjectForm as ProjectProfile } from "./project-profile";
import { amount } from "../data/project-calculations";
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
        <div className="project-directory-actions"><button type="button" className="project-button" onClick={() => onSelect(p)}>Ficha del proyecto</button><button type="button" className="project-button primary" onClick={() => onOpenTracking(p)}>{signed ? "Abrir seguimiento" : "Completar contrato"} <ArrowUpRight size={15} aria-hidden="true" /></button></div>
      </article>;
    })}</div>{!visible.length && <div className="project-empty"><Building2 size={28} /><h2>No hay proyectos para mostrar</h2><p>Agrega un proyecto o ajusta la búsqueda y los filtros.</p>{filter!=="all"&&<button className="project-button" onClick={()=>setFilter("all")}>Ver todos</button>}</div>}</section>;
}
