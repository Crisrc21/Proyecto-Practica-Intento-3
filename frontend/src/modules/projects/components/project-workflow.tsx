import { edpSlots, edpListStatus } from "../data/edp-slots";
import { EdpInvoiceSummary } from "./edp-invoice-summary";
import { edpChecklist } from "../data/edp-checklist";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Check, CheckCircle2, Clock3, FileCheck2, Plus, Search } from "lucide-react";
import type { FacturaCalculada } from "../../accounts-receivable/types";
import type { DataState, EdpCondition, Milestone, ProgressReport, Project, StageKey } from "../types";
import { amount, daysBetween, emptyMilestone, shortDate, todayISO } from "../data/project-calculations";
import { activeStages, advancePayment, latestReport, metricLabels, metricValue, natures, physicalPercent, stages, workflowAtCutoff } from "../data/project-workflow";
import { Editor, SaveFooter } from "./project-forms";
import { HistoryLine, ProgressChart, ProgressHistory, type HistoryEvent } from "./project-history";
import { edpPayments } from "../data/project-history";

import { ProjectInvoiceLinks } from "./project-invoice-links";
import { HouseTracking } from "./project-simulation";
import { EdpPartidaSelector } from "./edp-partida-selector";
import { settlementTotals } from "../data/edp-settlement";
import { EdpSettlementFields } from "./edp-settlement";
import { EdpProgramming, PlannedPhysicalProgress } from "./edp-programming";

