import type { FacturaCalculada } from "../../accounts-receivable/types";
import type { DataState, Milestone, Project, StageKey } from "../types";

export function stageReports(project: Project, stage: StageKey | "all", cutoff: string) {
  return [...(project.progressReports || []), ...(project.houseProgress || [])].filter(r => (stage === "all" || r.stageKey === stage) && r.date <= cutoff).sort((a, b) => a.date.localeCompare(b.date));
}
export function progressSeries(project: Project, stage: StageKey, cutoff: string) {
  const percentage = ["fundaciones", "interior", "exterior", "calles", "otras", "total"].includes(stage);
  const unit = percentage ? "%" : stage === "fabricacion" ? "m²" : "casas";
  const target = percentage ? 100 : stage === "fabricacion" ? project.areaM2 ?? null : project.units || null;
  const points = stageReports(project, stage, cutoff).map(r => ({ id: r.id, date: r.date, value: percentage ? r.percent : r.quantity }));
  return { points, unit, target };
}
export function edpPayments(project: Project, milestone: Milestone, invoices: FacturaCalculada[], state: DataState, cutoff: string) {
  const ids = project.invoiceLinks.filter(l => l.milestoneId === milestone.id).map(l => l.invoiceId);
  if (project.simulation) {
    const linked = project.simulation.invoices.filter(invoice => ids.includes(invoice.id) && invoice.issued <= cutoff);
    if (!linked.length) return { available: false, paid: null, billed: null, completed: false, paidDate: null, payments: [], reason: "Sin facturas vinculadas" };
    const payments = linked.flatMap(invoice => invoice.payments.filter(payment => payment.date <= cutoff).map(payment => ({ id: payment.id, date: payment.date, amount: payment.amountUF, invoiceId: invoice.id, invoiceNumber: invoice.number }))).sort((a, b) => a.date.localeCompare(b.date));
    const paid = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const billed = linked.reduce((sum, invoice) => sum + invoice.amountUF, 0);
    const completed = (milestone.type === "Retenciones" || milestone.invoicingComplete === true) && linked.length === ids.length && billed > 0 && paid >= billed;
    let paidDate: string | null = null, accumulated = 0;
    if (completed) for (const payment of payments) { accumulated += payment.amount; if (accumulated >= billed && !paidDate) paidDate = payment.date; }
    return { available: true, paid, billed, completed, paidDate, payments, reason: completed ? "Cobro completo" : paid > 0 ? "Cobro parcial" : "Pendiente de cobro" };
  }
  const source = ids.map(id => invoices.find(i => i.id === id));
  const available = state === "ready" && ids.length > 0 && source.every(i => i && !("informacionParcial" in i && i.informacionParcial));
  if (!available) return { available: false, paid: null, billed: null, completed: false, paidDate: null, payments: [], reason: state !== "ready" ? "CxC no disponible" : ids.length ? "Información de cobros incompleta" : "Sin facturas vinculadas" };
  const linked = source.filter((i): i is FacturaCalculada => Boolean(i && (!i.fechaEmision || i.fechaEmision <= cutoff)));
  const payments = linked.flatMap(i => i.pagos.filter(p => p.fechaPago <= cutoff).map((p, index) => ({ id: `${i.id}-${index}`, date: p.fechaPago, amount: p.monto, invoiceId: i.id, invoiceNumber: i.numero }))).sort((a, b) => a.date.localeCompare(b.date));
  const paid = payments.reduce((sum, p) => sum + p.amount, 0);
  const billed = linked.reduce((sum, i) => sum + (i.anulada ? 0 : Math.max(0, i.monto - i.notasCredito.filter(n => n.fecha <= cutoff).reduce((s, n) => s + n.monto, 0) + i.notasDebito.filter(n => n.fecha <= cutoff).reduce((s, n) => s + n.monto, 0))), 0);
  const completed = (milestone.type === "Retenciones" || milestone.invoicingComplete === true) && linked.length === ids.length && billed > 0 && paid >= billed;
  let paidDate: string | null = null, accumulated = 0;
  if (completed) for (const p of payments) { accumulated += p.amount; paidDate = accumulated >= billed ? paidDate || p.date : null; }
  return { available: true, paid, billed, completed, paidDate, payments, reason: completed ? "Cobro completo" : paid > 0 ? "Cobro parcial" : "Pendiente de cobro" };
}
