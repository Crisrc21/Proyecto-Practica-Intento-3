import { useState, type FormEvent } from "react";
import type { FacturaCalculada } from "../../accounts-receivable/types";
import type { DataState, Project } from "../types";
import { financialPlanning } from "../data/financial-planning";
import { amount, shortDate } from "../data/project-calculations";
import { AppLink } from "../../../shared/components/app-link";
import "../financial-planning.css";

export function FinancialPlanning({ projects, invoices, dataState, cutoff, onSave }: { projects: Project[]; invoices: FacturaCalculada[]; dataState: DataState; cutoff: string; onSave: (p: Project, reason: string) => Promise<void> }) {
  const report = financialPlanning(projects, invoices, dataState, cutoff);
  const [mode, setMode] = useState<"weekly" | "month">("weekly");
  const [editing, setEditing] = useState<string | null>(null), [date, setDate] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [filter, setFilter] = useState("pending");
  const visible = report.rows.filter(r => {
    if (filter === "all") return true;
    if (filter === "review") return r.overdue || r.remaining === null || !r.date && r.remaining > 0;
    return r.remaining === null || r.remaining > 0;
  }).sort((a,b) => (a.date || "9999").localeCompare(b.date || "9999"));
  async function reprogram(event: FormEvent, row: typeof report.rows[number]) {
    event.preventDefault(); setBusy(true); setError("");
    try { await onSave({ ...row.project, milestones: row.project.milestones.map(m => m.id === row.milestone.id ? { ...m, cashDate: date || null } : m) }, "Revisión financiera: fecha esperada de cobro actualizada"); setEditing(null); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo reprogramar el cobro."); }
    finally { setBusy(false); }
  }
  return <section className="project-panel project-financial">
    <div className="project-panel-heading"><div><span className="project-eyebrow">PLANIFICACIÓN DE INGRESOS</span><h2>Del avance a la caja esperada</h2><p>Avance físico → EDP → Aprobación → Factura → Cobro. Revisión al {shortDate(cutoff)}.</p></div><div className="project-view-tabs" role="group" aria-label="Horizonte financiero"><button aria-pressed={mode === "weekly"} className={mode === "weekly" ? "is-active" : ""} onClick={() => setMode("weekly")}>Flujo semanal</button><button aria-pressed={mode === "month"} className={mode === "month" ? "is-active" : ""} onClick={() => setMode("month")}>Estimación de cierre</button></div></div>
    <p className="project-footnote">La proyección usa el neto pendiente de cada EDP y su fecha esperada de cobro. Se actualiza con abonos y reprogramaciones; facturar o aprobar un EDP no registra entrada de dinero.</p>
    {mode === "weekly" ? <><div className="project-financial-weeks">{report.weeks.map((week, index) => <article key={week.start}><span>{index === 0 ? "Resto de esta semana" : `Semana ${index + 1}`}</span><h3>{shortDate(week.start)} — {shortDate(week.end)}</h3><strong>{amount(week.total)}{week.unknown ? " *" : ""}</strong><small>Facturado: {amount(week.invoiced)}</small><small>Por avance / documentos: {amount(week.conditional)}</small>{week.unknown > 0 && <small>{week.unknown} importes por verificar</small>}</article>)}</div><p className="project-footnote">Pendiente desde el corte, en pesos. Las semanas comienzan el lunes. Los cobros atrasados quedan por revisar y no se trasladan automáticamente a otra semana. * Total parcial.</p></> : <><div className="project-financial-kpis">{[["Plan base del mes", report.baseline], ["Cobrado al corte", report.actual], ["Pendiente programado del mes", report.pending], ["Estimación de cierre", report.estimate]].map(([label, value]) => <div key={String(label)}><span>{label}</span><strong>{amount(value as number | null)}</strong></div>)}</div><p className="project-footnote">Mes {report.month}: estimación = cobrado al corte + saldo esperado hasta fin de mes. Se muestra «Sin dato» si hay atrasos por reprogramar o información pendiente. Esta lectura es provisional con la planificación vigente; aún no guarda un cierre mensual congelado.</p></>}
    {(report.overdue.length > 0 || report.unplanned.length > 0) && <div className="project-financial-alert" role="status"><strong>Revisión financiera pendiente</strong><span>{report.overdue.length} cobros con fecha anterior al corte · saldo conocido {amount(report.overdueAmount)}.</span><span>{report.unplanned.length} cobros sin fecha o importe verificable. Revisa sus supuestos antes de comprometer la caja.</span></div>}
    <div className="project-panel-heading"><div><h3>Agenda de ingresos</h3><p>El estado indica qué respaldo tiene cada proyección. Actualiza la fecha desde la revisión semanal.</p></div><label className="project-field compact">Mostrar<select value={filter} onChange={e => setFilter(e.target.value)}><option value="pending">Pendientes de cobro</option><option value="review">Por revisar</option><option value="all">Todos</option></select></label></div>
    {error && <p className="project-error" role="alert">{error}</p>}
    <div className="project-table-scroll"><table className="project-financial-table"><thead><tr><th>Proyecto / EDP</th><th>Respaldo actual</th><th>Plan base</th><th>Cobro esperado</th><th>Neto pendiente (CLP)</th><th>Revisión</th></tr></thead><tbody>{visible.map(row => { const key = `${row.project.id}/${row.milestone.id}`; return <tr key={key}><td><strong>{row.project.name}</strong><AppLink href={`/proyectos?proyecto=${encodeURIComponent(row.project.id)}&vista=edps&edp=${encodeURIComponent(row.milestone.id)}`}>{row.milestone.name}</AppLink></td><td><span className={`project-badge ${row.stage === "Cobrado" ? "success" : "neutral"}`}>{row.stage}</span></td><td>{shortDate(row.baseDate)}</td><td>{shortDate(row.date)}{row.overdue && <small className="project-negative">Por reprogramar</small>}</td><td>{amount(row.remaining)}</td><td>{editing === key ? <form className="project-financial-edit" onSubmit={e => reprogram(e, row)}><label className="project-field">Nueva fecha<input type="date" required value={date} onChange={e => setDate(e.target.value)} /></label><button className="project-button primary" disabled={busy}>Guardar</button><button className="project-button" type="button" disabled={busy} onClick={() => setEditing(null)}>Cancelar</button></form> : <button className="project-button" disabled={busy} onClick={() => { setEditing(key); setDate(row.date || cutoff); setError(""); }}>Reprogramar</button>}</td></tr>; })}</tbody></table></div>
    {!visible.length && <p className="project-footnote">No hay EDP para esta selección.</p>}
    <p className="project-footnote">Al guardar se conserva el plan base y queda registro en el historial. Los montos de contrato en UF usan el supuesto UF de la ficha; las facturas y pagos reales conservan sus importes en pesos. Alcance: ingresos vinculados a proyectos, sin egresos ni saldo bancario.</p>
  </section>;
}