const number = (value: number | null | undefined) => value == null ? "—" : new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 }).format(value);
type Save = (p: Project, reason: string) => Promise<void>;
export function ProjectWorkflow({ project, invoices, dataState, cutoff, onSave, onEditStage, onEditProject, onEdps, onCash }: { project: Project; invoices: FacturaCalculada[]; dataState: DataState; cutoff: string; onSave: Save; onEditStage: (m: Milestone) => void; onEditProject: () => void; onEdps: () => void; onCash: () => void }) {
  const [editing, setEditing] = useState<StageKey | null>(null);
  const [selectedKey, setSelectedKey] = useState<StageKey>("fabricacion");
  const advance = advancePayment(project, invoices, dataState, cutoff);
  if (!project.nature) return <section className="project-panel project-workflow-intro"><h2>Selecciona el tipo de contrato</h2><p>Selecciona un tipo de contrato para incorporar las etapas de seguimiento y comenzar su historia de avances.</p><button className="project-button primary" onClick={onEditProject}>Seleccionar tipo de contrato</button></section>;
  const sequence = activeStages(project.nature, project.includedWorks).filter(s => !["firma", "anticipo"].includes(s.key));
  const stage = sequence.find(s => s.key === selectedKey) || sequence[0];
  const report = latestReport(project, stage.key, cutoff);
  const rawMilestone = project.milestones.find(m => m.stageKey === stage.key);
  const milestone = workflowAtCutoff(project, invoices, dataState, cutoff).milestones.find(m => m.stageKey === stage.key);
  const progress = (key: StageKey) => key === "anticipo" ? advance.percent : physicalPercent(project, key, cutoff);
  const percent = progress(stage.key);
  const stageEdps = project.milestones.filter(m => m.edp?.stageKey === stage.key);
  const cashEvents: HistoryEvent[] = stage.key === "anticipo" ? project.milestones.filter(m => m.type === "Anticipo").flatMap(m => edpPayments(project, m, invoices, dataState, cutoff).payments.map(p => ({ id: p.id, date: p.date, title: `Pago de anticipo · factura ${p.invoiceNumber}`, detail: amount(p.amount, project.simulation ? "UF" : "CLP"), href: `/trazabilidad?factura=${encodeURIComponent(p.invoiceId)}` }))) : [];
  return <div className="project-stack"><PlannedPhysicalProgress project={project} /><section className="project-panel project-workflow-intro"><div className="project-section-intro"><div><span className="project-eyebrow">PASO 3 · AVANCE FÍSICO</span><h2>Avance físico del proyecto</h2><p>{natures.find(n => n.id === project.nature)?.label} · producción y obra con evidencia.</p></div><span className="project-badge neutral"><Clock3 size={13} />Al {shortDate(cutoff)}</span></div></section>
    <div className="project-workspace"><aside className="project-panel project-stage-navigation"><div className="project-panel-heading"><div><h3>Partidas y avances</h3><p>Selecciona una partida para ver su evolución.</p></div></div><ol className="project-stage-rail">{sequence.map((s, index) => {
      const value = progress(s.key);
      return <li key={s.key} className={`${value === 100 ? "is-complete" : ""} ${stage.key === s.key ? "is-selected" : ""}`}><button aria-pressed={stage.key === s.key} aria-label={`Ver etapa ${s.label}`} onClick={() => setSelectedKey(s.key)}><span className="project-rail-dot">{value === 100 ? <Check size={15} /> : index + 1}</span><span className="project-rail-label"><strong>{s.label}</strong><small>{value === 100 ? "Cumplido" : value !== null ? "Avance registrado" : "Sin medición"}</small></span><span className="project-rail-value">{number(value)}{value !== null ? "%" : ""}</span></button></li>;
    })}</ol></aside>
    <div className="project-stage-detail project-stack">{stage.key === "fundaciones" && project.nature === "fabricacion_montaje" && <p className="project-note">Dependencia de montaje: verifica con la contraparte que las fundaciones estén listas. El avance de esta etapa no acredita por sí solo un trabajo facturable de la empresa; los EDP deben seguir lo pactado en el contrato.</p>}<section className="project-panel"><div className="project-panel-heading"><div><span className="project-eyebrow">ETAPA {sequence.findIndex(s => s.key === stage.key) + 1} DE {sequence.length}</span><h2>{stage.label}</h2></div><div className="project-actions">{!["firma", "anticipo"].includes(stage.key) && <button className="project-button primary" onClick={() => setEditing(stage.key)}><Plus size={15} />Registrar avance</button>}{stage.key === "firma" && <button className="project-button" onClick={onEditProject}>Ver ficha contractual</button>}{stage.key === "anticipo" && <button className="project-button primary" onClick={onCash}>Consultar cobros</button>}{rawMilestone && stage.key !== "firma" && <button className="project-button" onClick={() => onEditStage(rawMilestone)}>Programar avance</button>}</div></div>
      <div className="project-stage-overview"><div className="project-stage-current"><span>Avance al corte</span><strong>{number(percent)}{percent !== null ? "%" : ""}</strong><p>{stage.key === "anticipo" ? advance.label : stage.key === "firma" ? "Firma del contrato" : report ? `Última medición: ${shortDate(report.date)}` : "Registra el primer corte de esta etapa"}</p><div className="project-compliance-track" role="progressbar" aria-label={`Avance de ${stage.label}`} aria-valuenow={percent ?? 0} aria-valuemin={0} aria-valuemax={100} aria-valuetext={percent === null ? "Sin medición suficiente" : `${number(percent)}%`}><span style={{ width: `${percent ?? 0}%` }} /></div></div>
      <dl className="project-stage-measures">
        {stage.key === "fabricacion" && <><Metric label="m² fabricados / contratados" value={`${number(report?.quantity)} / ${number(project.areaM2)}`} /><Metric label="Casas terminadas / contratadas" value={`${number(report?.completedUnits)} / ${project.units}`} /></>}
        {stage.key === "despachos" && <Metric label="Casas despachadas / contratadas" value={`${number(report?.quantity)} / ${project.units}`} />}
        {stage.key === "fundaciones" && <Metric label="Casas con fundación terminada" value={`${number(report?.quantity)} / ${project.units}`} />}
        {stage.key === "montaje" && <Metric label="Casas montadas / contratadas" value={`${number(report?.quantity)} / ${project.units}`} />}
        {stage.key === "anticipo" && <><Metric label="Dinero cobrado en CxC" value={amount(advance.paid)} /><Metric label="Monto de facturas vinculadas" value={amount(advance.billed)} /></>}
        {stage.key === "total" && <Metric label="Método de medición" value="Avance informado según contrato" />}
        <Metric label="EDP de esta etapa" value={String(stageEdps.length)} />
      </dl></div>
      <div className="project-date-strip"><div><span>Compromiso inicial</span><strong>{shortDate(milestone?.baselineDate || null)}</strong></div><div><span>Fecha prevista actual</span><strong>{shortDate(milestone?.forecastDate || null)}</strong></div><div className={milestone?.actualDate ? "is-achieved" : ""}><span>Cumplimiento efectivo</span><strong>{shortDate(milestone?.actualDate && milestone.actualDate <= cutoff ? milestone.actualDate : null)}</strong></div></div>
      {!["firma", "anticipo"].includes(stage.key) && <ProgressChart project={project} stage={stage.key} cutoff={cutoff} />}
      <div className="project-stage-bottom"><span>{stageEdps.filter(m => m.edp?.status === "Preparado").length} EDP preparados para gestionar</span><button className="project-text-link" onClick={onEdps}>Ver estados de pago <ArrowRight size={14} /></button></div>
    </section>
    {stage.key === "anticipo" ? <section className="project-panel"><div className="project-panel-heading"><div><h3>Historia de cobros del anticipo</h3><p>Pagos y abonos efectivamente registrados en CxC.</p></div></div><HistoryLine key={`cash-${project.id}`} events={cashEvents} empty={advance.label} /></section> : <ProgressHistory key={stage.key} project={project} stage={stage.key} cutoff={cutoff} />}
    {project.simulation && (stage.key === "despachos" || stage.key === "montaje") && <HouseTracking project={project} stage={stage.key} onSave={onSave} />}
    </div></div>
    {editing && <ProgressForm key={editing} project={project} stage={editing} onSave={onSave} onClose={() => setEditing(null)} />}
  </div>;
}
function Metric({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }

function ProgressForm({ project, stage, onSave, onClose }: { project: Project; stage: StageKey; onSave: Save; onClose: () => void }) {
  const previous = latestReport(project, stage, todayISO());
  const [draft, setDraft] = useState<ProgressReport>({ id: crypto.randomUUID(), stageKey: stage, date: todayISO(), evidence: "", quantity: previous?.quantity ?? null, completedUnits: previous?.completedUnits ?? null, percent: previous?.percent ?? null });
  const [period, setPeriod] = useState(todayISO().slice(0, 7));
  const [produced, setProduced] = useState("");
  const reason = stage === "fabricacion" ? "Registro mensual de producción" : "Actualización de avance acumulado";
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      let report = draft;
      if (stage === "fabricacion") {
        const reports = (project.progressReports || []).filter(r => r.stageKey === "fabricacion");
        if (reports.some(r => (r.period || r.date.slice(0, 7)) === period)) throw new Error("Este mes ya tiene un registro de fabricación.");
        const last = [...reports].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
        if (last && period < last.date.slice(0, 7)) throw new Error("Registra un mes posterior al último avance para conservar el acumulado existente.");
        const value = Number(produced);
        if (!produced.trim() || !Number.isFinite(value) || value < 0) throw new Error("Indica los m² producidos durante el mes.");
        const [year, month] = period.split("-").map(Number);
        const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
        report = { ...draft, date: end > todayISO() ? todayISO() : end, period, periodQuantity: value, quantity: (last?.quantity || 0) + value, completedUnits: last?.completedUnits ?? null, percent: null, evidence: `Registro mensual de producción · ${period}` };
      }
      await onSave({ ...project, progressReports: [...(project.progressReports || []), report] }, reason); onClose();
    }
    catch (err) { setError(err instanceof Error ? err.message : "No se pudo guardar el avance."); } finally { setBusy(false); }
  }
  const quantityLabel = stage === "fabricacion" ? "m² fabricados acumulados" : stage === "despachos" ? "Casas despachadas acumuladas" : stage === "montaje" ? "Casas montadas acumuladas" : "Casas con fundación terminada";
  return <Editor title={`Registrar avance · ${stages.find(s => s.key === stage)?.label}`} onClose={onClose}><form className="project-form" onSubmit={submit}>
    <p className="project-note project-full">{stage === "fabricacion" ? "Selecciona el mes e indica solo los m² producidos en ese período. Se sumarán automáticamente al avance acumulado." : "Registra el total acumulado, no el incremento del período."}</p>
    {stage === "fabricacion" && <><label className="project-field">Período<input required type="month" min={project.signedDate?.slice(0, 7)} max={todayISO().slice(0, 7)} value={period} onChange={e => setPeriod(e.target.value)} /></label><label className="project-field">m² producidos en el mes<input required type="number" min="0" step="any" value={produced} onChange={e => setProduced(e.target.value)} /></label></> }
    {stage !== "fabricacion" && <label className="project-field">Fecha del corte<input required type="date" min={project.signedDate || undefined} max={todayISO()} value={draft.date} onChange={e => setDraft(d => ({ ...d, date: e.target.value }))} /></label>}
    {["despachos", "fundaciones", "montaje"].includes(stage) && <label className="project-field">{quantityLabel}<input type="number" min="0" step={stage === "fabricacion" ? "any" : "1"} max={stage === "fabricacion" ? project.areaM2 ?? undefined : project.units} value={draft.quantity ?? ""} onChange={e => setDraft(d => ({ ...d, quantity: e.target.value === "" ? null : Number(e.target.value) }))} /></label>}

    {["fundaciones", "interior", "exterior", "calles", "otras", "total"].includes(stage) && <label className="project-field">Avance acumulado (%)<input type="number" min="0" max="100" step="any" value={draft.percent ?? ""} onChange={e => setDraft(d => ({ ...d, percent: e.target.value === "" ? null : Number(e.target.value) }))} /></label>}
    {stage !== "fabricacion" && <label className="project-field project-full">Evidencia / referencia del avance<input required maxLength={2000} value={draft.evidence} onChange={e => setDraft(d => ({ ...d, evidence: e.target.value }))} placeholder="Enlace al informe, planilla de producción, guía de despacho o acta" /></label>}
    {stage === "total" && <p className="project-note project-full">Utiliza el porcentaje total validado según la ponderación del contrato. El sistema no asigna pesos supuestos a fabricación, montaje y urbanizaciones.</p>}
    <SaveFooter {...{ busy, error, onClose }} />
  </form></Editor>;
}

