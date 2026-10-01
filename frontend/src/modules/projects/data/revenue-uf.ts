import type { FacturaCalculada } from "../../accounts-receivable/types";
import type { Project, DataState } from "../types";

export function invoiceTotals(project: Project, invoices: FacturaCalculada[], state: DataState, cutoff: string, rates: Record<string, number>, currency: "UF" | "CLP" = "UF") {
  const ids = new Set(project.invoiceLinks.map(link => link.invoiceId));
  if (project.simulation) {
    const issued = project.simulation.invoices.filter(invoice => invoice.issued <= cutoff);
    const factor = currency === "CLP" ? project.simulation.ufValue : 1;
    return {
      billed: issued.reduce((sum, invoice) => sum + invoice.amountUF * factor, 0),
      paid: issued.reduce((sum, invoice) => sum + invoice.payments.filter(payment => payment.date <= cutoff).reduce((subtotal, payment) => subtotal + payment.amountUF * factor, 0), 0)
    };
  }
  if (state !== "ready" || !ids.size) return { billed: null, paid: null };
  const allLinked = invoices.filter(invoice => ids.has(invoice.id));
  if (allLinked.length !== ids.size) return { billed: null, paid: null };
  const linked = allLinked.filter(invoice => invoice.fechaEmision <= cutoff);
  if (currency === "UF" && linked.some(invoice => !rates[invoice.fechaEmision])) return { billed: null, paid: null };
  const billed = linked.reduce((sum, invoice) => sum + (invoice.anulada ? 0 : Math.max(0, invoice.monto - invoice.notasCredito.filter(note => note.fecha <= cutoff).reduce((s, note) => s + note.monto, 0) + invoice.notasDebito.filter(note => note.fecha <= cutoff).reduce((s, note) => s + note.monto, 0)) / (currency === "CLP" ? 1 : rates[invoice.fechaEmision])), 0);
  const paid = linked.reduce((sum, invoice) => sum + invoice.pagos.filter(payment => payment.fechaPago <= cutoff).reduce((s, payment) => s + payment.monto, 0) / (currency === "CLP" ? 1 : rates[invoice.fechaEmision]), 0);
  return { billed, paid };
}

export function presentedTotals(project: Project, invoices: FacturaCalculada[], state: DataState, cutoff: string, rates: Record<string, number>) {
  let original = 0, converted = 0, complete = true;
  const edps = project.milestones.filter(m => ["EDP", "Anticipo", "Retenciones"].includes(m.type) && m.edp?.presentedDate && m.edp.presentedDate <= cutoff);
  for (const m of edps) {
    if (m.cashAmount == null) { complete = false; continue; }
    original += m.cashAmount;
    if (m.cashAmount === 0) continue;
    const ids = new Set(project.invoiceLinks.filter(l => l.milestoneId === m.id).map(l => l.invoiceId));
    // Each EDP uses its first associated invoice's issue date as the reference.
    const linked = invoices.filter(i => ids.has(i.id) && !i.anulada && i.fechaEmision <= cutoff).sort((a,b) => a.fechaEmision.localeCompare(b.fechaEmision));
    const rate = project.simulation?.ufValue || (state === "ready" && linked.length && rates[linked[0].fechaEmision]);
    if (!rate || (!project.simulation && [...ids].some(id => !invoices.some(i => i.id === id)))) { complete = false; continue; }
    converted += project.currency === "UF" ? m.cashAmount * rate : m.cashAmount / rate;
  }
  const known = edps.every(m => m.cashAmount != null);
  return { uf: project.currency === "UF" ? known ? original : null : complete ? converted : null, clp: project.currency === "CLP" ? known ? original : null : complete ? converted : null };
}
