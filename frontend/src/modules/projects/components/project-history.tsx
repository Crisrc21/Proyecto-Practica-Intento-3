import { useState } from "react";
import { CalendarDays, Check, Clock3, TrendingUp } from "lucide-react";
import type { Project, StageKey } from "../types";
import { shortDate } from "../data/project-calculations";
import { progressSeries, stageReports } from "../data/project-history";
import { stages } from "../data/project-workflow";

const fmt = (n: number) => new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 }).format(n);
export interface HistoryEvent { id: string; date: string; title: string; detail: string; evidence?: string; href?: string; planned?: boolean }
export function HistoryLine({ events, empty = "Aún no hay movimientos registrados." }: { events: HistoryEvent[]; empty?: string }) {
  const [limit, setLimit] = useState(12);
  const sorted = [...events].reverse().sort((a, b) => b.date.localeCompare(a.date));
  if (!events.length) return <div className="project-history-empty"><Clock3 size={24} /><p>{empty}</p></div>;
  return <><ol className="project-event-line">{sorted.slice(0, limit).map(e => <li key={e.id} className={e.planned ? "is-planned" : ""}><span className="project-event-dot">{e.planned ? <CalendarDays size={13} /> : <Check size={13} />}</span><div className="project-event-body"><div><h4>{e.title}</h4><time dateTime={e.date}>{shortDate(e.date)}</time></div><p>{e.detail}</p>{e.evidence && <small>{e.evidence}</small>}{e.href && <a href={e.href}>Ver factura en CxC</a>}</div></li>)}</ol>{sorted.length > limit && <button className="project-button project-history-more" onClick={() => setLimit(v => v + 12)}>Ver más movimientos ({sorted.length - limit})</button>}</>;
}
export function ProgressHistory({ project, stage, cutoff }: { project: Project; stage: StageKey; cutoff: string }) {
  const [allStages, setAllStages] = useState(false);
  const reports = stageReports(project, allStages ? "all" : stage, cutoff);
  const events: HistoryEvent[] = reports.map(r => ({ id: r.id, date: r.date, title: r.period ? `Producción mensual · ${r.period}` : `${stages.find(s => s.key === r.stageKey)?.label} · corte de avance`, detail: [r.periodQuantity != null ? `${fmt(r.periodQuantity)} m² producidos en el mes` : "", r.quantity !== null ? `${fmt(r.quantity)} ${r.stageKey === "fabricacion" ? "m² fabricados" : "casas"}` : "", r.completedUnits !== null ? `${fmt(r.completedUnits)} casas terminadas` : "", r.percent !== null ? `${fmt(r.percent)}% de avance` : ""].filter(Boolean).join(" · "), evidence: r.evidence }));
  if ((allStages || stage === "firma") && project.signedDate && project.signedDate <= cutoff) events.push({ id: "contract-signature", date: project.signedDate, title: "Contrato firmado", detail: "Inicio del seguimiento contractual" });
  return <section className="project-panel"><div className="project-panel-heading"><div><h3>Historia de avances</h3><p>Últimos movimientos primero · hasta {shortDate(cutoff)}</p></div><label className="project-check"><input type="checkbox" checked={allStages} onChange={e => setAllStages(e.target.checked)} />Todas las etapas</label></div><HistoryLine key={`${stage}-${allStages}`} events={events} empty="Registra el primer avance para comenzar la historia de esta etapa." /></section>;
}
export function ProgressChart({ project, stage, cutoff }: { project: Project; stage: StageKey; cutoff: string }) {
  const series = progressSeries(project, stage, cutoff);
  const known = series.points.filter((p): p is typeof p & { value: number } => p.value !== null);
  if (!known.length) return null;
  const max = Math.max(series.target || 0, ...known.map(p => p.value), 1);
  const width = 640, height = 160, left = 48, right = 610, top = 16, bottom = 126;
  const start = Date.parse(`${known[0].date}T00:00:00Z`), end = Date.parse(`${known[known.length - 1].date}T00:00:00Z`);
  const x = (date: string) => start === end ? (left + right) / 2 : left + (Date.parse(`${date}T00:00:00Z`) - start) / (end - start) * (right - left);
  const y = (value: number) => bottom - value / max * (bottom - top);
  // Missing measurements split the line instead of inventing an interpolated advance.
  let drawing = false;
  const path = series.points.map(p => { if (p.value === null) { drawing = false; return ""; } const cmd = drawing ? "L" : "M"; drawing = true; return `${cmd}${x(p.date)},${y(p.value)}`; }).join(" ");
  return <section className="project-progress-chart"><div><h3><TrendingUp size={16} />Evolución del avance</h3><span>{series.unit} acumulados</span></div><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Historia de avance: ${known.map(p => `${shortDate(p.date)}, ${fmt(p.value)} ${series.unit}`).join("; ")}`}>
    {[0, .5, 1].map(f => <g key={f}><line x1={left} y1={y(max * f)} x2={right} y2={y(max * f)} className="project-chart-grid" /><text x={left - 9} y={y(max * f) + 4} textAnchor="end">{fmt(max * f)}</text></g>)}
    {series.target !== null && <line x1={left} x2={right} y1={y(series.target)} y2={y(series.target)} className="project-chart-target" />}
    <path d={path} className="project-chart-line" />{known.map(p => <circle key={p.id} cx={x(p.date)} cy={y(p.value)} r={4} className="project-chart-point"><title>{shortDate(p.date)} · {fmt(p.value)} {series.unit}</title></circle>)}
    <text x={left} y={height - 10}>{shortDate(known[0].date)}</text>{end !== start && <text x={right} y={height - 10} textAnchor="end">{shortDate(known[known.length - 1].date)}</text>}
  </svg>{series.target !== null && <p>Meta contractual: {fmt(series.target)} {series.unit}. Las mediciones originales se muestran en la historia.</p>}</section>;
}