export function ProjectEdps({ project, allProjects, onSave, initialEdpId, cutoff, invoices, dataState, onEdit, onCash }: { project: Project; allProjects: Project[]; onSave: Save; initialEdpId?: string | null; cutoff: string; invoices: FacturaCalculada[]; dataState: DataState; onEdit: (m: Milestone) => void; onCash: () => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null), [filter, setFilter] = useState("Todos"), [query, setQuery] = useState("");
  useEffect(() => { if (initialEdpId) { setSelectedId(initialEdpId); setFilter("Todos"); setQuery(""); } }, [initialEdpId]);
  const edps = edpSlots(project);
  const filtered = edps.filter(m => (filter === "Todos" || edpListStatus(m) === filter) && `${m.name} ${m.scope} ${project.invoiceLinks.filter(l => l.milestoneId === m.id).flatMap(l => l.tags || []).join(" ")}`.toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es")));
  const selected = filtered.find(m => m.id === selectedId) || filtered[0];
  function add() {
    const next: Milestone = { ...emptyMilestone(), name: "", scope: "Fabricación", settlement: { gross: 0, advanceRecovery: 0, retention: 0, taxMode: "iva19-ceec309" }, cashAmount: 0, edp: { stageKey: "fabricacion", metric: "m2", threshold: 1, documentOnly: true, status: "Previsto", triggeredDate: null, presentedDate: null, approvedDate: null, approvalEvidence: "" } };
    setFilter("Todos"); setQuery(""); setSelectedId(next.id); onEdit(next);
  }
  function canAttach(m: Milestone) { return !m.edp && !m.actualDate && Boolean(project.nature) && ["EDP", "Anticipo"].includes(m.type); }
  function manage(m: Milestone) {
    if (!canAttach(m)) { onEdit(m); return; }
    const isAdvance = m.type === "Anticipo";
    onEdit({ ...m, edp: { stageKey: isAdvance ? "anticipo" : "fabricacion", metric: isAdvance ? "firma" : "m2", threshold: 1, status: "Previsto", triggeredDate: null, presentedDate: null, approvedDate: null, approvalEvidence: "" } });
  }
  return <div className="project-stack"><EdpProgramming project={project} onSave={onSave} /><section className="project-panel project-workflow-intro"><div className="project-section-intro"><div><span className="project-eyebrow">PASO 2 · ESTADOS DE PAGO</span><h2>Del avance al cobro</h2><p>Registra el primer EDP presentado y programa los siguientes según la naturaleza del contrato.</p></div><button className="project-button primary" disabled={!project.nature} onClick={add}><Plus size={16} />{project.milestones.some(m => m.type === "EDP" && m.edp?.presentedDate) ? "Agregar EDP" : "Registrar primer EDP presentado"}</button></div>{!project.nature && <p>Selecciona el tipo de contrato en la ficha para habilitar nuevos EDP por avance.</p>}</section>
    <div className="project-edp-filters" role="group" aria-label="Filtrar estados de pago">{["Todos", "En proceso", "Presentado"].map(state => <button key={state} aria-pressed={filter === state} className={filter === state ? "is-active" : ""} onClick={() => setFilter(state)}><span>{state === "Todos" ? "Todos los EDP" : state === "Presentado" ? "Presentados" : state}</span><strong>{edps.filter(m => state === "Todos" || edpListStatus(m) === state).length}</strong></button>)}</div>
    <div className="project-workspace project-edp-workspace"><aside className="project-panel project-edp-navigation"><label className="project-edp-search"><Search size={16} /><input type="search" aria-label="Buscar estado de pago" placeholder="Buscar EDP o etiqueta…" value={query} onChange={e => setQuery(e.target.value)} /></label><div className="project-edp-selector">{filtered.map(m => <button key={m.id} className={selected?.id === m.id ? "is-selected" : ""} aria-pressed={selected?.id === m.id} aria-label={`Ver EDP ${m.name}`} onClick={() => setSelectedId(m.id)}><EdpListBadges project={project} milestone={m} invoices={invoices} dataState={dataState} cutoff={cutoff} /><strong>{m.name}</strong><span>{amount(m.cashAmount, project.currency)}</span><small>Cobro previsto: {shortDate(m.cashDate)}</small></button>)}</div>{!filtered.length && <div className="project-history-empty"><FileCheck2 size={24} /><p>{edps.length ? "No hay EDP para este filtro." : "Planifica tu primer EDP."}</p>{edps.length > 0 && <button className="project-text-link" onClick={() => { setFilter("Todos"); setQuery(""); }}>Limpiar filtros</button>}</div>}</aside>
    {selected ? <EdpDetail key={selected.id} allProjects={allProjects} onSave={onSave} project={project} milestone={selected} cutoff={cutoff} invoices={invoices} dataState={dataState} onEdit={() => manage(selected)} attach={canAttach(selected)} onCash={onCash} /> : <section className="project-panel project-empty"><FileCheck2 size={32} /><h3>{edps.length ? "Selecciona otro filtro" : "Cada EDP tiene su propia historia"}</h3><p>Podrás seguir el avance habilitante, la presentación, la aprobación y los pagos.</p></section>}</div>
  </div>;
}
export function EdpListBadges({ project, milestone, invoices, dataState, cutoff }: { project: Project; milestone: Milestone; invoices: FacturaCalculada[]; dataState: DataState; cutoff: string }) {
  const status = edpListStatus(milestone);
  const { linked, paid } = edpChecklist(project, milestone, invoices, dataState, cutoff);
  return <div className="project-edp-list-badges">
    {(status === "Presentado" || !linked) && <span className={`project-badge ${status === "Presentado" ? "success" : "neutral"}`}>{status}</span>}
    {linked && <span className="project-badge success">Facturado</span>}
    {linked && status === "Presentado" && <span className={`project-badge ${paid ? "success" : "warning"}`}>{paid ? "Cobrado" : "No cobrado"}</span>}
  </div>;
}

function EdpDetail({ project, allProjects, onSave, milestone: m, cutoff, invoices, dataState, onEdit, onCash, attach }: { project: Project; allProjects: Project[]; onSave: Save; milestone: Milestone; cutoff: string; invoices: FacturaCalculada[]; dataState: DataState; onEdit: () => void; onCash: () => void; attach: boolean }) {
  const payments = edpPayments(project, m, invoices, dataState, cutoff), edp = m.edp;
  const value = edp ? metricValue(project, edp, cutoff) : null;
  const occurred = (date: string | null | undefined) => Boolean(date && date <= cutoff);
  const presented = edp && ["Presentado", "Aprobado"].includes(edp.status) ? edp.presentedDate : null;
  const approved = edp ? edp.status === "Aprobado" ? edp.approvedDate : null : m.actualDate;
  const checklist = edpChecklist(project, m, invoices, dataState, cutoff);
  const linkedDueDates = project.invoiceLinks.filter(l => l.milestoneId === m.id).map(l => project.simulation?.invoices.find(i => i.id === l.invoiceId)?.due || invoices.find(i => i.id === l.invoiceId)?.fechaVencimiento).filter((d): d is string => Boolean(d)).sort();
  const dueDate = linkedDueDates.at(-1) || m.cashDate;
  const dueDays = dueDate ? daysBetween(cutoff, dueDate) : null;
  const dueLabel = dueDays === null ? "Sin fecha de vencimiento" : dueDays < 0 ? `${Math.abs(dueDays)} días vencido` : dueDays === 0 ? "Vence hoy" : `${dueDays} días por vencer`;
  const steps = [
    { name: "Avance físico", date: null, done: checklist.advance, detail: checklist.advance ? "Datos del EDP registrados" : "Completar datos del EDP" },
    { name: "Factura", date: null, done: checklist.linked, detail: checklist.linked ? "Factura asociada" : "Asociar factura" },
    { name: "Cobrado", date: null, done: checklist.paid, detail: checklist.paid ? "Factura pagada" : payments.paid ? "Pago parcial" : checklist.linked && !payments.available ? "Pago por verificar" : "Pendiente de pago" }
  ];
  const events: HistoryEvent[] = [];
  if (edp?.triggeredDate && occurred(edp.triggeredDate)) events.push({ id: "trigger", date: edp.triggeredDate, title: "EDP preparado", detail: `${metricLabels[edp.metric]} · umbral ${number(edp.threshold)} alcanzado` });
  if (presented && occurred(presented)) events.push({ id: "presentation", date: presented, title: "EDP presentado", detail: "Enviado para revisión y aprobación" });
  if (approved && occurred(approved)) events.push({ id: "approval", date: approved, title: "EDP aprobado", detail: "Aprobación documental registrada", evidence: edp?.approvalEvidence || m.evidence });
  payments.payments.forEach(p => events.push({ id: `pay-${p.id}`, date: p.date, title: `${p.amount < 0 ? "Ajuste de cobro" : "Pago recibido"} · factura ${p.invoiceNumber}`, detail: amount(p.amount, project.simulation ? "UF" : "CLP"), href: `/trazabilidad?factura=${encodeURIComponent(p.invoiceId)}` }));
  const next = checklist.paid ? "Las facturas asociadas figuran pagadas." : !checklist.advance ? "Completa y guarda los datos del EDP." : !checklist.linked ? "Asocia la factura en Facturas y estados de pago." : "El paso Cobrado se completará cuando todas las facturas asociadas figuren pagadas.";
  return <div className="project-stack project-edp-detail"><section className="project-panel"><div className="project-panel-heading"><div><span className="project-eyebrow">{edp ? stages.find(s => s.key === edp.stageKey)?.label : m.scope}</span><h2>{m.name}</h2>{m.source && <div className="project-edp-reference">{m.source.startsWith("http") ? <a href={m.source} target="_blank" rel="noreferrer">Enlace del EDP</a> : <span>Referencia del EDP: {m.source}</span>}</div>}</div><button className="project-button primary" onClick={onEdit}>{attach ? "Definir condición" : "Gestionar EDP"}</button></div>
    <ol className="project-edp-journey" aria-label="Recorrido del estado de pago">{steps.map((step, i) => <li key={i} className={step.done ? "is-complete" : ""}><span>{step.done ? <Check size={16} /> : i + 1}</span><strong>{step.name}</strong><small>{step.date && step.done ? shortDate(step.date) : step.detail}</small></li>)}</ol>
    <div className="project-edp-money"><div><span>Proyectado para este EDP</span><strong>{amount(m.cashAmount, project.currency)}</strong><small>{shortDate(m.cashDate)}</small></div><div><span>Dinero cobrado al corte</span><strong>{amount(payments.paid, project.simulation ? "UF" : "CLP")}</strong><small>{payments.reason}</small></div></div>
    {m.settlement?.taxMode ? <div className="project-edp-settlement"><span>Total neto del avance {amount(m.settlement.gross, project.currency)}</span><span>− Devolución anticipo {amount(m.settlement.advanceRecovery, project.currency)}</span><span>− Devolución retenciones {amount(m.settlement.retention, project.currency)}</span><strong>Total neto a facturar {amount(settlementTotals(m.settlement).net, project.currency)}</strong><span>+ IVA (19%) {amount(settlementTotals(m.settlement).iva, project.currency)}</span><span>− CEEC (3,09%) {amount(settlementTotals(m.settlement).ceec, project.currency)}</span><strong>Total bruto a facturar {amount(m.cashAmount, project.currency)}</strong></div> : m.settlement && <div className="project-edp-settlement"><span>Bruto {amount(m.settlement.gross, project.currency)}</span><span>Amortización anticipo {amount(m.settlement.advanceRecovery, project.currency)}</span>{m.type === "Retenciones" && <span>Retenciones {amount(m.cashAmount, project.currency)}</span>}<span>Descuentos {amount(m.settlement.discounts ?? 0, project.currency)}</span><span>Multas {amount(m.settlement.penalties ?? 0, project.currency)}</span><span>Ajustes {amount(m.settlement.adjustments ?? 0, project.currency)}</span><strong>Neto del EDP {amount(m.cashAmount, project.currency)}</strong></div>}
    {edp && !edp.documentOnly && <div className="project-edp-condition"><div><span>Condición de avance</span><strong>{metricLabels[edp.metric]}</strong></div><strong>{number(value)} <span>/ {number(edp.threshold)}</span></strong><div className="project-compliance-track"><span style={{ width: `${value !== null ? Math.min(100, Math.max(0, value / edp.threshold * 100)) : 0}%` }} /></div></div>}
    {edp && !edp.documentOnly && value !== null && value < edp.threshold && ["Presentado", "Aprobado"].includes(edp.status) && <p className="project-footnote project-negative">El avance al corte es inferior a la condición del EDP. Revisa la evidencia y la fecha de corte.</p>}
    <div className="project-next-action"><div><span>Siguiente paso</span><p>{next}</p></div>{(edp?.status === "Aprobado" || payments.available) && <button className="project-button" onClick={onCash}>Ver planificación <ArrowRight size={14} /></button>}</div>
  </section><ProjectInvoiceLinks project={project} allProjects={allProjects} invoices={invoices} dataState={dataState} cutoff={cutoff} selectedMilestone={m.id} onSave={onSave} /><section className="project-panel"><div className="project-panel-heading"><div><h3>Historia del estado de pago</h3><p>Hechos registrados hasta {shortDate(cutoff)}.</p></div></div><HistoryLine events={events} empty="Los avances, aprobaciones y pagos aparecerán aquí cuando se registren." /><div className="project-date-strip"><div><span>Cobro previsto actual</span><strong>{shortDate(m.cashDate)}</strong></div><div><span>Cobro realizado</span><strong>{payments.completed ? "Sí" : "No"}</strong></div><div className={dueDays !== null && dueDays < 0 ? "is-overdue" : ""}><span>Vencimiento de factura</span><strong>{dueLabel}</strong></div></div></section></div>;
}

export function EdpForm({ project, milestone, invoices, dataState, onSave, onClose }: { invoices: FacturaCalculada[]; dataState: DataState; project: Project; milestone: Milestone; onSave: (m: Milestone, reason: string, report?: ProgressReport) => Promise<void>; onClose: () => void }) {
  const firstDocument = !project.milestones.some(m => m.type === "EDP") && !project.edpPlan && milestone.type === "EDP" && !project.milestones.some(m => m.type === "EDP" && m.edp?.presentedDate) && !project.milestones.some(m => m.id === milestone.id);
  const firstEdpId = project.edpPlan?.sourceMilestoneId || project.milestones.find(m => m.type === "EDP")?.id || milestone.id;
  const isFirstEdp = milestone.type === "EDP" && milestone.id === firstEdpId;
  const [edpCount, setEdpCount] = useState(milestone.edpCount?.toString() || "");
  const [draft, setDraft] = useState<Milestone>(() => firstDocument ? { ...milestone, name: "EDP 1 · avance presentado", source: "", settlement: { gross: 0, retention: 0, advanceRecovery: 0, taxMode: "iva19-ceec309" }, cashAmount: 0, edp: { ...milestone.edp!, status: "Previsto", documentOnly: true, presentedDate: null } } : milestone);


  const reason = milestone.name ? "Estado de pago actualizado" : "Planificación de EDP según contrato";
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const edp = draft.edp!;
  const locked = ["Presentado", "Aprobado"].includes(milestone.edp!.status);
  const update = (patch: Partial<Milestone>) => setDraft(d => ({ ...d, ...patch }));
  const condition = (patch: Partial<EdpCondition>) => setDraft(d => ({ ...d, edp: { ...d.edp!, ...patch } }));
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    const baseDate = draft.forecastDate || draft.edp?.presentedDate || draft.cashDate;
    try {
      const count = Number(edpCount);
      const registered = project.milestones.filter(m => m.type === "EDP" || m.type === "Retenciones").length;
      if (isFirstEdp && (!Number.isInteger(count) || count < Math.max(1, registered) || count > 450)) throw new Error(`Indica una cantidad total de estados de pago entre ${Math.max(1, registered)} y 450, incluyendo este EDP y los de retenciones.`);
      const counted = { ...draft, edpCount: isFirstEdp ? count : draft.edpCount };
      const next = !milestone.baselineApproved ? { ...counted, baselineApproved: Boolean(draft.baselineApproved && baseDate), baselineDate: baseDate, baselineCashDate: draft.cashDate, baselineCashAmount: draft.cashAmount } : counted;
      await onSave(next, reason); onClose();
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo guardar el EDP."); } finally { setBusy(false); }
  }
  return <Editor title={milestone.name ? "Gestionar estado de pago" : "Planificar estado de pago"} onClose={onClose}><form className="project-form" onSubmit={submit}>
    {firstDocument && <p className="project-note project-full">Registra los datos del estado de pago. Al asociar la factura se completarán su monto, emisión y vencimiento; la asociación no acredita dinero recibido.</p>}
    <label className="project-field project-full">Nombre del Estado de Pago<input required maxLength={200} value={draft.name} onChange={e => update({ name: e.target.value })} placeholder="Ej.: EDP 1 · fabricación de las primeras 10 casas" /></label>
    <EdpPartidaSelector project={project} milestone={draft} locked={locked} onChange={update} />
    {isFirstEdp && <label className="project-field project-full">Cantidad total de estados de pago<input type="number" required min="1" max="450" step="1" value={edpCount} onChange={e => setEdpCount(e.target.value)} placeholder="Ej.: 12" /><span>Incluye este primer EDP, los siguientes y el EDP de retenciones. El anticipo no se cuenta como EDP.</span></label>}
    <p className="project-note project-full">Cada monto es el cobro de este EDP, no un monto acumulado. El registro del documento no agrega avance físico ni registra dinero recibido.</p>
    <EdpSettlementFields milestone={draft} currency={project.currency} onChange={update} />
    <EdpInvoiceSummary project={project} milestoneId={milestone.id} invoices={invoices} dataState={dataState} />
    {edp.status === "Aprobado" && <><label className="project-field">Fecha de aprobación<input type="date" required max={todayISO()} min={edp.presentedDate || undefined} value={edp.approvedDate ?? ""} onChange={e => condition({ approvedDate: e.target.value || null })} /></label><label className="project-field project-full">Evidencia del EDP aprobado<input required value={edp.approvalEvidence} maxLength={2000} onChange={e => condition({ approvalEvidence: e.target.value })} placeholder="Enlace o referencia al archivo de la carpeta de aprobados" /></label></>}
    {!milestone.baselineApproved ? (draft.forecastDate || draft.edp?.presentedDate || draft.cashDate ? <label className="project-check project-full"><input type="checkbox" checked={draft.baselineApproved} onChange={e => update({ baselineApproved: e.target.checked })} />Confirmar fechas y monto como plan base</label> : <p className="project-note project-full">Puedes guardar el estado de pago ahora. La confirmación del plan base estará disponible cuando asocies la factura y se completen sus fechas.</p>) : <p className="project-note project-full">Plan base conservado: {shortDate(milestone.baselineDate)} · cobro {shortDate(milestone.baselineCashDate)} · {amount(milestone.baselineCashAmount, project.currency)}.</p>}
    <label className="project-check project-full"><input type="checkbox" checked={draft.invoicingComplete === true} onChange={e => update({ invoicingComplete: e.target.checked })} />Las facturas vinculadas cubren todo este EDP</label>
    <label className="project-field project-full">{firstDocument ? "Referencia o enlace al primer EDP presentado" : "Condición contractual / fuente"}<input required={draft.type === "EDP"} maxLength={2000} value={draft.source} onChange={e => update({ source: e.target.value })} /></label>
    <label className="project-field project-full">Observaciones<textarea rows={2} value={draft.notes} onChange={e => update({ notes: e.target.value })} /></label>
    <SaveFooter {...{ busy, error, onClose }} />
  </form></Editor>;
}
