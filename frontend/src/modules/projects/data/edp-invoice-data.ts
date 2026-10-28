import type { FacturaCalculada } from "../../accounts-receivable/types";
import type { DataState, Project } from "../types";

export function edpInvoiceData(project: Project, milestoneId: string, invoices: FacturaCalculada[], state: DataState, cutoff = "9999-12-31") {
  const ids = project.invoiceLinks.filter(l => l.milestoneId === milestoneId).map(l => l.invoiceId);
  const source = project.simulation
    ? project.simulation.invoices.map(i => ({ id: i.id, number: i.number, amount: i.amountUF, issued: i.issued, due: i.due, cancelled: false, partial: false }))
    : invoices.map(i => ({ id: i.id, number: i.numero, amount: Math.max(0, i.monto - (i.notasCredito || []).filter(n => n.fecha <= cutoff).reduce((s,n) => s+n.monto,0) + (i.notasDebito || []).filter(n => n.fecha <= cutoff).reduce((s,n) => s+n.monto,0)), issued: i.fechaEmision, due: i.fechaVencimiento, cancelled: Boolean(i.anulada), partial: Boolean("informacionParcial" in i && i.informacionParcial) }));
  const accessible = Boolean(project.simulation) || state === "ready";
  const missing = ids.filter(id => !accessible || !source.some(i => i.id === id && !i.partial));
  const available = missing.length === 0;
  const rows = accessible ? source.filter(i => ids.includes(i.id) && !i.cancelled && !i.partial && i.issued <= cutoff) : [];
  const afterCutoff = accessible ? source.filter(i => ids.includes(i.id) && i.issued > cutoff) : [];
  const comparable = available && afterCutoff.length === 0;
  return { rows, available, comparable, missing, afterCutoff, expected: ids.length, verified: ids.length - missing.length,
    knownTotal: rows.length ? rows.reduce((sum,i) => sum+i.amount,0) : null,
    linked: ids.length > 0, currency: project.simulation ? "UF" as const : "CLP" as const,
    total: available && rows.length ? rows.reduce((sum, i) => sum + i.amount, 0) : null };
}

export function withInvoiceDates(project: Project, invoices: FacturaCalculada[], state: DataState): Project {
  return { ...project, milestones: project.milestones.map(m => {
    if (!m.edp?.documentOnly) return m;
    const data = edpInvoiceData(project, m.id, invoices, state);
    if (!data.available || !data.rows.length) return m;
    const due = data.rows.map(i => i.due).filter(Boolean).sort().at(-1);
    // Invoice issuance does not establish when the EDP was presented or approved.
    return { ...m, cashDate: due || null };
  }) };
}
