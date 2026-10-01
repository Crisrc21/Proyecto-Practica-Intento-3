import type { FacturaCalculada } from "../../accounts-receivable/types";
import type { DataState, EdpCondition, Milestone, ProgressMetric, ProgressReport, Project, StageKey } from "../types";

export const natures = [
  { id: "fabricacion_montaje", label: "Fabricación y Montaje" },
  { id: "llave_en_mano", label: "Completa" }
] as const;
export const additionalWorks = [
  { key: "interior", label: "Urbanización interior" }, { key: "exterior", label: "Urbanización exterior" },
  { key: "calles", label: "Calles" }, { key: "otras", label: "Otras obras" }
] as const;
export const stages: { key: StageKey; label: string; metrics: ProgressMetric[] }[] = [
  { key: "firma", label: "Contrato firmado", metrics: ["firma"] },
  { key: "anticipo", label: "Anticipo", metrics: ["firma"] },
  { key: "fabricacion", label: "Fabricación", metrics: ["m2", "terminadas"] },
  { key: "despachos", label: "Despachos", metrics: ["despachadas"] },
  { key: "fundaciones", label: "Fundaciones", metrics: ["fundacionesPct", "fundaciones"] },
  { key: "montaje", label: "Montaje", metrics: ["montadas"] },
  { key: "interior", label: "Urbanización interior", metrics: ["interiorPct"] },
  { key: "exterior", label: "Urbanización exterior", metrics: ["exteriorPct"] },
  { key: "calles", label: "Calles", metrics: ["callesPct"] },
  { key: "otras", label: "Otras obras", metrics: ["otrasPct"] },
  { key: "total", label: "Avance total", metrics: ["totalPct"] }
];
export const metricLabels: Record<ProgressMetric, string> = {
  firma: "Contrato firmado", m2: "m² fabricados", terminadas: "Casas terminadas", despachadas: "Casas despachadas",
  fundaciones: "Casas con fundación terminada", fundacionesPct: "% de fundaciones", montadas: "Casas montadas",
  interiorPct: "% de urbanización interior", exteriorPct: "% de urbanización exterior", callesPct: "% de calles", otrasPct: "% de otras obras", totalPct: "% de avance total"
};
export function activeStages(nature: Project["nature"], includedWorks: Project["includedWorks"] = []) {
  return stages.filter(s => !additionalWorks.some(w => w.key === s.key) || nature === "llave_en_mano" && includedWorks.some(key => key === s.key));
}
export function latestReport(p: Project, stage: StageKey, cutoff: string) {
  return [...(p.progressReports || []), ...(p.houseProgress || [])].filter(r => r.stageKey === stage && r.date <= cutoff).sort((a, b) => a.date.localeCompare(b.date)).slice(-1)[0];
}
export function metricValue(p: Project, edp: EdpCondition, cutoff: string) {
  if (edp.documentOnly) return null;
  if (edp.metric === "firma") return p.signedDate && p.signedDate <= cutoff ? 1 : null;
  const r = latestReport(p, edp.stageKey, cutoff);
  return r ? edp.metric.endsWith("Pct") ? r.percent : edp.metric === "terminadas" ? r.completedUnits : r.quantity : null;
}
export function physicalPercent(p: Project, stage: StageKey, cutoff: string) {
  if (stage === "firma") return p.signedDate && p.signedDate <= cutoff ? 100 : null;
  return reportPercent(p, stage, latestReport(p, stage, cutoff));
}
function reportPercent(p: Project, stage: StageKey, r: ProgressReport | undefined) {
  if (!r) return null;
  if (["fundaciones", "interior", "exterior", "calles", "otras", "total"].includes(stage)) return r.percent;
  const target = stage === "fabricacion" ? p.areaM2 : p.units;
  return target && r.quantity !== null ? Math.min(100, r.quantity / target * 100) : null;
}
export function advancePayment(p: Project, invoices: FacturaCalculada[], state: DataState, cutoff: string) {
  const advanceIds = p.milestones.filter(m => m.type === "Anticipo").map(m => m.id);
  const links = p.invoiceLinks.filter(l => advanceIds.includes(l.milestoneId));
  if (p.simulation) {
    const linked = p.simulation.invoices.filter(invoice => links.some(link => link.invoiceId === invoice.id));
    const paid = linked.reduce((sum, invoice) => sum + invoice.payments.filter(payment => payment.date <= cutoff).reduce((subtotal, payment) => subtotal + payment.amountUF, 0), 0);
    const billed = linked.reduce((sum, invoice) => sum + invoice.amountUF, 0);
    const allBilled = advanceIds.length > 0 && p.milestones.filter(m => advanceIds.includes(m.id)).every(m => m.invoicingComplete && links.some(l => l.milestoneId === m.id));
    const complete = allBilled && billed > 0 && paid >= billed;
    return { paid, billed, percent: allBilled && billed > 0 ? Math.min(100, Math.max(0, paid / billed * 100)) : null,
      label: complete ? "Anticipo pagado" : paid > 0 ? "Anticipo parcialmente pagado" : "Anticipo pendiente de pago" };
  }
  const linked = links.map(l => invoices.find(i => i.id === l.invoiceId));
  const available = state === "ready" && links.length > 0 && linked.every(i => i && !("informacionParcial" in i && i.informacionParcial));
  if (!available) return { paid: null, billed: null, percent: null, label: state !== "ready" ? "CxC no disponible" : "Sin facturas de anticipo vinculadas" };
  const paid = linked.reduce((sum, i) => sum + i!.pagos.filter(r => r.fechaPago <= cutoff).reduce((s, r) => s + r.monto, 0), 0);
  const billed = linked.reduce((sum, i) => sum + (i!.anulada ? 0 : Math.max(0, i!.monto - i!.notasCredito.filter(n => n.fecha <= cutoff).reduce((s, n) => s + n.monto, 0) + i!.notasDebito.filter(n => n.fecha <= cutoff).reduce((s, n) => s + n.monto, 0))), 0);
  const allBilled = advanceIds.length > 0 && p.milestones.filter(m => advanceIds.includes(m.id)).every(m => m.invoicingComplete && links.some(l => l.milestoneId === m.id));
  const complete = allBilled && billed > 0 && paid >= billed;
  return { paid, billed, percent: allBilled && billed > 0 ? Math.min(100, Math.max(0, paid / billed * 100)) : null,
    label: complete ? "Anticipo pagado" : paid > 0 ? allBilled ? "Anticipo parcialmente pagado" : "Cobros registrados · facturación por completar" : "Anticipo pendiente de pago" };
}
export function sortMilestones(a: Milestone, b: Milestone) {
  const ai = a.stageKey ? stages.findIndex(s => s.key === a.stageKey) : -1;
  const bi = b.stageKey ? stages.findIndex(s => s.key === b.stageKey) : -1;
  if (ai >= 0 || bi >= 0) return ai >= 0 && bi >= 0 ? ai - bi : ai >= 0 ? -1 : 1;
  return (a.forecastDate || a.baselineDate || "9999").localeCompare(b.forecastDate || b.baselineDate || "9999");
}

