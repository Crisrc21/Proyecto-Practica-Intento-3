import { useState } from "react";
import { Settings2, ChevronDown, ChevronUp } from "lucide-react";
import type { Milestone, Project } from "../types";
import { amount, shortDate } from "../data/project-calculations";
import { metricLabels } from "../data/project-workflow";
import { physicalPlan } from "../data/edp-programming";
import { ProjectForm } from "./project-profile";
import "../contract-process.css";

type Save = (project: Project, reason: string) => Promise<void>;
export function EdpProgramming({ project, onSave }: { project: Project; onSave: Save }) {
  const [editing, setEditing] = useState(false);
  const [distributionOpen, setDistributionOpen] = useState(false);
  const edps = project.milestones.filter(m => m.type === "EDP");
  const retentionEdps = project.milestones.filter(m => m.type === "Retenciones");
  const distributionEdps = [...edps, ...retentionEdps];
  const declaredCount = edps.find(m => m.edpCount != null)?.edpCount;
  return <>
  <section className="project-panel">
    <div className="project-panel-heading"><div><span className="project-eyebrow">DOCUMENTO BASE DEL PROYECTO</span><h2>Datos generales del proyecto</h2><p>{project.edpConditions?.reference || "Configura los porcentajes que se aplicarán a los nuevos EDP del proyecto."}</p></div><button className="project-button primary" onClick={() => setEditing(true)}><Settings2 size={16} />Condiciones de pago y EDP</button></div>
    <div className="project-contract-facts"><Fact label="Proyecto" value={project.name} /><Fact label="Mandante" value={project.customer || "Sin dato"} /><Fact label="Tipo de contrato" value={project.nature === "llave_en_mano" ? "Construcción completa / llave en mano" : project.nature === "fabricacion_montaje" ? "Fabricación y montaje" : "Sin clasificar"} /><Fact label="RUT" value={project.customerRut || "Sin dato"} /><Fact label="Cantidad de EDP de avance" value={declaredCount?.toLocaleString("es-CL") || "Por definir en el primer EDP"} /><Fact label="Monto total contratado" value={amount(project.contractAmount, project.currency)} /></div>
    {editing && <ProjectForm initialSection="conditions" project={project} onSave={onSave} onClose={() => setEditing(false)} />}
  </section>
  {distributionEdps.length > 0 && <section className="project-panel project-edp-distribution-panel"><EdpDistribution project={project} edps={distributionEdps} open={distributionOpen} onToggle={() => setDistributionOpen(value => !value)} /></section>}
  </>;
}

function Fact({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><p>{value}</p></div>; }

function EdpDistribution({ project, edps, open, onToggle }: { project: Project; edps: Milestone[]; open: boolean; onToggle: () => void }) {
  const previous = new Map<string, number>();
  const rows = [...edps].sort((a, b) => (a.edp?.stageKey || "").localeCompare(b.edp?.stageKey || "") || (a.edp?.threshold || 0) - (b.edp?.threshold || 0)).map(m => {
    const e = m.edp;
    if (!e || e.documentOnly) return { m, period: null };
    const key = `${e.stageKey}/${e.metric}`, from = previous.get(key) || 0;
    previous.set(key, e.threshold);
    return { m, period: e.threshold - from };
  });
  return <div className="project-edp-distribution"><button type="button" className="project-distribution-toggle" aria-expanded={open} onClick={onToggle}><span><strong>Distribución del monto total en EDP</strong><small>{open ? "Ocultar detalle de partidas y montos" : "Mostrar detalle de partidas y montos"}</small></span>{open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button>{open && <div className="project-table-scroll"><table className="project-financial-table"><thead><tr><th>EDP</th><th>Partida / condición</th><th>Avance del periodo</th><th>Acumulado</th><th>Bruto</th><th>Recuperación anticipo</th><th>Neto</th><th>Estado</th></tr></thead><tbody>{rows.map(({ m, period }) => <tr key={m.id}><td><strong>{m.type === "Retenciones" ? "EDP de retenciones" : m.name}</strong><small>{shortDate(m.edp?.presentedDate || m.forecastDate || m.cashDate)}</small></td><td>{m.type === "Retenciones" ? "Liberación de retenciones" : m.scope}<small>{m.edp?.documentOnly ? "Programación financiera" : m.edp ? metricLabels[m.edp.metric] : m.type === "Retenciones" ? "Retenciones contractuales" : "Sin condición"}</small></td><td>{period === null ? "—" : period.toLocaleString("es-CL", { maximumFractionDigits: 2 })}</td><td>{m.edp && !m.edp.documentOnly ? m.edp.threshold.toLocaleString("es-CL", { maximumFractionDigits: 2 }) : "—"}</td><td>{amount(m.type === "Retenciones" ? m.cashAmount : m.settlement?.gross ?? null, project.currency)}</td><td>{amount(m.type === "Retenciones" ? null : m.settlement?.advanceRecovery ?? null, project.currency)}</td><td>{amount(m.cashAmount, project.currency)}</td><td><span className="project-badge neutral">{m.type === "Retenciones" ? "Retenciones" : m.edp?.status || "Sin condición"}</span></td></tr>)}</tbody></table></div>}</div>;
}

export function PlannedPhysicalProgress({ project }: { project: Project }) {
  const rows = physicalPlan(project);
  return <section className="project-panel"><div className="project-panel-heading"><div><span className="project-eyebrow">PROGRAMACIÓN FÍSICA</span><h2>Avance comprometido por EDP</h2><p>Cantidades del período y avance acumulado de cada partida. Las mediciones ejecutadas se registran debajo.</p></div></div>{rows.length ? <div className="project-table-scroll"><table className="project-financial-table"><thead><tr><th>EDP / partida</th><th>Medición</th><th>Avance del período</th><th>Acumulado requerido</th><th>% de la partida</th><th>Aprobación prevista</th></tr></thead><tbody>{rows.map(({ milestone: m, period, percent }) => <tr key={m.id}><td><strong>{m.name}</strong><small>{m.scope}</small></td><td>{metricLabels[m.edp!.metric]}</td><td>{period.toLocaleString("es-CL")}</td><td>{m.edp!.threshold.toLocaleString("es-CL")}</td><td>{percent === null ? "Por definir" : `${percent.toLocaleString("es-CL", { maximumFractionDigits: 2 })}%`}</td><td>{shortDate(m.forecastDate)}</td></tr>)}</tbody></table></div> : <p className="project-footnote">La programación del primer EDP alimentará esta sección. Puedes registrar el avance ejecutado cuando tengas su evidencia.</p>}</section>;
}

