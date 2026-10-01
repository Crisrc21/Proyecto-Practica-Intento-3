import type { FacturaCalculada } from "../../accounts-receivable/types";
import type { DataState, Project } from "../types";

const round = (n: number) => Math.round(n * 100) / 100;
const sum = (values: number[]) => round(values.reduce((a, b) => a + b, 0));
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);

// Amounts are CLP. Simulation UF payments use only the scenario's explicit conversion assumption.
export function financialPlanning(projects: Project[], invoices: FacturaCalculada[], state: DataState, cutoff: string) {
  const active = projects.filter(p => p.lifecycle !== "Potencial");
  const rows = active.flatMap(project => project.milestones.filter(m => ["EDP", "Anticipo", "Retenciones"].includes(m.type)).map(m => {
    const ids = project.invoiceLinks.filter(l => l.milestoneId === m.id).map(l => l.invoiceId);
    const converted = project.simulation
      ? project.simulation.invoices.map(i => ({ id: i.id, issued: i.issued, total: i.amountUF * project.simulation!.ufValue, partial: false, payments: i.payments.map(p => ({ date: p.date, amount: p.amountUF * project.simulation!.ufValue })) }))
      : invoices.map(i => ({ id: i.id, issued: i.fechaEmision, total: i.anulada ? 0 : Math.max(0, i.monto - sum(i.notasCredito.filter(n => n.fecha <= cutoff).map(n => n.monto)) + sum(i.notasDebito.filter(n => n.fecha <= cutoff).map(n => n.monto))), partial: Boolean("informacionParcial" in i && i.informacionParcial), payments: i.pagos.map(p => ({ date: p.fechaPago, amount: p.monto })) }));
    const linked = ids.map(id => converted.find(i => i.id === id));
    const available = (Boolean(project.simulation) || state === "ready") && linked.every(i => i && !i.partial);
    const issued = linked.filter((i): i is typeof converted[number] => Boolean(i && (!i.issued || i.issued <= cutoff)));
    const payments = issued.flatMap(i => i.payments.filter(p => p.date <= cutoff));
    const paid = available ? sum(payments.map(p => p.amount)) : null;
    const billed = available ? sum(issued.map(i => i.total)) : null;
    const factor = project.currency === "UF" ? project.simulation?.ufValue || project.ufValue : 1;
    const planned = m.cashAmount !== null && factor ? round(m.cashAmount * factor) : null;
    const fullyBilled = available && ids.length > 0 && issued.length === ids.length && m.invoicingComplete === true;
    // Partially billed EDPs keep the unbilled remainder; invoices never add on top of the same EDP.
    const remaining = !available || paid === null || billed === null ? null : fullyBilled ? round(Math.max(0, billed - paid)) : planned === null ? null : round(Math.max(0, Math.max(planned, billed) - paid));
    const approved = Boolean((m.edp?.approvedDate || (!m.edp ? m.actualDate : null)) && (m.edp?.approvedDate || m.actualDate)! <= cutoff);
    const presented = Boolean(m.edp?.presentedDate && m.edp.presentedDate <= cutoff);
    const prepared = Boolean(m.edp?.triggeredDate && m.edp.triggeredDate <= cutoff);
    const stage = !available ? "CxC por verificar" : fullyBilled && remaining === 0 && paid! > 0 ? "Cobrado" : fullyBilled && remaining === 0 ? "Sin saldo exigible" : fullyBilled ? "Facturado" : issued.length ? "Facturación parcial" : approved ? "Aprobado por facturar" : presented ? "EDP por aprobar" : prepared ? "EDP por presentar" : m.type === "Retenciones" ? "Liberación pendiente" : "Avance por acreditar";
    const base = m.baselineApproved && m.baselineCashAmount !== null && factor ? round(m.baselineCashAmount * factor) : null;
    const overdue = Boolean(m.cashDate && m.cashDate < cutoff && (remaining === null || remaining > 0));
    return { project, milestone: m, date: m.cashDate, baseDate: m.baselineCashDate, base, planned, remaining, paid, billed, payments, available, stage, overdue };
  }));
  const monday = addDays(cutoff, -((new Date(`${cutoff}T00:00:00Z`).getUTCDay() + 6) % 7));
  const weeks = Array.from({ length: 8 }, (_, index) => {
    const start = addDays(monday, index * 7), end = addDays(start, 6);
    const scheduled = rows.filter(r => r.date && r.date >= cutoff && r.date >= start && r.date <= end);
    return { start, end, total: sum(scheduled.map(r => r.remaining ?? 0)), unknown: scheduled.filter(r => r.remaining === null).length,
      invoiced: sum(scheduled.filter(r => r.stage === "Facturado").map(r => r.remaining ?? 0)), conditional: sum(scheduled.filter(r => r.stage !== "Facturado").map(r => r.remaining ?? 0)) };
  });
  const month = cutoff.slice(0, 7);
  const monthRows = rows.filter(r => r.date?.startsWith(month) && r.date >= cutoff);
  const sourceComplete = active.length > 0 && active.every(p => (p.simulation || state === "ready") && p.invoiceLinks.length > 0) && rows.every(r => r.available);
  const actual = sourceComplete ? sum(rows.flatMap(r => r.payments.filter(p => p.date.startsWith(month)).map(p => p.amount))) : null;
  const pending = sum(monthRows.map(r => r.remaining ?? 0));
  const unplanned = rows.filter(r => r.remaining === null || r.remaining > 0 && !r.date);
  const late = rows.filter(r => r.overdue);
  const baselineRows = rows.filter(r => r.baseDate?.startsWith(month));
  const baselineComplete = rows.length > 0 && rows.every(r => r.base !== null && r.baseDate);
  const baseline = baselineComplete ? sum(baselineRows.map(r => r.base!)) : null;
  const estimate = actual === null || unplanned.length || late.length ? null : round(actual + pending);
  return { rows, weeks, month, actual, pending, baseline, estimate, overdue: late, overdueAmount: sum(late.map(r => r.remaining ?? 0)), unplanned };
}
