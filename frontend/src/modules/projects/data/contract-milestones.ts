import type { FacturaCalculada } from "../../accounts-receivable/types";
import type { DataState, Milestone, Project } from "../types";
import { edpPayments } from "./project-history";

export function contractMilestones(project: Project, invoices: FacturaCalculada[], state: DataState, cutoff: string) {
  const financial = project.milestones.filter(m => ["Anticipo", "EDP", "Retenciones"].includes(m.type));
  const payments = new Map(financial.map(m => [m.id, edpPayments(project, m, invoices, state, cutoff)]));
  const paymentDate = (records: Milestone[]) => records.length && records.every(m => payments.get(m.id)?.completed) ? records.map(m => payments.get(m.id)!.paidDate!).sort().at(-1)! : null;
  const advances = financial.filter(m => m.type === "Anticipo");
  const retentions = financial.filter(m => m.type === "Retenciones");
  const edps = financial.filter(m => m.type === "EDP");
  const covered = project.contractAmount !== null && project.contractAmount > 0 && edps.length > 0 && edps.every(m => m.settlement) && Math.abs(edps.reduce((s, m) => s + m.settlement!.gross, 0) - project.contractAmount) <= 0.02;
  const released = retentions.length > 0 && retentions.every(m => m.actualDate && m.actualDate <= cutoff && m.evidence);
  const closureDate = covered && released && paymentDate(retentions) ? paymentDate(financial) : null;
  const signature = project.milestones.find(m => m.stageKey === "firma" || m.type === "Contrato");
  const signatureDate = project.signedDate && project.signedDate <= cutoff ? project.signedDate : null;
  const dates = (records: Milestone[], key: "baselineCashDate" | "cashDate") => records.length && records.every(m => m[key]) ? records.map(m => m[key]!).sort().at(-1)! : null;
  return [
    { key: "firma", name: "Firma del contrato", actual: signatureDate, base: signature?.baselineDate || project.signedDate, forecast: project.signedDate,
      detail: signatureDate ? "Inicio contractual confirmado." : "Firma pendiente al corte seleccionado." },
    { key: "anticipo", name: "Anticipo", actual: paymentDate(advances), base: dates(advances, "baselineCashDate"), forecast: dates(advances, "cashDate"),
      detail: paymentDate(advances) ? "Anticipo cobrado según las facturas vinculadas." : advances.length ? "Se cumple con el cobro total del anticipo. Revisa sus facturas y abonos." : "Registra el monto y la fecha esperada del anticipo." },
    { key: "retenciones", name: "Retenciones y cierre", actual: closureDate, base: dates(retentions, "baselineCashDate"), forecast: dates(retentions, "cashDate"),
      detail: closureDate ? "Retenciones liberadas y cobros completos de los EDP y facturas vinculadas." : !retentions.length ? "Programa la liberación y el cobro de las retenciones." : !covered ? "Verifica que los EDP cubran el contrato para evaluar el cierre financiero." : !released ? "Pendiente de acreditar la liberación de las retenciones." : "El cierre requiere cobrar las retenciones y resolver los demás saldos del proyecto." }
  ];
}
