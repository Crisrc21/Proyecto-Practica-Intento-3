import type { FacturaCalculada } from "../../accounts-receivable/types";
import type { DataState, Project } from "../types";
import { edpInvoiceData } from "../data/edp-invoice-data";
import { amount, shortDate, todayISO } from "../data/project-calculations";
import { FileText, Info } from "lucide-react";
import "../edp-detail.css";

export function EdpInvoiceSummary({ project, milestoneId, invoices, dataState, cutoff = todayISO() }: { project: Project; milestoneId: string; invoices: FacturaCalculada[]; dataState: DataState; cutoff?: string }) {
  const data = edpInvoiceData(project, milestoneId, invoices, dataState, cutoff);
  const milestone = project.milestones.find(m => m.id === milestoneId);
  const factor = project.currency === data.currency ? 1 : project.currency === "UF" ? project.ufValue : project.simulation ? 1 / project.simulation.ufValue : null;
  const planned = milestone?.cashAmount != null && factor ? milestone.cashAmount * factor : null;
  const variance = data.comparable && data.knownTotal !== null && planned !== null ? data.knownTotal - planned : null;
  return <div className="project-full edp-invoice-summary">
    <div className="edp-section-heading"><span className="edp-section-icon"><FileText size={18} aria-hidden="true" /></span><div><h3>EDP y facturación</h3><p>Comparación del estado de pago y sus facturas al corte</p></div></div>
    <div className="edp-comparison">
      <div className="edp-metric"><span>Total del EDP</span><strong>{amount(milestone?.cashAmount ?? null, project.currency)}</strong><small>Monto del estado de pago</small></div>
      <div className="edp-metric"><span>{data.comparable ? "Total facturado" : "Facturación conocida · parcial"}</span><strong>{data.knownTotal === null ? "Por verificar" : amount(data.knownTotal, data.currency)}</strong><small>Incluye notas de crédito y débito</small></div>
      <div className={`edp-metric edp-variance${variance !== null && Math.abs(variance) > 0.01 ? " needs-review" : ""}`}><span>Diferencia facturas − EDP</span><strong>{variance === null ? "Por verificar" : amount(variance, data.currency)}</strong><small>{variance === null ? "Información pendiente" : Math.abs(variance) > 0.01 ? "Revisar diferencia" : "Montos coincidentes"}</small></div>
    </div>
    <div className="edp-comparison-note"><Info size={15} aria-hidden="true" /><div>{project.currency !== data.currency && <p>Comparación en {data.currency}: EDP convertido con la UF de proyección. Si falta la conversión, la diferencia queda por verificar.</p>}<p>Facturado no significa cobrado. La diferencia es informativa y no agrega ingresos ni modifica el EDP.</p></div></div>
    {!data.linked && <p className="project-note">Sin facturas vinculadas. Asocia las facturas en «Facturas y estados de pago».</p>}
    {!data.available && <p className="project-note" role="status"><strong>Información incompleta: {data.verified} de {data.expected} facturas verificadas.</strong> No se puede confirmar el total facturado. Actualiza CxC para completar los datos.</p>}
    {data.missing.map(id => <p className="project-note" key={id}>Factura vinculada (identificador {id}): datos pendientes de verificar. Monto y saldo desconocidos.</p>)}
    {data.afterCutoff.map(i => <p className="project-note" key={i.id}>Factura {i.number}: emitida después del corte; no se incluye en la comparación.</p>)}
    {data.linked && data.available && !data.rows.length && !data.afterCutoff.length && <p className="project-note">Las facturas asociadas están anuladas.</p>}
    {data.rows.map(i => <div key={i.id} className="project-date-strip edp-invoice-dates">
      <div><span>Factura {i.number} · monto al corte</span><strong>{amount(i.amount, data.currency)}</strong></div>
      <div><span>Vencimiento de factura</span><strong>{shortDate(i.due || null)}</strong></div>
      <div className="edp-expected-date"><span>Cobro previsto vigente</span><strong>{shortDate(project.incomeDates?.[`invoice:${i.id}`] || i.due || null)}</strong></div>
      <div><span>Fecha de emisión de factura</span><strong>{shortDate(i.issued || null)}</strong></div>
    </div>)}
  </div>;
}
