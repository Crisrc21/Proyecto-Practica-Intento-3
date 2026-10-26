import { HttpError } from "../../../shared/errors/http-error.js";

import { normalizeClassification } from "./contract-classification.js";

import { allProgress } from "./project-operations.js";

export const stages = [
  ["firma", "Contrato firmado", "General"], ["anticipo", "Anticipo", "General"],
  ["fabricacion", "Fabricación", "Fabricación"], ["despachos", "Despachos", "Despacho"],
  ["fundaciones", "Fundaciones", "Fundaciones"], ["montaje", "Montaje", "Montaje"],
  ["interior", "Urbanización interior", "Urbanización Interior"], ["exterior", "Urbanización exterior", "Urbanización Exterior"],
  ["calles", "Calles", "Calles"], ["otras", "Otras obras", "Otras obras"],
  ["total", "Avance total", "General"]
];
export const stageMetrics = {
  firma: ["firma"], anticipo: ["firma"], fabricacion: ["m2", "terminadas"], despachos: ["despachadas"],
  fundaciones: ["fundaciones", "fundacionesPct"], montaje: ["montadas"], interior: ["interiorPct"], exterior: ["exteriorPct"], calles: ["callesPct"], otras: ["otrasPct"], total: ["totalPct"]
};
export function activeStages(nature, includedWorks = []) {
  const p = normalizeClassification({ nature, includedWorks });
  return stages.filter(([key]) => !["interior", "exterior", "calles", "otras"].includes(key) || p.nature === "llave_en_mano" && p.includedWorks.includes(key));
}
export function latestReport(project, key) {
  return allProgress(project).filter(r => r.stageKey === key).sort((a, b) => a.date.localeCompare(b.date)).at(-1);
}
export function metricValue(project, condition) {
  if (condition.metric === "firma") return { value: project.signedDate ? 1 : null, date: project.signedDate };
  const r = latestReport(project, condition.stageKey);
  const field = condition.metric.endsWith("Pct") ? "percent" : condition.metric === "terminadas" ? "completedUnits" : "quantity";
  let reachedDate = null;
  for (const report of allProgress(project).filter(item => item.stageKey === condition.stageKey).sort((a,b) => a.date.localeCompare(b.date))) {
    reachedDate = report[field] !== null && report[field] >= condition.threshold ? reachedDate || report.date : null;
  }
  return { value: r?.[field] ?? null, date: reachedDate ?? r?.date ?? null };
}
export function stagePercent(project, key, r = latestReport(project, key)) {
  if (!r) return null;
  if (["interior", "exterior", "calles", "otras", "total", "fundaciones"].includes(key)) return r.percent;
  const target = key === "fabricacion" ? project.areaM2 : project.units;
  return target > 0 && r.quantity !== null ? r.quantity / target * 100 : null;
}
const fail = message => { throw new HttpError(400, message); };

// Validate documentary EDP transitions independently of the contractual classification.
export function applyWorkflow(previous, project) {
  const lifecycle = project.lifecycle;
  if (previous && (previous.lifecycle || "Firmado") === "Firmado" && lifecycle === "Potencial") fail("Un contrato firmado no puede volver a potencial.");
  const previousReports = previous?.progressReports || [];
  if (previousReports.some((r, i) => JSON.stringify(r) !== JSON.stringify(project.progressReports[i]))) fail("Los avances registrados se conservan. Agrega un nuevo corte para corregirlos.");
  for (const old of previous?.milestones || []) {
    if (old.edp && ["Presentado", "Aprobado"].includes(old.edp.status) && !project.milestones.find(m => m.id === old.id)?.edp) fail("Los EDP presentados o aprobados se conservan con su condición y evidencia.");
  }
  if (lifecycle === "Potencial") {
    if (!project.customer) fail("Indica el mandante del potencial contrato.");
    if (project.milestones.length || project.invoiceLinks.length || project.progressReports.length) fail("Firma el contrato antes de registrar hitos, EDP o facturas.");
    return;
  }
  if ((project.nature || previous?.lifecycle === "Potencial") && !project.signedDate) fail("Indica la fecha de firma del contrato.");
  // Classification describes the contract; existing records are preserved without creating physical stages.
  for (const m of project.milestones.filter(m => m.edp)) {
    const old = previous?.milestones.find(item => item.id === m.id);
    const edp = m.edp;
    const order = ["Previsto", "Preparado", "Presentado", "Aprobado"];
    if (old?.edp && order.indexOf(old.edp.status) >= 2) {
      if (order.indexOf(edp.status) < order.indexOf(old.edp.status)) fail("Un EDP presentado o aprobado conserva su estado documental.");
      if (["stageKey", "metric", "threshold", "documentOnly"].some(k => edp[k] !== old.edp[k])) fail("La condición de un EDP presentado se conserva.");
    }
    if (["Presentado", "Aprobado"].includes(edp.status)) {
      if (edp.documentOnly && !m.source.trim()) fail("Indica la referencia del documento presentado.");
      if (!edp.presentedDate) fail("Indica la fecha de presentación del EDP.");
      if (edp.status === "Aprobado" && (!edp.approvedDate || !edp.approvalEvidence)) fail("La aprobación requiere fecha y referencia a la carpeta de aprobados.");
      if (edp.approvedDate && edp.approvedDate < edp.presentedDate) fail("La aprobación no puede ser anterior a la presentación.");
    }
    m.actualDate = edp.status === "Aprobado" ? edp.approvedDate : null;
    m.evidence = edp.status === "Aprobado" ? edp.approvalEvidence : "";
  }
  if (project.milestones.length > 500) fail("El proyecto supera el máximo de 500 hitos, incluidas las etapas.");
}
