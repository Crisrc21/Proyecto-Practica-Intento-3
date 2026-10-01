import { HttpError } from "../../../shared/errors/http-error.js";

const fail = message => { throw new HttpError(400, message); };

export function validateEdpPlan(input, project, { text, number }) {
  if (input === undefined) return;
  if (!input || typeof input !== "object" || Array.isArray(input)) fail("Programación de EDP inválida.");
  if (!Array.isArray(input.milestoneIds) || !input.milestoneIds.length || input.milestoneIds.length > 450) fail("Selecciona los EDP de la programación inicial.");
  const ids = input.milestoneIds.map(id => text(id, "EDP programado", 100, true));
  if (new Set(ids).size !== ids.length) fail("La programación no puede duplicar un EDP.");
  project.edpPlan = {
    sourceMilestoneId: text(input.sourceMilestoneId, "primer EDP presentado", 100, true),
    reference: text(input.reference, "referencia del primer EDP", 2000, true),
    milestoneIds: ids,
    contractAmount: number(input.contractAmount, "total contractual de la programación"),
    currency: input.currency
  };
  if (!["UF", "CLP"].includes(input.currency)) fail("Moneda de la programación inválida.");
}

// The source document and original membership are immutable. Reforecast the individual
// EDPs instead; their confirmed baselines remain available for comparison.
export function preserveEdpPlan(previous, project) {
  if (previous?.edpPlan) {
    if (JSON.stringify(previous.edpPlan) !== JSON.stringify(project.edpPlan)) fail("La programación inicial del primer EDP se conserva. Actualiza la previsión de cada EDP.");
  }
  const plan = project.edpPlan;
  if (!plan) return;
  if (project.lifecycle === "Potencial") fail("Firma el contrato antes de programar sus EDP.");
  const source = project.milestones.find(m => m.id === plan.sourceMilestoneId);
  if (!source || source.type !== "EDP" || !source.edp || !["Presentado", "Aprobado"].includes(source.edp.status) || !source.edp.presentedDate) fail("La programación requiere el primer EDP de avance efectivamente presentado.");
  if (!plan.milestoneIds.includes(source.id)) fail("Incluye el primer EDP en la programación.");
  if (!previous?.edpPlan) {
    if (project.contractAmount === null || project.contractAmount <= 0 || plan.contractAmount !== project.contractAmount || plan.currency !== project.currency) fail("Completa el monto contractual antes de confirmar la programación.");
    if (project.milestones.some(m => m.type === "EDP" && m.edp?.presentedDate && m.edp.presentedDate < source.edp.presentedDate)) fail("Selecciona el primer EDP presentado como documento base.");
  }
  for (const id of plan.milestoneIds) {
    const m = project.milestones.find(item => item.id === id);
    if (!m || m.type !== "EDP" || !m.edp || m.edp.metric === "firma") fail("Cada EDP programado debe tener una condición de avance físico.");
    if (!previous?.edpPlan) {
      if (!m.settlement || m.cashAmount === null || !m.forecastDate || !m.cashDate) fail("Completa bruto, retenciones y fechas de aprobación y cobro de cada EDP.");
      if (m.cashDate < m.forecastDate) fail("El cobro previsto no puede ser anterior a la aprobación prevista.");
      if (!m.baselineApproved) {
        m.baselineApproved = true;
        m.baselineDate = m.forecastDate;
        m.baselineCashDate = m.cashDate;
        m.baselineCashAmount = m.cashAmount;
      }
    }
  }
}
