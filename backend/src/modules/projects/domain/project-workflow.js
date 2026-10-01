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

// This runs inside the revision-checked transaction. Stage completion and EDP preparation
// are derived from saved evidence; neither operation creates an invoice or a receipt.
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
  if (!project.nature) {
    if (previous?.nature || project.progressReports.length || project.milestones.some(m => m.stageKey || m.edp)) fail("Selecciona una naturaleza para gestionar las etapas del contrato.");
    if (previous?.lifecycle === "Potencial" && !project.signedDate) fail("Indica la fecha de firma del contrato.");
    return; // Existing projects can be classified without rewriting their original plan.
  }
  if (!project.signedDate) fail("Indica la fecha de firma del contrato.");
  const keys = new Set(activeStages(project.nature, project.includedWorks).map(([key]) => key));
  if (project.progressReports.some(r => !keys.has(r.stageKey))) fail("La naturaleza no incluye una etapa con avances registrados.");
  if (project.milestones.some(m => m.edp && !keys.has(m.edp.stageKey))) fail("La naturaleza no incluye una etapa con EDP planificados.");
  for (const m of project.milestones.filter(m => m.stageKey && !keys.has(m.stageKey))) {
    if (m.baselineApproved || m.actualDate || project.invoiceLinks.some(l => l.milestoneId === m.id)) fail("No puedes quitar una etapa con compromisos o cumplimiento. Conserva su naturaleza contractual.");
  }
  project.milestones = project.milestones.filter(m => !m.stageKey || keys.has(m.stageKey));
  project.scopes = ["Fabricación", "Despacho", "Fundaciones", "Montaje", ...(keys.has("interior") ? ["Urbanización Interior"] : []), ...(keys.has("exterior") ? ["Urbanización Exterior"] : []), ...(keys.has("calles") ? ["Calles"] : []), ...(keys.has("otras") ? ["Otras obras"] : [])];
  for (const [key, name, scope] of activeStages(project.nature, project.includedWorks)) {
    let m = project.milestones.find(item => item.stageKey === key);
    if (!m) {
      // Reuse the original signature milestone when it exists, without duplicating it.
      m = key === "firma" ? project.milestones.find(item => item.type === "Contrato" && !item.stageKey) : null;
      if (m) m.stageKey = key;
      else {
        m = { id: `etapa-${key}-${project.id}`, stageKey: key, name, type: "Etapa", scope,
          startDate: null, baselineDate: null, forecastDate: null, actualDate: null, baselineApproved: false,
          state: "Pendiente", evidence: "", source: "Secuencia contractual según naturaleza", notes: "",
          invoicingComplete: false, cashAmount: null, baselineCashAmount: null, cashDate: null, baselineCashDate: null };
        if (project.milestones.some(item => item.id === m.id)) fail("Identificador reservado para la etapa contractual.");
        project.milestones.push(m);
      }
    }
    if (key === "firma") {
      m.actualDate = project.signedDate;
      m.evidence ||= "Firma confirmada por CDG en Gestión de Proyectos";
      m.forecastDate ||= project.signedDate;
      if (!m.baselineApproved) { m.baselineDate = project.signedDate; m.baselineApproved = true; }
    } else if (key === "anticipo") {
      // Payment status is read from CxC, never manually marked as cash received.
      m.actualDate = null; m.evidence = "";
    } else {
      const percent = stagePercent(project, key);
      let completion = null;
      for (const report of allProgress(project).filter(item => item.stageKey === key).sort((a,b) => a.date.localeCompare(b.date))) {
        completion = stagePercent(project, key, report) >= 100 ? completion || report : null;
      }
      m.actualDate = completion?.date ?? null;
      m.evidence = completion?.evidence ?? "";
      m.state = percent > 0 ? "En curso" : "Pendiente";
    }
  }
  for (const m of project.milestones.filter(m => m.edp)) {
    const old = previous?.milestones.find(item => item.id === m.id);
    const edp = m.edp, source = metricValue(project, edp);
    const ready = !edp.documentOnly && source.value !== null && source.value >= edp.threshold;
    const order = ["Previsto", "Preparado", "Presentado", "Aprobado"];
    if (old?.edp && order.indexOf(old.edp.status) >= 2) {
      if (order.indexOf(edp.status) < order.indexOf(old.edp.status)) fail("Un EDP presentado o aprobado conserva su estado documental.");
      if (["stageKey", "metric", "threshold", "documentOnly"].some(k => edp[k] !== old.edp[k])) fail("La condición de un EDP presentado se conserva.");
    }
    if (["Previsto", "Preparado"].includes(edp.status)) {
      edp.status = ready ? "Preparado" : "Previsto";
      edp.triggeredDate = ready ? source.date : null;
    } else {
      if (!edp.documentOnly && !ready && (!old?.edp || order.indexOf(edp.status) > order.indexOf(old.edp.status))) fail("Registra el avance que habilita este EDP antes de presentarlo o aprobarlo.");
      edp.triggeredDate = edp.documentOnly ? null : old?.edp?.triggeredDate || source.date;
      if (edp.documentOnly && !m.source.trim()) fail("Indica la referencia del documento presentado.");
      if (!edp.presentedDate) fail("Indica la fecha de presentación del EDP.");
      if (edp.triggeredDate && edp.presentedDate < edp.triggeredDate) fail("La presentación no puede ser anterior al avance habilitante.");
      if (edp.status === "Aprobado" && (!edp.approvedDate || !edp.approvalEvidence)) fail("La aprobación requiere fecha y referencia a la carpeta de aprobados.");
      if (edp.approvedDate && edp.approvedDate < edp.presentedDate) fail("La aprobación no puede ser anterior a la presentación.");
    }
    m.actualDate = edp.status === "Aprobado" ? edp.approvedDate : null;
    m.evidence = edp.status === "Aprobado" ? edp.approvalEvidence : "";
  }
  if (project.milestones.length > 500) fail("El proyecto supera el máximo de 500 hitos, incluidas las etapas.");
}
