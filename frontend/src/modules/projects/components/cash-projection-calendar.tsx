import type { FacturaCalculada } from "../../accounts-receivable/types";
import type { DataState, Project } from "../types";
import { financialPlanning } from "../data/financial-planning";
import { amount, shortDate } from "../data/project-calculations";
import { AppLink } from "../../../shared/components/app-link";
import "../contract-process.css";

export function CashProjectionCalendar({ project, invoices, dataState, cutoff, year }: { project: Project; invoices: FacturaCalculada[]; dataState: DataState; cutoff: string; year: number }) {
  const report = financialPlanning([project], invoices, dataState, cutoff);
  const dated = report.rows.filter(r => r.date?.startsWith(String(year))).sort((a, b) => a.date!.localeCompare(b.date!));
  const months = [...new Set(dated.map(r => r.date!.slice(0, 7)))];
  const unknownDates = report.rows.filter(r => !r.date);
  return <section className="project-panel"><div className="project-panel-heading"><div><span className="project-eyebrow">PROYECCIÓN DEL PROYECTO · {year}</span><h2>Calendario de ingresos</h2><p>{project.edpPlan ? `Programación basada en: ${project.edpPlan.reference}` : "Proyección vigente. Registra el primer EDP presentado y confirma su programación en Estados de pago."}</p></div></div>
    <div className="project-cash-calendar">{months.map(month => {
      const rows = dated.filter(r => r.date!.startsWith(month));
      const remaining = rows.every(r => r.remaining !== null) ? rows.reduce((s, r) => s + r.remaining!, 0) : null;
      const label = new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
      return <article className="project-cash-month" key={month}><div><strong>{label}</strong><small>Pendiente en CLP</small><strong>{amount(remaining)}</strong></div><div>{rows.map(r => <AppLink key={r.milestone.id} className="project-button" href={`/proyectos?proyecto=${encodeURIComponent(project.id)}&vista=edps&edp=${encodeURIComponent(r.milestone.id)}`}><span><strong>{shortDate(r.date)} · {r.milestone.name}</strong><small>{r.stage}{r.overdue ? " · fecha de cobro por reprogramar" : ""}</small><small>Base: {shortDate(r.baseDate)} · {amount(r.milestone.baselineCashAmount, project.currency)}</small></span><span>{amount(r.milestone.cashAmount, project.currency)}<small>Neto programado</small></span></AppLink>)}</div></article>;
    })}{!months.length && <p>No hay cobros programados para {year}. Revisa el año visible o completa las fechas de los EDP.</p>}</div>
    {unknownDates.length > 0 && <p className="project-footnote">{unknownDates.length} cobros aún sin fecha: {unknownDates.map(r => r.milestone.name).join(", ")}.</p>}
    <p className="project-footnote">El neto programado se expresa en la moneda contractual. El saldo pendiente en pesos descuenta los pagos vinculados; requiere información de CxC y, para montos en UF aún no facturados, el supuesto UF del proyecto.</p>
  </section>;
}
