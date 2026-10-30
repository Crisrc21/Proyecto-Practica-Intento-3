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
  if (["Anticipo", "Retenciones"].includes(milestone.type)) return financialMilestonePayments(project, milestone, invoices, state, cutoff);
  const ids = project.invoiceLinks.filter(l => l.milestoneId === milestone.id).map(l => l.invoiceId);
  if (project.simulation) {
    const linked = project.simulation.invoices.filter(invoice => ids.includes(invoice.id) && invoice.issued <= cutoff);
    if (!linked.length) return { available: false, paid: null, billed: null, completed: false, paidDate: null, payments: [], reason: "Sin facturas vinculadas" };
    const payments = linked.flatMap(invoice => invoice.payments.filter(payment => payment.date <= cutoff).map(payment => ({ id: payment.id, date: payment.date, amount: payment.amountUF, invoiceId: invoice.id, invoiceNumber: invoice.number }))).sort((a, b) => a.date.localeCompare(b.date));
    const paid = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const billed = linked.reduce((sum, invoice) => sum + invoice.amountUF, 0);
    const completed = milestone.invoicingComplete === true && linked.length === ids.length && billed > 0 && paid >= billed;
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
  const completed = milestone.invoicingComplete === true && linked.length === ids.length && billed > 0 && paid >= billed;
  let paidDate: string | null = null, accumulated = 0;
  if (completed) for (const p of payments) { accumulated += p.amount; paidDate = accumulated >= billed ? paidDate || p.date : null; }
  return { available: true, paid, billed, completed, paidDate, payments, reason: completed ? "Cobro completo" : paid > 0 ? "Cobro parcial" : "Pendiente de cobro" };
}

function financialMilestonePayments(project: Project, milestone: Milestone, invoices: FacturaCalculada[], state: DataState, cutoff: string) {
  const ids = [...new Set(project.invoiceLinks.filter(l => l.milestoneId === milestone.id).map(l => l.invoiceId))];
  const missing = (reason: string) => ({ available: false, paid: null, billed: null, completed: false, paidDate: null, payments: [], reason });
  if (!ids.length) return missing("Sin facturas vinculadas");
  if (!project.simulation && state !== "ready") return missing("CxC no disponible");
  const source = project.simulation ? project.simulation.invoices.map(i => ({ id: i.id, number: i.number, issued: i.issued, total: i.amountUF, cancelled: false, partial: false, payments: i.payments.map(p => ({ date: p.date, amount: p.amountUF })) })) : invoices.map(i => ({
    id: i.id, number: i.numero, issued: i.fechaEmision, cancelled: Boolean(i.anulada), partial: Boolean("informacionParcial" in i && i.informacionParcial),
    total: Math.max(0, i.monto - i.notasCredito.filter(n => n.fecha <= cutoff).reduce((s, n) => s + n.monto, 0) + i.notasDebito.filter(n => n.fecha <= cutoff).reduce((s, n) => s + n.monto, 0)),
    payments: i.pagos.map(p => ({ date: p.fechaPago, amount: p.monto }))
  }));
  if (ids.some(id => !source.some(i => i.id === id && !i.partial))) return missing("Información de cobros incompleta");
  const linked = source.filter(i => ids.includes(i.id) && !i.cancelled && (!i.issued || i.issued <= cutoff));
  const payments = linked.flatMap(i => i.payments.filter(p => p.date <= cutoff).map((p, index) => ({ ...p, id: `${i.id}-${index}`, invoiceId: i.id, invoiceNumber: i.number }))).sort((a, b) => a.date.localeCompare(b.date));
  const paid = payments.reduce((s, p) => s + p.amount, 0), billed = linked.reduce((s, i) => s + i.total, 0);
  const factor = project.simulation ? project.currency === "UF" ? 1 : 1 / project.simulation.ufValue : project.currency === "UF" ? project.ufValue : 1;
  const agreed = milestone.cashAmount != null && milestone.cashAmount > 0 && factor != null && factor > 0 ? Math.round(milestone.cashAmount * factor * 100) / 100 : null;
  const target = agreed === null ? null : Math.max(agreed, billed);
  const allPaid = linked.length > 0 && linked.every(i => i.payments.filter(p => p.date <= cutoff).reduce((s, p) => s + p.amount, 0) >= i.total);
  const future = source.some(i => ids.includes(i.id) && !i.cancelled && i.issued > cutoff);
  const completed = !future && allPaid && target !== null && paid >= target;
  let paidDate: string | null = null, accumulated = 0;
  if (completed) for (const p of payments) { accumulated += p.amount; if (accumulated >= target!) paidDate ||= p.date; else paidDate = null; }
  const reason = agreed === null ? "Monto o conversión UF por verificar" : completed ? milestone.type === "Retenciones" ? "Retenciones cobradas completamente" : "Anticipo completo recibido" : paid > 0 ? milestone.type === "Retenciones" ? "Retenciones cobradas parcialmente" : "Anticipo recibido parcialmente" : "Pendiente de cobro";
  return { available: true, paid, billed, completed, paidDate, payments, reason };
}
