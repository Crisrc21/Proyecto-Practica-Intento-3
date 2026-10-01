import { CalendarClock, Pencil } from "lucide-react";
import type { Project, Milestone } from "../types";
import { milestoneStatus, shortDate, statusTone } from "../data/project-calculations";
import { sortMilestones } from "../data/project-workflow";

const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
export function MilestoneBadge({ milestone, cutoff }: { milestone: Milestone; cutoff: string }) {
  const status = milestoneStatus(milestone, cutoff);
  return <span className={`project-badge ${statusTone(status)}`}>{status}</span>;
}
function TimelineScale({ year, children, cutoff }: { year: number; children?: React.ReactNode; cutoff: string }) {
  return <div className="project-axis"><div className="project-months">{months.map(m => <span key={m}>{m}</span>)}</div>{cutoff.startsWith(String(year)) && <span className="project-cutoff" style={{ left: `${position(cutoff, year)}%` }} aria-hidden="true" />}{children}</div>;
}
function position(date: string, year: number) {
  const value = new Date(`${date}T00:00:00Z`);
  if(value.getUTCFullYear() < year) return 0;
  if(value.getUTCFullYear() > year) return 100;
  const month = value.getUTCMonth();
  const count = new Date(Date.UTC(year,month+1,0)).getUTCDate();
  return (month+(value.getUTCDate()-1)/count)/12*100;
}
function Mark({ date, year, kind, label }: { date: string | null; year: number; kind: string; label: string }) {
  return date?.startsWith(String(year)) ? <span title={`${label}: ${shortDate(date)}`} className={`project-mark ${kind}`} style={{ left: `${position(date, year)}%` }} /> : null;
}
export function ProjectTimeline({ projects, selected, year, cutoff, onOpen, onEdit }: { projects: Project[]; selected?: Project; year: number; cutoff: string; onOpen: (p: Project) => void; onEdit: (m: Milestone) => void }) {
  const milestones = selected?.milestones.filter(m => [m.baselineDate, m.forecastDate, m.actualDate && m.actualDate <= cutoff ? m.actualDate : null].some(d => d?.startsWith(String(year))) || (!m.baselineDate && !m.forecastDate && !m.actualDate))
    .sort(sortMilestones);
  return <section className="project-panel">
    <div className="project-panel-heading"><div><h2>{selected ? "Hitos del contrato" : "Líneas de tiempo por proyecto"}</h2><p>Compara la base, la programación vigente y el cumplimiento acreditado.</p></div><CalendarClock size={20} aria-hidden="true" /></div>
    <div className="project-legend"><span><i className="base" />Fecha base confirmada</span><span><i className="forecast" />Previsión / propuesta</span><span><i className="actual" />Cumplimiento efectivo</span><span><i className="cut" />Fecha de corte</span></div>
    <div className="project-timeline-scroll"><div className="project-timeline-grid">
      <div className="project-timeline-head"><div>{selected ? "Hito y estado" : "Proyecto y plazo contractual"}</div><TimelineScale year={year} cutoff={cutoff} /></div>
      {selected ? milestones?.map(m => <div className="project-timeline-row" key={m.id}>
        <button type="button" className="project-timeline-name" onClick={() => onEdit(m)}><strong>{m.name}<Pencil size={12} /></strong><MilestoneBadge milestone={m} cutoff={cutoff} /><small>Base: {shortDate(m.baselineDate)}<br />Prevista: {shortDate(m.forecastDate)}{m.actualDate && m.actualDate <= cutoff && <><br />Efectiva: {shortDate(m.actualDate)}</>}</small></button>
        <div className="project-track" aria-label={`${m.name}. Base ${shortDate(m.baselineDate)}. Prevista ${shortDate(m.forecastDate)}.`}>
          {cutoff.startsWith(String(year)) && <span className="project-cutoff" style={{ left: `${position(cutoff, year)}%` }} />}
          {m.startDate && m.forecastDate && <span className={`project-duration ${m.baselineApproved ? "" : "proposed"}`} style={{ left: `${position(m.startDate, year)}%`, width: `${Math.max(0, position(m.forecastDate, year)-position(m.startDate, year))}%` }} />}
          <Mark date={m.baselineApproved ? m.baselineDate : null} year={year} kind="base" label="Base" />
          <Mark date={m.forecastDate} year={year} kind="forecast" label="Prevista" />
          <Mark date={m.actualDate && m.actualDate <= cutoff ? m.actualDate : null} year={year} kind="actual" label="Efectiva" />
          {!m.forecastDate && !m.baselineDate && <span className="project-unscheduled">Pendiente de programar</span>}
        </div>
      </div>) : projects.map(project => <div className="project-timeline-row" key={project.id}>
        <button type="button" className="project-timeline-name" onClick={() => onOpen(project)}><strong>{project.name}</strong><small>{project.units} viviendas<br />{shortDate(project.startDate)} — {shortDate(project.endDate)}</small><span className="project-text-link">Ver sus hitos</span></button>
        <div className="project-track" aria-label={`Plazo de ${project.name}: ${shortDate(project.startDate)} a ${shortDate(project.endDate)}`}>
          {project.startDate && project.endDate && <span className="project-contract-range" style={{ left: `${position(project.startDate, year)}%`, width: `${Math.max(0, position(project.endDate, year)-position(project.startDate, year))}%` }} />}
          {cutoff.startsWith(String(year)) && <span className="project-cutoff" style={{ left: `${position(cutoff, year)}%` }} />}
          {project.milestones.map(m => <span key={m.id}><Mark date={m.baselineApproved ? m.baselineDate : null} year={year} kind="base" label={m.name} /><Mark date={m.forecastDate} year={year} kind="forecast" label={m.name} /><Mark date={m.actualDate && m.actualDate <= cutoff ? m.actualDate : null} year={year} kind="actual" label={m.name} /></span>)}
        </div>
      </div>)}
      {selected && !milestones?.length && <p className="project-empty">No hay hitos fechados en {year}. Cambia el año o agrega un hito.</p>}
      {!selected && !projects.length && <p className="project-empty">Agrega un proyecto para comenzar su planificación.</p>}
    </div></div>
    <p className="project-footnote">Selecciona un {selected ? "hito para registrar evidencia o reprogramarlo" : "proyecto para abrir su detalle"}. Las propuestas no forman parte del porcentaje de cumplimiento.</p>
  </section>;
}
