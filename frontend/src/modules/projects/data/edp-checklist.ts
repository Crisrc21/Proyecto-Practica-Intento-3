import type { FacturaCalculada } from "../../accounts-receivable/types";
import type { DataState, Milestone, Project } from "../types";
import { edpPayments } from "./project-history";

export function edpChecklist(project: Project, milestone: Milestone, invoices: FacturaCalculada[], state: DataState, cutoff: string) {
  const ids = project.invoiceLinks.filter(l => l.milestoneId === milestone.id).map(l => l.invoiceId);
  const advance = Boolean(milestone.name.trim() && milestone.cashAmount !== null && Number.isFinite(milestone.cashAmount));
  const linked = ids.length > 0;
  if (["Anticipo", "Retenciones"].includes(milestone.type)) return { advance, linked, paid: edpPayments(project, milestone, invoices, state, cutoff).completed };
  const paid = linked && (project.simulation ? ids.every(id => {
    const i = project.simulation!.invoices.find(item => item.id === id);
    return Boolean(i && i.issued <= cutoff && i.amountUF > 0 && i.payments.filter(p => p.date <= cutoff).reduce((sum, p) => sum + p.amountUF, 0) >= i.amountUF);
  }) : state === "ready" && ids.every(id => {
    const i = invoices.find(item => item.id === id);
    if (!i || i.anulada || i.fechaEmision > cutoff || i.estadoPago !== "Pagado") return false;
    if ("informacionParcial" in i && i.informacionParcial) return false;
    return !i.pagos.some(p => p.fechaPago > cutoff);
  }));
  return { advance, linked, paid };
}
