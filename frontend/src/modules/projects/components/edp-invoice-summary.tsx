import type { FacturaCalculada } from "../../accounts-receivable/types";
import type { DataState, Project } from "../types";
import { edpInvoiceData } from "../data/edp-invoice-data";
import { amount, shortDate } from "../data/project-calculations";

export function EdpInvoiceSummary({ project, milestoneId, invoices, dataState }: { project: Project; milestoneId: string; invoices: FacturaCalculada[]; dataState: DataState }) {
  const data = edpInvoiceData(project, milestoneId, invoices, dataState);
  return <div className="project-full">
    <div className="project-edp-settlement"><strong>Total a cobrar ({data.currency}): {data.total == null ? "Pendiente de factura" : amount(data.total, data.currency)}</strong></div>
    {!data.linked ? <p className="project-note">Estos datos se completan al asociar una factura en «Facturas y estados de pago», después de guardar el EDP.</p> : !data.available ? <p className="project-note">Los datos de la factura asociada no están disponibles. Actualiza CxC para consultarlos.</p> : !data.rows.length ? <p className="project-note">Las facturas asociadas están anuladas.</p> : data.rows.map(i => <div key={i.id} className="project-date-strip">
      <div><span>Factura {i.number}</span><strong>{amount(i.amount, data.currency)}</strong></div>
      <div><span>Vencimiento de factura</span><strong>{shortDate(i.due || null)}</strong></div>
      <div><span>Cobro previsto vigente</span><strong>{shortDate(project.incomeDates?.[`invoice:${i.id}`] || i.due || null)}</strong></div>
      <div><span>Fecha de emisión de factura</span><strong>{shortDate(i.issued || null)}</strong></div>
    </div>)}
  </div>;
}
