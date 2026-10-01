import { invoiceTotals, presentedTotals } from "../data/revenue-uf";
import { useEffect, useState } from "react";
import { loadHistoricalUf } from "../data/projects-api";
import { CircleDollarSign, ReceiptText } from "lucide-react";
import type { FacturaCalculada } from "../../accounts-receivable/types";
import type { DataState, Project } from "../types";
import { amount, shortDate } from "../data/project-calculations";


export function ProjectOverview({ project, invoices, dataState, cutoff }: { project: Project; invoices: FacturaCalculada[]; dataState: DataState; cutoff: string }) {
  const years = project.simulation ? "" : [...new Set(invoices.filter(i => i.fechaEmision <= cutoff && project.invoiceLinks.some(l => l.invoiceId === i.id)).map(i => i.fechaEmision.slice(0, 4)))].sort().join(",");
  const [uf, setUf] = useState<{ key: string; rates: Record<string, number>; error: string }>({ key: "", rates: {}, error: "" });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setUf({ key: "", rates: {}, error: "" });
    if (!years) { setUf({ key: years, rates: {}, error: "" }); return; }
    Promise.all(years.split(",").map(loadHistoricalUf)).then(results => {
      if (active) setUf({ key: years, rates: Object.assign({}, ...results.map(r => r.rates)), error: "" });
    }).catch(() => { if (active) setUf({ key: years, rates: {}, error: "No se pudo obtener la UF histórica." }); });
    return () => { active = false; };
  }, [years, retry]);
  const rates = uf.key === years ? uf.rates : {};
  const totals = invoiceTotals(project, invoices, dataState, cutoff, rates);
  const pesos = invoiceTotals(project, invoices, dataState, cutoff, rates, "CLP");
  const missingUf = !project.simulation && invoices.some(i => i.fechaEmision <= cutoff && project.invoiceLinks.some(l => l.invoiceId === i.id) && !rates[i.fechaEmision]);
  const presented = presentedTotals(project, invoices, dataState, cutoff, rates);
  const format = (value: number | null, currency = project.currency) => value === null ? "—" : amount(value, currency);
  return <div className="project-overview-sections">
    <section className="project-overview-panel project-revenue-panel"><div className="project-overview-panel-heading"><div><span className="project-eyebrow">CONTROL FINANCIERO</span><h2>Recaudación</h2><p>Contraste entre EDP presentado, facturado y cobrado.</p></div><div className="project-overview-panel-meta"><CircleDollarSign size={21} /><small>Al corte {shortDate(cutoff)}</small></div></div><div className="project-revenue-rows"><RevenueRow label="EDP presentado" value={format(presented.uf, "UF")} secondary={presented.clp === null ? "CLP pendiente de factura o UF" : `${format(presented.clp, "CLP")} CLP`} /><RevenueRow label="Facturado" value={format(totals.billed, "UF")} secondary={`${format(pesos.billed, "CLP")} CLP`} /><RevenueRow label="Cobrado" value={format(totals.paid, "UF")} secondary={`${format(pesos.paid, "CLP")} CLP`} accent /></div><div className="project-revenue-note"><ReceiptText size={14} />{pesos.paid === 0 ? "Sin cobros conciliados al corte." : "Cobros conciliados desde CxC."}</div></section>
    {!project.simulation && <p className="project-footnote">Facturado y cobrado usan la UF de emisión de cada factura. Para cada EDP se usa la fecha de emisión de su primera factura vinculada. Fuente: <a href="https://mindicador.cl" target="_blank" rel="noreferrer">Mindicador</a>.</p>}
    {missingUf && <p className="project-footnote" role="status">{uf.key !== years ? "Consultando UF histórica…" : uf.error || "Falta la UF de alguna fecha de emisión; no se muestra un total incompleto."} <button type="button" className="project-text-link" onClick={() => setRetry(v => v + 1)}>Reintentar</button></p>}
  </div>;
}

function RevenueRow({ label, value, secondary, accent = false }: { label: string; value: string; secondary?: string; accent?: boolean }) { return <div className={accent ? "is-accent" : ""}><span>{label}</span><div className="project-revenue-values"><strong>{value}</strong>{secondary && <small>{secondary}</small>}</div></div>; }
