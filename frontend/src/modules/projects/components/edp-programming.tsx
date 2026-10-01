import { AmountInput } from "./amount-input";
import { useState, type FormEvent } from "react";
import { CalendarDays, ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import type { Milestone, Project, StageKey } from "../types";
import { amount, shortDate } from "../data/project-calculations";
import { activeStages, metricLabels, stages } from "../data/project-workflow";
import { buildEdpBatch, metricTarget, physicalPlan, type EdpBatch } from "../data/edp-programming";
import { Editor, SaveFooter } from "./project-forms";
import "../contract-process.css";

type Save = (project: Project, reason: string) => Promise<void>;
export function EdpProgramming({ project, onSave }: { project: Project; onSave: Save }) {
  const [editing, setEditing] = useState(false);
  const [distributionOpen, setDistributionOpen] = useState(false);
  const first = project.milestones.filter(m => m.type === "EDP" && m.edp?.presentedDate && ["Presentado", "Aprobado"].includes(m.edp.status)).sort((a, b) => a.edp!.presentedDate!.localeCompare(b.edp!.presentedDate!))[0];
  const edps = project.milestones.filter(m => m.type === "EDP");
  const retentionEdps = project.milestones.filter(m => m.type === "Retenciones");
  const distributionEdps = [...edps, ...retentionEdps];
  const declaredCount = edps.find(m => m.edpCount != null)?.edpCount;
  return <>
  <section className="project-panel">
    <div className="project-panel-heading"><div><span className="project-eyebrow">DOCUMENTO BASE DEL PROYECTO</span><h2>Datos generales del proyecto</h2><p>{project.edpPlan ? project.edpPlan.reference : first ? first.name : "El primer EDP presentado será la base del proyecto."}</p></div><button className="project-button primary" disabled={!first || !project.contractAmount} onClick={() => setEditing(true)}><CalendarDays size={16} />{project.edpPlan ? "Agregar EDP a la previsión" : "Programar siguientes EDP"}</button></div>
    <div className="project-contract-facts"><Fact label="Proyecto" value={project.name} /><Fact label="Mandante" value={project.customer || "Sin dato"} /><Fact label="Tipo de contrato" value={project.nature === "llave_en_mano" ? "Construcción completa / llave en mano" : project.nature === "fabricacion_montaje" ? "Fabricación y montaje" : "Sin clasificar"} /><Fact label="Viviendas" value={project.units.toLocaleString("es-CL")} /><Fact label="Superficie contratada" value={`${project.areaM2?.toLocaleString("es-CL") || "—"} m²`} /><Fact label="Ubicación" value={project.location || "Sin dato"} /><Fact label="Cantidad de estados de pago" value={declaredCount?.toLocaleString("es-CL") || "Por definir en el primer EDP"} /><Fact label="Monto total contratado" value={`${project.contractAmount == null ? "—" : project.contractAmount.toLocaleString("es-CL", { maximumFractionDigits: 0 })} UF`} /></div>
    {editing && first && <ProgrammingForm project={project} first={first} onSave={onSave} onClose={() => setEditing(false)} />}
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
  return <div className="project-edp-distribution"><button type="button" className="project-distribution-toggle" aria-expanded={open} onClick={onToggle}><span><strong>Distribución del monto total en EDP</strong><small>{open ? "Ocultar detalle de partidas y montos" : "Mostrar detalle de partidas y montos"}</small></span>{open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button>{open && <div className="project-table-scroll"><table className="project-financial-table"><thead><tr><th>EDP</th><th>Partida / condición</th><th>Avance del periodo</th><th>Acumulado</th><th>Bruto</th><th>Recuperación anticipo</th><th>Neto</th><th>Estado</th></tr></thead><tbody>{rows.map(({ m, period }) => <tr key={m.id}><td><strong>{m.type === "Retenciones" ? "EDP de retenciones" : m.name}</strong><small>{shortDate(m.edp?.presentedDate || m.forecastDate || m.cashDate)}</small></td><td>{m.type === "Retenciones" ? "Liberación de retenciones" : m.scope}<small>{m.edp ? metricLabels[m.edp.metric] : m.type === "Retenciones" ? "Retenciones contractuales" : "Sin condición"}</small></td><td>{period === null ? "—" : period.toLocaleString("es-CL", { maximumFractionDigits: 2 })}</td><td>{m.edp && !m.edp.documentOnly ? m.edp.threshold.toLocaleString("es-CL", { maximumFractionDigits: 2 }) : "—"}</td><td>{amount(m.type === "Retenciones" ? m.cashAmount : m.settlement?.gross ?? null, project.currency)}</td><td>{amount(m.type === "Retenciones" ? null : m.settlement?.advanceRecovery ?? null, project.currency)}</td><td>{amount(m.cashAmount, project.currency)}</td><td><span className="project-badge neutral">{m.type === "Retenciones" ? "Retenciones" : m.edp?.status || "Sin condición"}</span></td></tr>)}</tbody></table></div>}</div>;
}

function ProgrammingForm({ project, first, onSave, onClose }: { project: Project; first: Milestone; onSave: Save; onClose: () => void }) {
  const [reference, setReference] = useState(project.edpPlan?.reference || first.source || "");
  const [rows, setRows] = useState<Milestone[]>([]);
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const available = activeStages(project.nature, project.includedWorks).filter(s => !["firma", "anticipo"].includes(s.key));
  const [batch, setBatch] = useState<EdpBatch>({ stageKey: first.edp!.stageKey, metric: first.edp!.metric,
    from: Math.max(0, ...project.milestones.filter(m => !m.edp?.documentOnly && m.edp?.stageKey === first.edp!.stageKey && m.edp.metric === first.edp!.metric).map(m => m.edp!.threshold)),
    remaining: 0, perEdp: first.edp!.documentOnly ? (first.edp!.metric.endsWith("Pct") ? 50 : 10) : first.edp!.threshold, gross: 0, taxMode: first.settlement?.taxMode,
    retentionPercent: first.settlement?.gross ? first.settlement.retention / first.settlement.gross * 100 : 0,
    recoveryPercent: first.settlement?.gross ? first.settlement.advanceRecovery / first.settlement.gross * 100 : 0,
    approvalDate: "", intervalDays: 30, paymentDays: 30 });
  const existing = [...project.milestones, ...rows];
  function select(stageKey: StageKey, metric = stages.find(s => s.key === stageKey)!.metrics[0]) {
    const from = Math.max(0, ...existing.filter(m => m.type === "EDP" && !m.edp?.documentOnly && m.edp?.stageKey === stageKey && m.edp.metric === metric).map(m => m.edp!.threshold));
    setBatch(b => ({ ...b, stageKey, metric, from, remaining: Math.max(0, metricTarget(project, metric) - from), perEdp: metric.endsWith("Pct") ? 50 : 10 }));
  }
  function add() {
    setError("");
    try { const generated = buildEdpBatch(project, batch, existing); setRows(current => [...current, ...generated]); setBatch(b => ({ ...b, from: generated.at(-1)!.edp!.threshold, remaining: 0, gross: 0 })); }
    catch (e) { setError(e instanceof Error ? e.message : "Revisa la programación."); }
  }
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      if (project.edpPlan && !rows.length) throw new Error("Agrega los EDP que deseas incorporar a la previsión.");
      const milestones = [...project.milestones, ...rows];
      const edpPlan = project.edpPlan || { sourceMilestoneId: first.id, reference, milestoneIds: milestones.filter(m => m.type === "EDP").map(m => m.id), contractAmount: project.contractAmount!, currency: project.currency };
      await onSave({ ...project, milestones, edpPlan }, project.edpPlan ? "EDP adicionales incorporados a la previsión; programación inicial conservada" : "Programación de cobros desde el primer EDP presentado");
      onClose();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar la programación."); }
    finally { setBusy(false); }
  }
  const numeric = (key: keyof EdpBatch, value: string) => setBatch(b => ({ ...b, [key]: Number(value) }));
  const projected = [...project.milestones.filter(m => m.type === "EDP"), ...rows];
  const sum = (key: "gross" | "retention" | "advanceRecovery") => projected.every(m => m.settlement) ? projected.reduce((s, m) => s + m.settlement![key], 0) : null;
  return <Editor title="Programar EDP e ingresos del proyecto" onClose={() => { if (!busy) onClose(); }}><form className="project-form" onSubmit={submit}>
    <p className="project-note project-full">Documento base: <strong>{first.name}</strong>, presentado el {shortDate(first.edp!.presentedDate)}. Captura la programación que contiene el documento; no se realiza lectura automática de archivos.</p>
    <label className="project-field project-full">Referencia o enlace al primer EDP<input required readOnly={Boolean(project.edpPlan)} maxLength={2000} value={reference} onChange={e => setReference(e.target.value)} /></label>
    <fieldset className="project-full project-program-batch"><legend>Agregar pagos por partida</legend><div className="project-form">
      <label className="project-field">Partida<select value={batch.stageKey} onChange={e => select(e.target.value as StageKey)}>{available.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}</select></label>
      <label className="project-field">Medición<select value={batch.metric} onChange={e => select(batch.stageKey, e.target.value as EdpBatch["metric"])}>{stages.find(s => s.key === batch.stageKey)!.metrics.map(m => <option key={m} value={m}>{metricLabels[m]}</option>)}</select></label>
      <label className="project-field">Avance ya considerado<input type="number" min="0" step="any" value={batch.from} onChange={e => numeric("from", e.target.value)} /></label>
      <label className="project-field">Avance restante a distribuir<input type="number" min="0" step="any" value={batch.remaining} onChange={e => numeric("remaining", e.target.value)} /></label>
      <label className="project-field">Avance por EDP<input type="number" min="0" step="any" value={batch.perEdp} onChange={e => numeric("perEdp", e.target.value)} /></label>
      <label className="project-field">Bruto del avance restante ({project.currency})<AmountInput value={batch.gross} onChange={value => setBatch(b => ({ ...b, gross: value ?? 0 }))} /></label>
      {batch.taxMode && <label className="project-field">Devolución retenciones (%)<input readOnly value="5" /></label>}
      <label className="project-field">Devolución anticipo (%)<input type="number" readOnly={Boolean(batch.taxMode)} min="0" max="100" step="any" value={batch.taxMode ? 20 : batch.recoveryPercent} onChange={e => numeric("recoveryPercent", e.target.value)} /></label>
      <label className="project-field">Primera aprobación prevista del grupo<input type="date" value={batch.approvalDate} onChange={e => setBatch(b => ({ ...b, approvalDate: e.target.value }))} /></label>
      <label className="project-field">Días entre EDP<input type="number" min="1" step="1" value={batch.intervalDays} onChange={e => numeric("intervalDays", e.target.value)} /></label>
      <label className="project-field">Días de aprobación a cobro<input type="number" min="0" step="1" value={batch.paymentDays} onChange={e => numeric("paymentDays", e.target.value)} /></label>
      <p className="project-note project-full">Se distribuye el bruto proporcionalmente al avance. El último EDP contiene el remanente. Puedes agregar grupos de viviendas y urbanizaciones con distintos importes y plazos; después podrás ajustar cada EDP individualmente.</p>
      <button type="button" disabled={busy} className="project-button project-full" onClick={add}><Plus size={15} />Agregar grupo a la programación</button>
    </div></fieldset>
    <div className="project-full project-program-summary"><div><span>EDP totales</span><strong>{projected.length}</strong></div><div><span>Bruto total</span><strong>{amount(sum("gross"), project.currency)}</strong></div><div><span>Retenciones</span><strong>EDP separado</strong></div><div><span>Recuperación anticipo</span><strong>{amount(sum("advanceRecovery"), project.currency)}</strong></div></div>
    <p className="project-note project-full">Contrato: {amount(project.contractAmount, project.currency)}. {sum("gross") === null ? "Completa el desglose financiero de los EDP existentes antes de confirmar." : `Diferencia contrato − bruto EDP: ${amount(project.contractAmount! - sum("gross")!, project.currency)}.`} El anticipo y la devolución de retenciones se programan por separado; no se suman al avance bruto.</p>
    <div className="project-full project-table-scroll"><table className="project-financial-table"><thead><tr><th>Nuevo EDP</th><th>Avance acumulado</th><th>Bruto</th><th>Neto</th><th>Cobro</th></tr></thead><tbody>{rows.map(m => <tr key={m.id}><td>{m.name}</td><td>{m.edp!.threshold} · {metricLabels[m.edp!.metric]}</td><td>{amount(m.settlement!.gross, project.currency)}</td><td>{amount(m.cashAmount, project.currency)}</td><td>{shortDate(m.cashDate)}</td></tr>)}</tbody></table></div>
    {rows.length > 0 && <button type="button" className="project-button project-full" disabled={busy} onClick={() => { setRows([]); setError(""); }}><Trash2 size={15} />Vaciar propuesta sin guardar</button>}
    <SaveFooter busy={busy} error={error} onClose={onClose} label={project.edpPlan ? "Guardar nuevos EDP" : "Confirmar programación inicial"} />
  </form></Editor>;
}

export function PlannedPhysicalProgress({ project }: { project: Project }) {
  const rows = physicalPlan(project);
  return <section className="project-panel"><div className="project-panel-heading"><div><span className="project-eyebrow">PROGRAMACIÓN FÍSICA</span><h2>Avance comprometido por EDP</h2><p>Cantidades del período y avance acumulado de cada partida. Las mediciones ejecutadas se registran debajo.</p></div></div>{rows.length ? <div className="project-table-scroll"><table className="project-financial-table"><thead><tr><th>EDP / partida</th><th>Medición</th><th>Avance del período</th><th>Acumulado requerido</th><th>% de la partida</th><th>Aprobación prevista</th></tr></thead><tbody>{rows.map(({ milestone: m, period, percent }) => <tr key={m.id}><td><strong>{m.name}</strong><small>{m.scope}</small></td><td>{metricLabels[m.edp!.metric]}</td><td>{period.toLocaleString("es-CL")}</td><td>{m.edp!.threshold.toLocaleString("es-CL")}</td><td>{percent === null ? "Por definir" : `${percent.toLocaleString("es-CL", { maximumFractionDigits: 2 })}%`}</td><td>{shortDate(m.forecastDate)}</td></tr>)}</tbody></table></div> : <p className="project-footnote">La programación del primer EDP alimentará esta sección. Puedes registrar el avance ejecutado cuando tengas su evidencia.</p>}</section>;
}