// Only a display projection. The persisted project keeps the original records.
export function workflowAtCutoff(p: Project, invoices: FacturaCalculada[], state: DataState, cutoff: string): Project {
  const advance = advancePayment(p, invoices, state, cutoff);
  let advanceDate: string | null = null;
  if (advance.percent === 100 && advance.billed !== null) {
    const ids = p.invoiceLinks.filter(l => p.milestones.some(m => m.id === l.milestoneId && m.type === "Anticipo")).map(l => l.invoiceId);
    const payments = p.simulation
      ? p.simulation.invoices.filter(i => ids.includes(i.id)).flatMap(i => i.payments.map(pay => ({ fechaPago: pay.date, monto: pay.amountUF }))).filter(pay => pay.fechaPago <= cutoff).sort((a, b) => a.fechaPago.localeCompare(b.fechaPago))
      : invoices.filter(i => ids.includes(i.id)).flatMap(i => i.pagos).filter(pay => pay.fechaPago <= cutoff).sort((a, b) => a.fechaPago.localeCompare(b.fechaPago));
    let total = 0;
    for (const pay of payments) { total += pay.monto; advanceDate = total >= advance.billed ? advanceDate || pay.fechaPago : null; }
  }
  return { ...p, milestones: p.milestones.map(m => {
    if (!m.stageKey) return m;
    if (m.stageKey === "anticipo") return { ...m, actualDate: advanceDate, evidence: advanceDate ? "Pagos de facturas de anticipo vinculadas en CxC" : "" };
    if (m.stageKey === "firma") return m;
    const percent = physicalPercent(p, m.stageKey, cutoff);
    let completion: ProgressReport | null = null;
    for (const report of [...(p.progressReports || []), ...(p.houseProgress || [])].filter(r => r.stageKey === m.stageKey && r.date <= cutoff).sort((a,b) => a.date.localeCompare(b.date))) {
      completion = reportPercent(p, m.stageKey, report) === 100 ? completion || report : null;
    }
    return { ...m, actualDate: completion?.date ?? null, evidence: completion?.evidence ?? "", state: percent !== null && percent > 0 ? "En curso" : "Pendiente" };
  }) };
}
