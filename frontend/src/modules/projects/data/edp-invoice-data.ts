import type { FacturaCalculada } from "../../accounts-receivable/types";
import type { DataState, Project } from "../types";

export function edpInvoiceData(project: Project, milestoneId: string, invoices: FacturaCalculada[], state: DataState) {
  const ids = project.invoiceLinks.filter(l => l.milestoneId === milestoneId).map(l => l.invoiceId);
  const source = project.simulation
    ? project.simulation.invoices.map(i => ({ id: i.id, number: i.number, amount: i.amountUF, issued: i.issued, due: i.due, cancelled: false }))
    : invoices.map(i => ({ id: i.id, number: i.numero, amount: i.monto, issued: i.fechaEmision, due: i.fechaVencimiento, cancelled: Boolean(i.anulada) }));
  const available = (Boolean(project.simulation) || state === "ready") && ids.every(id => source.some(i => i.id === id));
  const rows = available ? source.filter(i => ids.includes(i.id) && !i.cancelled) : [];
  return { rows, available, linked: ids.length > 0, currency: project.simulation ? "UF" as const : "CLP" as const,
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
