import type { IncomeRow } from "../data/income-projection";

export function InvoiceCoverageWarning({ rows }: { rows: IncomeRow[] }) {
  const groups = [...new Map(rows.filter(r => r.invoiceCoverage?.missing.length).map(r => [`${r.project.id}/${r.milestoneId}`, r])).values()];
  if (!groups.length) return null;
  return <div className="project-full" role="status">{groups.map(row => <p className="project-note" key={`${row.project.id}/${row.milestoneId}`}>
    <strong>{row.project.name} · {row.project.milestones.find(m => m.id === row.milestoneId)?.name}: información incompleta.</strong>{" "}
    {row.invoiceCoverage!.verified} de {row.invoiceCoverage!.expected} facturas verificadas. Pendientes de verificar (folio o identificador): {row.invoiceCoverage!.missing.join(", ")}.
    Los montos y saldos conocidos son parciales; no representan el total. Sin vencimiento conocido no se asigna un período a la factura faltante. Actualiza CxC para completar la información.
  </p>)}</div>;
}
