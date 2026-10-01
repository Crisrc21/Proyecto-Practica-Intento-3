import type { FacturaCalculada } from "../../accounts-receivable/types";
import type { DataState, Milestone, MilestoneStatus, Project } from "../types";

export function todayISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
export function daysBetween(a: string, b: string) { return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000); }
export function shortDate(date: string | null) { return date ? new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`)) : "Sin fecha"; }
export function amount(value: number | null, currency: "UF" | "CLP" = "CLP") {
  if (value === null) return "Sin dato";
  return currency === "UF" ? `${new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 }).format(value)} UF` : new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);
}
export function milestoneStatus(m: Milestone, cutoff: string): MilestoneStatus {
  if (m.actualDate && m.actualDate <= cutoff) {
    if (!m.baselineApproved || !m.baselineDate) return "Cumplido";
    return m.actualDate > m.baselineDate ? "Cumplido con atraso" : "Cumplido a tiempo";
  }
  if (!m.baselineApproved) return "Propuesto";
  if (m.state === "Observado") return "Observado";
  if (!m.baselineDate) return "Sin fecha";
  if (m.baselineDate <= cutoff) return "Sin evidencia";
  if (m.state === "En curso") return "En curso";
  return "Programado";
}
export function statusTone(status: MilestoneStatus) {
  if (status === "Cumplido a tiempo" || status === "Cumplido") return "success";
  if (status === "Sin evidencia" || status === "Observado") return "danger";
  if (status === "Cumplido con atraso") return "warning";
  if (status === "En curso") return "active";
  return "neutral";
}
export function compliance(project: Project, cutoff: string) {
  const confirmed = project.milestones.filter(m => m.baselineApproved);
  const due = confirmed.filter(m => m.baselineDate && m.baselineDate <= cutoff);
  const completed = confirmed.filter(m => m.actualDate && m.actualDate <= cutoff);
  const onTime = due.filter(m => m.actualDate && m.actualDate <= cutoff && m.actualDate <= m.baselineDate!);
  const dueCompleted = due.filter(m => m.actualDate && m.actualDate <= cutoff);
  const missing = due.filter(m => !m.actualDate || m.actualDate > cutoff);
  return { confirmed: confirmed.length, proposed: project.milestones.length - confirmed.length, due: due.length, completed: completed.length, missing: missing.length, dueCompleted: dueCompleted.length, onTime: onTime.length, percent: due.length ? Math.round(onTime.length / due.length * 100) : null };
}
export function receiptData(project: Project, invoices: FacturaCalculada[], state: DataState) {
  if (project.simulation) return { available: true, invoices: [], reason: "Escenario ficticio: facturas disponibles en el proyecto" };
  const linked = project.invoiceLinks.map(l => invoices.find(i => i.id === l.invoiceId));
  const incomplete = state !== "ready" || !linked.length || linked.some(i => !i || ("informacionParcial" in i && i.informacionParcial));
  return { available: !incomplete, invoices: linked.filter((i): i is FacturaCalculada => Boolean(i)), reason: state === "loading" ? "Consultando cobros" : state === "error" ? "Cobros no disponibles" : !linked.length ? "Sin facturas vinculadas" : incomplete ? "Información de cobros incompleta" : "Cobros vinculados" };
}
export function received(project: Project, invoices: FacturaCalculada[], state: DataState, cutoff: string) {
  if (project.simulation) return project.simulation.invoices.reduce((sum, invoice) => sum + invoice.payments.filter(payment => payment.date <= cutoff).reduce((subtotal, payment) => subtotal + payment.amountUF * project.simulation!.ufValue, 0), 0);
  const source = receiptData(project, invoices, state);
  return source.available ? source.invoices.reduce((sum, i) => sum + i.pagos.filter(p => p.fechaPago <= cutoff).reduce((s, p) => s + p.monto, 0), 0) : null;
}
export function monthlyCash(project: Project, invoices: FacturaCalculada[], state: DataState, year: number, cutoff: string, version: "base" | "current") {
  const source = receiptData(project, invoices, state);
  const milestones = project.lifecycle === "Potencial" ? [] : project.milestones.filter(m => ["Anticipo", "EDP", "Retenciones"].includes(m.type) && (version === "current" || m.baselineApproved));
  function cashPlan(m: Milestone) {
    const date = version === "base" ? m.baselineCashDate : m.cashDate;
    const value = version === "base" ? m.baselineCashAmount : m.cashAmount;
    const linkedIds = project.invoiceLinks.filter(l => l.milestoneId === m.id).map(l => l.invoiceId);
    const linked = linkedIds.map(id => invoices.find(i => i.id === id)).filter((i): i is FacturaCalculada => Boolean(i));
    const knownInvoices = source.available && linked.length > 0 && linked.length === linkedIds.length;
    const fullInvoices = version === "current" && m.invoicingComplete && knownInvoices;
    const needsUf = !fullInvoices && value !== null && project.currency === "UF" && !project.ufValue;
    let total: number | null = value === null || needsUf ? null : value * (project.currency === "UF" ? project.ufValue! : 1);
    if (project.simulation && version === "current") {
      const sim = project.simulation.invoices.filter(i => linkedIds.includes(i.id) && i.issued <= cutoff);
      const paid = sim.reduce((sum, i) => sum + i.payments.filter(p => p.date <= cutoff).reduce((s, p) => s + p.amountUF, 0), 0) * project.simulation.ufValue;
      const billed = sim.reduce((sum, i) => sum + i.amountUF, 0) * project.simulation.ufValue;
      const full = m.invoicingComplete && sim.length > 0 && sim.length === linkedIds.length;
      if (full) total = date && date > cutoff ? Math.max(0, billed - paid) : billed;
      else if (date && date > cutoff && total !== null) total = Math.max(0, Math.max(total, billed) - paid);
    }
    if (version === "current" && knownInvoices) {
      const billed = linked.reduce((sum, i) => sum + (i.anulada ? 0 : Math.max(0, i.monto - i.notasCredito.filter(n => n.fecha <= cutoff).reduce((s,n)=>s+n.monto,0) + i.notasDebito.filter(n=>n.fecha <= cutoff).reduce((s,n)=>s+n.monto,0))),0);
      const paid = linked.reduce((sum,i)=>sum+i.pagos.filter(p=>p.fechaPago<=cutoff).reduce((s,p)=>s+p.monto,0),0);
      if (fullInvoices) total = date && date > cutoff ? Math.max(0,billed-paid) : billed;
      else if (date && date > cutoff && total !== null) total = Math.max(0,Math.max(total,billed)-paid);
    }
    return {date,total,needsUf};
  }
  const plans = milestones.map(cashPlan);
  const unfunded = plans.filter(p => p.total === null || !p.date);
  const missingUf = plans.some(p=>p.needsUf);
  const hasPlan = plans.some(p=>p.date && p.total !== null);
  const data = Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, "0")}`;
    const dateEnd = new Date(Date.UTC(year, index + 1, 0)).toISOString().slice(0, 10);
    const isFuture = `${month}-01` > cutoff;
    let planned = 0;
    for (const plan of plans) if(plan.date?.slice(0,7) === month && plan.total !== null) planned += plan.total;
    const actual = source.available && !isFuture ? project.simulation ? project.simulation.invoices.reduce((sum, i) => sum + i.payments.filter(p => p.date.startsWith(month) && p.date <= cutoff).reduce((s, p) => s + p.amountUF * project.simulation!.ufValue, 0), 0) : source.invoices.reduce((sum, i) => sum + i.pagos.filter(p => p.fechaPago.startsWith(month) && p.fechaPago <= cutoff).reduce((s, p) => s + p.monto, 0), 0) : null;
    const projected = hasPlan ? planned : null;
    const complete = unfunded.length === 0 && !missingUf && hasPlan;
    return { month, planned: projected, actual, variance: complete && actual !== null && projected !== null && dateEnd <= cutoff ? actual - projected : null, complete, isFuture };
  });
  return { data, unplanned: unfunded.length, missingUf, hasPlan, source };
}
export function emptyMilestone(): Milestone {
  return { id: crypto.randomUUID(), name: "", type: "EDP", scope: "Fabricación", startDate: null, baselineDate: null, forecastDate: null, actualDate: null, baselineApproved: false, state: "Pendiente", evidence: "", notes: "", source: "Planificación de CDG", cashAmount: null, baselineCashAmount: null, cashDate: null, baselineCashDate: null };
}
export function emptyProject(): Project {
  return { id: crypto.randomUUID(), revision: 0, name: "", customer: "", customerRut: "", location: "", owner: "", units: 0, lifecycle: "Potencial", nature: null, includedWorks: [], areaM2: null, progressReports: [], contractType: "Suma alzada", currency: "UF", contractAmount: null, signedDate: null, startDate: null, endDate: null, ufValue: null, approvedFolder: "", paymentTerms: "", notes: "", scopes: [], sources: [], issues: [], milestones: [], invoiceLinks: [], updatedAt: "", history: [] };
}
