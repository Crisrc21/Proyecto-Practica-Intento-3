import { stages } from "../data/project-workflow";
import { edpSlots, edpListStatus } from "../data/edp-slots";
import { EdpInvoiceSummary } from "./edp-invoice-summary";
import { edpChecklist } from "../data/edp-checklist";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Check, CheckCircle2, FileCheck2, Plus, Search } from "lucide-react";
import type { FacturaCalculada } from "../../accounts-receivable/types";
import type { DataState, EdpCondition, Milestone, Project } from "../types";
import { amount, daysBetween, emptyMilestone, shortDate, todayISO } from "../data/project-calculations";
import { Editor, SaveFooter } from "./project-forms";
import { HistoryLine, type HistoryEvent } from "./project-history";
import { edpPayments } from "../data/project-history";

import { ProjectInvoiceLinks } from "./project-invoice-links";
import { EdpPartidaSelector } from "./edp-partida-selector";
import { newEdpSettlement, settlementTotals } from "../data/edp-settlement";
import { EdpSettlementFields } from "./edp-settlement";
import { EdpProgramming } from "./edp-programming";

type Save = (p: Project, reason: string) => Promise<void>;
export function ProjectEdps({ project, allProjects, onSave, initialEdpId, cutoff, invoices, dataState, onEdit, onCash }: { project: Project; allProjects: Project[]; onSave: Save; initialEdpId?: string | null; cutoff: string; invoices: FacturaCalculada[]; dataState: DataState; onEdit: (m: Milestone) => void; onCash: () => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null), [filter, setFilter] = useState("Todos"), [query, setQuery] = useState("");
  useEffect(() => { if (initialEdpId) { setSelectedId(initialEdpId); setFilter("Todos"); setQuery(""); } }, [initialEdpId]);
  const edps = edpSlots(project);
  const filtered = edps.filter(m => (filter === "Todos" || edpListStatus(m) === filter) && `${m.name} ${m.scope} ${project.invoiceLinks.filter(l => l.milestoneId === m.id).flatMap(l => l.tags || []).join(" ")}`.toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es")));
  const selected = filtered.find(m => m.id === selectedId) || filtered[0];
  function add() {
    const next: Milestone = { ...emptyMilestone(), name: "", scope: "Fabricación", settlement: newEdpSettlement(project), cashAmount: 0, edp: { stageKey: "fabricacion", metric: "m2", threshold: 1, documentOnly: true, status: "Previsto", triggeredDate: null, presentedDate: null, approvedDate: null, approvalEvidence: "" } };
    setFilter("Todos"); setQuery(""); setSelectedId(next.id); onEdit(next);
  }
  function canAttach(m: Milestone) { return !m.edp && !m.actualDate && ["EDP", "Anticipo"].includes(m.type); }
  function manage(m: Milestone) {
    if (!canAttach(m)) { onEdit(m); return; }
    const isAdvance = m.type === "Anticipo";
    onEdit({ ...m, edp: { stageKey: isAdvance ? "anticipo" : "fabricacion", metric: isAdvance ? "firma" : "m2", threshold: 1, status: "Previsto", triggeredDate: null, presentedDate: null, approvedDate: null, approvalEvidence: "" } });
  }
  return <div className="project-stack"><EdpProgramming project={project} onSave={onSave} /><section className="project-panel project-workflow-intro"><div className="project-section-intro"><div><span className="project-eyebrow">PASO 2 · ESTADOS DE PAGO</span><h2>Del estado de pago al cobro</h2><p>Registra el primer EDP presentado y programa los siguientes según lo pactado.</p></div><button className="project-button primary" onClick={add}><Plus size={16} />{project.milestones.some(m => m.type === "EDP" && m.edp?.presentedDate) ? "Agregar EDP" : "Registrar primer EDP presentado"}</button></div></section>
    <div className="project-edp-filters" role="group" aria-label="Filtrar estados de pago">{["Todos", "En proceso", "Presentado"].map(state => <button key={state} aria-pressed={filter === state} className={filter === state ? "is-active" : ""} onClick={() => setFilter(state)}><span>{state === "Todos" ? "Todos los EDP" : state === "Presentado" ? "Presentados" : state}</span><strong>{edps.filter(m => state === "Todos" || edpListStatus(m) === state).length}</strong></button>)}</div>
    <div className="project-workspace project-edp-workspace"><aside className="project-panel project-edp-navigation"><label className="project-edp-search"><Search size={16} /><input type="search" aria-label="Buscar estado de pago" placeholder="Buscar EDP o etiqueta…" value={query} onChange={e => setQuery(e.target.value)} /></label><div className="project-edp-selector">{filtered.map(m => <button key={m.id} className={selected?.id === m.id ? "is-selected" : ""} aria-pressed={selected?.id === m.id} aria-label={`Ver EDP ${m.name}`} onClick={() => setSelectedId(m.id)}><EdpListBadges project={project} milestone={m} invoices={invoices} dataState={dataState} cutoff={cutoff} /><strong>{m.name}</strong><span>{amount(m.cashAmount, project.currency)}</span><small>Cobro previsto: {shortDate(m.cashDate)}</small></button>)}</div>{!filtered.length && <div className="project-history-empty"><FileCheck2 size={24} /><p>{edps.length ? "No hay EDP para este filtro." : "Planifica tu primer EDP."}</p>{edps.length > 0 && <button className="project-text-link" onClick={() => { setFilter("Todos"); setQuery(""); }}>Limpiar filtros</button>}</div>}</aside>
    {selected ? <EdpDetail key={selected.id} allProjects={allProjects} onSave={onSave} project={project} milestone={selected} cutoff={cutoff} invoices={invoices} dataState={dataState} onEdit={() => manage(selected)} attach={canAttach(selected)} onCash={onCash} /> : <section className="project-panel project-empty"><FileCheck2 size={32} /><h3>{edps.length ? "Selecciona otro filtro" : "Cada EDP tiene su propia historia"}</h3><p>Podrás consultar los datos del EDP, su presentación, aprobación y pagos.</p></section>}</div>
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

  const occurred = (date: string | null | undefined) => Boolean(date && date <= cutoff);
  const presented = edp && ["Presentado", "Aprobado"].includes(edp.status) ? edp.presentedDate : null;
  const approved = edp ? edp.status === "Aprobado" ? edp.approvedDate : null : m.actualDate;
  const checklist = edpChecklist(project, m, invoices, dataState, cutoff);
  const linkedDueDates = project.invoiceLinks.filter(l => l.milestoneId === m.id).map(l => project.simulation?.invoices.find(i => i.id === l.invoiceId)?.due || invoices.find(i => i.id === l.invoiceId)?.fechaVencimiento).filter((d): d is string => Boolean(d)).sort();
  const dueDate = linkedDueDates.at(-1) || m.cashDate;
  const dueDays = dueDate ? daysBetween(cutoff, dueDate) : null;
  const dueLabel = dueDays === null ? "Sin fecha de vencimiento" : dueDays < 0 ? `${Math.abs(dueDays)} días vencido` : dueDays === 0 ? "Vence hoy" : `${dueDays} días por vencer`;
  const steps = [
    { name: "Datos del EDP", date: null, done: checklist.advance, detail: checklist.advance ? "Datos del EDP registrados" : "Completar datos del EDP" },
    { name: "Factura", date: null, done: checklist.linked, detail: checklist.linked ? "Factura asociada" : "Asociar factura" },
    { name: "Cobrado", date: null, done: checklist.paid, detail: checklist.paid ? "Factura pagada" : payments.paid ? "Pago parcial" : checklist.linked && !payments.available ? "Pago por verificar" : "Pendiente de pago" }
  ];
  const events: HistoryEvent[] = [];
  if (presented && occurred(presented)) events.push({ id: "presentation", date: presented, title: "EDP presentado", detail: "Enviado para revisión y aprobación" });
  if (approved && occurred(approved)) events.push({ id: "approval", date: approved, title: "EDP aprobado", detail: "Aprobación documental registrada", evidence: edp?.approvalEvidence || m.evidence });
  payments.payments.forEach(p => events.push({ id: `pay-${p.id}`, date: p.date, title: `${p.amount < 0 ? "Ajuste de cobro" : "Pago recibido"} · factura ${p.invoiceNumber}`, detail: amount(p.amount, project.simulation ? "UF" : "CLP"), href: `/trazabilidad?factura=${encodeURIComponent(p.invoiceId)}` }));
  const next = checklist.paid ? "Las facturas asociadas figuran pagadas." : !checklist.advance ? "Completa y guarda los datos del EDP." : !checklist.linked ? "Asocia la factura en Facturas y estados de pago." : "El paso Cobrado se completará cuando todas las facturas asociadas figuren pagadas.";
  return <div className="project-stack project-edp-detail"><section className="project-panel"><div className="project-panel-heading"><div><span className="project-eyebrow">{edp ? stages.find(s => s.key === edp.stageKey)?.label : m.scope}</span><h2>{m.name}</h2>{m.source && <div className="project-edp-reference">{m.source.startsWith("http") ? <a href={m.source} target="_blank" rel="noreferrer">Enlace del EDP</a> : <span>Referencia del EDP: {m.source}</span>}</div>}</div><button className="project-button primary" onClick={onEdit}>{attach ? "Definir condición" : "Gestionar EDP"}</button></div>
    <ol className="project-edp-journey" aria-label="Recorrido del estado de pago">{steps.map((step, i) => <li key={i} className={step.done ? "is-complete" : ""}><span>{step.done ? <Check size={16} /> : i + 1}</span><strong>{step.name}</strong><small>{step.date && step.done ? shortDate(step.date) : step.detail}</small></li>)}</ol>
    <div className="project-edp-money"><div><span>Proyectado para este EDP</span><strong>{amount(m.cashAmount, project.currency)}</strong><small>{shortDate(m.cashDate)}</small></div><div><span>Dinero cobrado al corte</span><strong>{amount(payments.paid, project.simulation ? "UF" : "CLP")}</strong><small>{payments.reason}</small></div></div>
    {m.settlement?.taxMode ? <div className="project-edp-settlement"><span>Total neto del avance {amount(m.settlement.gross, project.currency)}</span><span>− Devolución anticipo {amount(m.settlement.advanceRecovery, project.currency)}</span><span>− Devolución retenciones {amount(m.settlement.retention, project.currency)}</span><strong>Total neto a facturar {amount(settlementTotals(m.settlement).net, project.currency)}</strong><span>+ IVA (19%) {amount(settlementTotals(m.settlement).iva, project.currency)}</span><span>− CEEC (3,09%) {amount(settlementTotals(m.settlement).ceec, project.currency)}</span><strong>Total bruto a facturar {amount(m.cashAmount, project.currency)}</strong></div> : m.settlement && <div className="project-edp-settlement"><span>Bruto {amount(m.settlement.gross, project.currency)}</span><span>Amortización anticipo {amount(m.settlement.advanceRecovery, project.currency)}</span>{m.type === "Retenciones" && <span>Retenciones {amount(m.cashAmount, project.currency)}</span>}<span>Descuentos {amount(m.settlement.discounts ?? 0, project.currency)}</span><span>Multas {amount(m.settlement.penalties ?? 0, project.currency)}</span><span>Ajustes {amount(m.settlement.adjustments ?? 0, project.currency)}</span><strong>Neto del EDP {amount(m.cashAmount, project.currency)}</strong></div>}
    <div className="project-next-action"><div><span>Siguiente paso</span><p>{next}</p></div>{(edp?.status === "Aprobado" || payments.available) && <button className="project-button" onClick={onCash}>Ver planificación <ArrowRight size={14} /></button>}</div>
  </section><ProjectInvoiceLinks project={project} allProjects={allProjects} invoices={invoices} dataState={dataState} cutoff={cutoff} selectedMilestone={m.id} onSave={onSave} /><section className="project-panel"><div className="project-panel-heading"><div><h3>Historia del estado de pago</h3><p>Hechos registrados hasta {shortDate(cutoff)}.</p></div></div><HistoryLine events={events} empty="Los avances, aprobaciones y pagos aparecerán aquí cuando se registren." /><div className="project-date-strip"><div><span>Cobro previsto actual</span><strong>{shortDate(m.cashDate)}</strong></div><div><span>Cobro realizado</span><strong>{payments.completed ? "Sí" : "No"}</strong></div><div className={dueDays !== null && dueDays < 0 ? "is-overdue" : ""}><span>Vencimiento de factura</span><strong>{dueLabel}</strong></div></div></section></div>;
}

export function EdpForm({ project, milestone, invoices, dataState, onSave, onClose }: { invoices: FacturaCalculada[]; dataState: DataState; project: Project; milestone: Milestone; onSave: (m: Milestone, reason: string) => Promise<void>; onClose: () => void }) {
  const firstDocument = !project.milestones.some(m => m.type === "EDP") && !project.edpPlan && milestone.type === "EDP" && !project.milestones.some(m => m.type === "EDP" && m.edp?.presentedDate) && !project.milestones.some(m => m.id === milestone.id);
  const firstEdpId = project.edpPlan?.sourceMilestoneId || project.milestones.find(m => m.type === "EDP")?.id || milestone.id;
  const isFirstEdp = milestone.type === "EDP" && milestone.id === firstEdpId;
  const [edpCount, setEdpCount] = useState(milestone.edpCount?.toString() || "");
  const [draft, setDraft] = useState<Milestone>(() => {
    if (project.milestones.some(m => m.id === milestone.id)) return milestone;
    return { ...milestone, settlement: newEdpSettlement(project), cashAmount: 0,
      ...(firstDocument ? { name: "EDP 1 · avance presentado", source: "", edp: { ...milestone.edp!, status: "Previsto" as const, documentOnly: true, presentedDate: null } } : {}) };
  });


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
    <label className="project-field project-full">Fecha de cobro prevista originalmente<input type="date" value={draft.originalExpectedCashDate ?? ""} onChange={e => update({ originalExpectedCashDate: e.target.value || null })} /><span>Indica cuándo tenías previsto cobrar este EDP. Se conserva como referencia independiente de la emisión y el vencimiento de las facturas; no modifica la proyección vigente.</span></label>
    {edp.status === "Aprobado" && <><label className="project-field">Fecha de aprobación<input type="date" required max={todayISO()} min={edp.presentedDate || undefined} value={edp.approvedDate ?? ""} onChange={e => condition({ approvedDate: e.target.value || null })} /></label><label className="project-field project-full">Evidencia del EDP aprobado<input required value={edp.approvalEvidence} maxLength={2000} onChange={e => condition({ approvalEvidence: e.target.value })} placeholder="Enlace o referencia al archivo de la carpeta de aprobados" /></label></>}
    {!milestone.baselineApproved ? (draft.forecastDate || draft.edp?.presentedDate || draft.cashDate ? <label className="project-check project-full"><input type="checkbox" checked={draft.baselineApproved} onChange={e => update({ baselineApproved: e.target.checked })} />Confirmar fechas y monto como plan base</label> : <p className="project-note project-full">Puedes guardar el estado de pago ahora. La confirmación del plan base estará disponible cuando asocies la factura y se completen sus fechas.</p>) : <p className="project-note project-full">Plan base conservado: {shortDate(milestone.baselineDate)} · cobro {shortDate(milestone.baselineCashDate)} · {amount(milestone.baselineCashAmount, project.currency)}.</p>}
    <label className="project-check project-full"><input type="checkbox" checked={draft.invoicingComplete === true} onChange={e => update({ invoicingComplete: e.target.checked })} />Las facturas vinculadas cubren todo este EDP</label>
    <label className="project-field project-full">{firstDocument ? "Referencia o enlace al primer EDP presentado" : "Condición contractual / fuente"}<input required={draft.type === "EDP"} maxLength={2000} value={draft.source} onChange={e => update({ source: e.target.value })} /></label>
    <label className="project-field project-full">Observaciones<textarea rows={2} value={draft.notes} onChange={e => update({ notes: e.target.value })} /></label>
    <SaveFooter {...{ busy, error, onClose }} />
  </form></Editor>;
}
