import type { Milestone, ProgressMetric, Project, StageKey } from "../types";

export interface EdpBatch {
  stageKey: StageKey; metric: ProgressMetric; from: number; remaining: number; perEdp: number;
  gross: number; retentionPercent: number; recoveryPercent: number;
  taxMode?: "iva19-ceec309";
  approvalDate: string; intervalDays: number; paymentDays: number;
}
const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const scopes: Partial<Record<StageKey, Milestone["scope"]>> = {
  fabricacion: "Fabricación", despachos: "Despacho", fundaciones: "Fundaciones", montaje: "Montaje",
  interior: "Urbanización Interior", exterior: "Urbanización Exterior", calles: "Calles", otras: "Otras obras", total: "General"
};
function physicalDetail(stageKey: StageKey, metric: ProgressMetric) {
  if (stageKey === "fabricacion") return "Viviendas";
  if (stageKey === "interior") return "Urbanización interior";
  if (stageKey === "exterior") return "Urbanización exterior";
  if (stageKey === "despachos") return "Despachos";
  if (stageKey === "fundaciones") return "Fundaciones";
  if (stageKey === "montaje") return "Montaje";
  return metric.endsWith("Pct") ? "Obra" : scopes[stageKey] || "Avance físico";
}
function physicalUnit(metric: ProgressMetric) {
  if (metric === "m2") return "m²";
  if (metric.endsWith("Pct")) return "%";
  return "casas";
}
export function metricTarget(project: Project, metric: ProgressMetric) {
  return metric.endsWith("Pct") ? 100 : metric === "m2" ? project.areaM2 ?? 0 : project.units;
}
export function buildEdpBatch(project: Project, batch: EdpBatch, existing: Milestone[]): Milestone[] {
  const fail = (message: string): never => { throw new Error(message); };
  if (!scopes[batch.stageKey] || batch.metric === "firma") fail("Selecciona una partida de avance físico.");
  const numbers = [batch.from, batch.remaining, batch.perEdp, batch.gross, batch.retentionPercent, batch.recoveryPercent, batch.intervalDays, batch.paymentDays];
  if (numbers.some(n => !Number.isFinite(n) || n < 0) || batch.remaining <= 0 || batch.perEdp <= 0 || batch.gross <= 0) fail("Completa cantidades y monto bruto mayores que cero.");
  if (batch.recoveryPercent > 100) fail("La recuperación del anticipo no puede superar el bruto.");
  if (!Number.isInteger(batch.intervalDays) || batch.intervalDays < 1 || !Number.isInteger(batch.paymentDays)) fail("Los plazos deben ser días enteros; el intervalo debe ser mayor que cero.");
  if (!batch.metric.endsWith("Pct") && batch.metric !== "m2" && [batch.from, batch.remaining, batch.perEdp].some(n => !Number.isInteger(n))) fail("Las cantidades de casas deben ser enteras.");
  const target = metricTarget(project, batch.metric);
  if (target <= 0 || batch.from + batch.remaining > target + 0.000001) fail("El avance programado supera la cantidad contratada o falta definir la superficie.");
  const previous = existing.filter(m => m.type === "EDP" && !m.edp?.documentOnly && m.edp?.stageKey === batch.stageKey && m.edp.metric === batch.metric);
  const greatest = Math.max(0, ...previous.map(m => m.edp!.threshold));
  if (Math.abs(batch.from - greatest) > 0.000001) fail(`El avance inicial debe continuar desde ${greatest}, ya considerado en los EDP existentes.`);
  const count = Math.ceil(batch.remaining / batch.perEdp - 1e-10);
  if (count < 1 || count + existing.length > 450) fail("La programación supera el máximo de 450 registros. Aumenta el avance por EDP.");
  const date = new Date(`${batch.approvalDate}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== batch.approvalDate || project.signedDate && batch.approvalDate < project.signedDate) fail("Indica una fecha de aprobación válida posterior a la firma.");
  const firstPresented = project.milestones.filter(m => m.type === "EDP" && m.edp?.presentedDate).map(m => m.edp!.presentedDate!).sort()[0];
  if (firstPresented && batch.approvalDate < firstPresented) fail("Los siguientes EDP deben programarse desde la presentación del primero.");
  const at = (days: number) => new Date(date.getTime() + days * 86400000).toISOString().slice(0, 10);
  let allocated = 0;
  return Array.from({ length: count }, (_, index) => {
    const quantity = Math.min(batch.perEdp, batch.remaining - index * batch.perEdp);
    const rounding = batch.taxMode ? Math.round : round;
    const gross = index === count - 1 ? rounding(batch.gross - allocated) : rounding(batch.gross * quantity / batch.remaining);
    allocated = round(allocated + gross);
    // Las retenciones se registran como un EDP independiente de liberación.
    const retention = batch.taxMode ? rounding(gross * 0.05) : 0, advanceRecovery = rounding(gross * (batch.taxMode ? 20 : batch.recoveryPercent) / 100);
    const net = rounding(gross - advanceRecovery - retention);
    const cashAmount = batch.taxMode ? net + Math.round(net * 0.19) - Math.round(net * 0.0309) : net;
    if (cashAmount < 0) fail("El redondeo de descuentos supera el bruto. Ajusta la distribución.");
    const threshold = Number((batch.from + Math.min(batch.remaining, (index + 1) * batch.perEdp)).toFixed(6));
    const forecastDate = at(index * batch.intervalDays), cashDate = at(index * batch.intervalDays + batch.paymentDays);
    return {
      id: crypto.randomUUID(), name: `EDP N.º ${existing.filter(m => m.type === "EDP").length + index + 1} · ${physicalDetail(batch.stageKey, batch.metric)} · ${Number(quantity.toFixed(6)).toLocaleString("es-CL")} ${physicalUnit(batch.metric)}`,
      type: "EDP", scope: scopes[batch.stageKey]!, startDate: null, baselineDate: forecastDate, forecastDate,
      actualDate: null, baselineApproved: true, state: "Pendiente", evidence: "", source: "Programación desde el primer EDP presentado",
      notes: `Avance del período programado: ${Number(quantity.toFixed(6))}. Acumulado requerido: ${threshold}.`,
      cashAmount, cashDate, baselineCashAmount: cashAmount, baselineCashDate: cashDate,
      settlement: { gross, retention, advanceRecovery, discounts: 0, penalties: 0, adjustments: 0, ...(batch.taxMode ? { taxMode: batch.taxMode } : {}) },
      edp: { stageKey: batch.stageKey, metric: batch.metric, threshold, status: "Previsto", triggeredDate: null, presentedDate: null, approvedDate: null, approvalEvidence: "" }
    };
  });
}

export function physicalPlan(project: Project) {
  const previous = new Map<string, number>();
  return project.milestones.filter(m => m.type === "EDP" && m.edp && !m.edp.documentOnly && m.edp.metric !== "firma")
    .sort((a, b) => a.edp!.stageKey.localeCompare(b.edp!.stageKey) || a.edp!.metric.localeCompare(b.edp!.metric) || a.edp!.threshold - b.edp!.threshold)
    .map(m => {
      const e = m.edp!, key = `${e.stageKey}/${e.metric}`, from = previous.get(key) || 0;
      previous.set(key, e.threshold);
      const target = metricTarget(project, e.metric);
      return { milestone: m, period: Math.max(0, e.threshold - from), percent: target > 0 ? e.threshold / target * 100 : null };
    });
}
