import { HttpError } from "../../../shared/errors/http-error.js";
import { stageMetrics, stages } from "./project-workflow.js";

import { normalizeClassification } from "./contract-classification.js";

import { validateOperations, validateSimulation } from "./project-operations.js";
import { validateEdpPlan } from "./edp-plan.js";

const types = ["Contrato", "Anticipo", "EDP", "Recepción", "Retenciones", "Otro", "Etapa"];
const scopes = ["Fabricación", "Despacho", "Fundaciones", "Montaje", "Urbanización Interior", "Urbanización Exterior", "General", "Obra civil", "Viviendas", "Urba interior", "Urba exterior", "TGM", "Calles", "Otras obras"];
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
function fail(message) { throw new HttpError(400, message); }
function text(value, name, max = 4000, required = false) {
  if (typeof value !== "string" || value.length > max || (required && !value.trim())) fail(`Revisa ${name}.`);
  return value.trim();
}
function date(value, name) {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !datePattern.test(value)) fail(`Revisa la fecha de ${name}.`);
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) fail(`Fecha inválida en ${name}.`);
  return value;
}
function number(value, name, nullable = false) {
  if (nullable && value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1e15) fail(`Revisa ${name}.`);
  return value;
}
export function validateProject(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) fail("Proyecto inválido.");
  input = normalizeClassification(input);
  const simulation = validateSimulation(input.simulation, input.id, { text, date, number });
  const p = {
    ...(simulation ? { simulation } : {}),
    id: text(input.id, "identificador", 100, true),
    name: text(input.name, "nombre del proyecto", 180, true),
    customer: text(input.customer ?? "", "cliente", 200),
    customerRut: text(input.customerRut, "RUT", 30),
    location: text(input.location, "ubicación", 250),
    owner: text(input.owner, "responsable", 150),
    units: number(input.units, "cantidad de viviendas"),
    lifecycle: input.lifecycle ?? "Firmado",
    nature: input.nature ?? null,
    includedWorks: input.includedWorks ?? [],
    areaM2: number(input.areaM2 ?? null, "superficie total contratada", true),
    progressReports: [],
    contractType: text(input.contractType, "tipo de contrato", 100),
    currency: input.currency,
    contractAmount: number(input.contractAmount, "monto contractual", true),
    signedDate: date(input.signedDate, "firma"),
    startDate: date(input.startDate, "inicio"),
    endDate: date(input.endDate, "término contractual"),
    ufValue: number(input.ufValue, "UF de proyección", true),
    approvedFolder: text(input.approvedFolder, "carpeta de aprobados", 2000),
    paymentTerms: text(input.paymentTerms, "condiciones de pago"),
    notes: text(input.notes, "observaciones", 10000),
    scopes: input.scopes,
    sources: input.sources,
    issues: input.issues,
    milestones: [],
    invoiceLinks: []
  };
  if (!/^[a-zA-Z0-9_-]+$/.test(p.id)) fail("Identificador de proyecto inválido.");
  if (input.edpConditions !== undefined) {
    const c = input.edpConditions;
    if (!c || typeof c !== "object" || Array.isArray(c)) fail("Condiciones EDP inválidas.");
    p.edpConditions = { reference: text(c.reference, "referencia de condiciones EDP", 2000), retentionPercent: number(c.retentionPercent, "porcentaje de retenciones"), recoveryPercent: number(c.recoveryPercent, "porcentaje de anticipo") };
    if (p.edpConditions.retentionPercent + p.edpConditions.recoveryPercent > 100) fail("Los porcentajes de condiciones EDP no pueden superar juntos el 100%.");
  }
  if (!Number.isInteger(p.units)) fail("La cantidad de viviendas debe ser entera.");
  if (!["Potencial", "Firmado"].includes(p.lifecycle)) fail("Estado contractual inválido.");
  if (p.nature !== null && !["fabricacion_montaje", "llave_en_mano"].includes(p.nature)) fail("Naturaleza contractual inválida.");
  if (!Array.isArray(p.includedWorks) || p.includedWorks.some(key => !["interior", "exterior", "calles", "otras"].includes(key))) fail("Alcances de construcción inválidos.");
  p.includedWorks = [...new Set(p.includedWorks)];
  if (p.nature !== "llave_en_mano" && p.includedWorks.length) fail("Los alcances adicionales corresponden a construcción completa / llave en mano.");
  const today = simulation?.asOf || new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  if (p.signedDate && p.signedDate > today) fail("La fecha de firma no puede estar en el futuro.");
  if (input.incomeDates !== undefined) {
    if (!input.incomeDates || typeof input.incomeDates !== "object" || Array.isArray(input.incomeDates) || Object.keys(input.incomeDates).length > 3000) fail("Fechas de proyección inválidas.");
    p.incomeDates = {};
    for (const [key, value] of Object.entries(input.incomeDates)) {
      if (!/^(invoice|edp):.{1,200}$/.test(key)) fail("Origen de proyección inválido.");
      const parsed = date(value, "proyección de ingreso");
      if (!parsed) fail("Indica la fecha de proyección.");
      p.incomeDates[key] = parsed;
    }
  }
  const reports = input.progressReports ?? [];
  if (!Array.isArray(reports) || reports.length > 3000) fail("Avances inválidos (máximo 3.000 cortes).");
  const reportIds = new Set();
  for (const r of reports) {
    if (!r || typeof r !== "object") fail("Corte de avance inválido.");
    const next = { id: text(r.id, "identificador del avance", 100, true), stageKey: r.stageKey,
      date: date(r.date, "corte de avance"), evidence: text(r.evidence, "evidencia del avance", 2000, true),
      quantity: number(r.quantity, "cantidad acumulada", true), completedUnits: number(r.completedUnits, "casas terminadas", true), percent: number(r.percent, "avance porcentual", true) };
    if (r.period !== undefined) {
      if (next.stageKey !== "fabricacion" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(r.period) || next.date?.slice(0, 7) !== r.period) fail("Período mensual inválido.");
      if (p.progressReports.some(old => old.stageKey === "fabricacion" && old.date.slice(0, 7) >= r.period)) fail("El período debe ser posterior al último registro de fabricación.");
      next.period = r.period;
      next.periodQuantity = number(r.periodQuantity, "m² producidos del mes");
      const previous = p.progressReports.filter(old => old.stageKey === "fabricacion").sort((a, b) => a.date.localeCompare(b.date)).at(-1);
      if (Math.abs(next.quantity - ((previous?.quantity || 0) + next.periodQuantity)) > 0.001) fail("El acumulado debe sumar la producción mensual.");
    }
    if (reportIds.has(next.id)) fail("Hay cortes de avance repetidos.");
    reportIds.add(next.id);
    if (!["fabricacion", "despachos", "fundaciones", "montaje", "interior", "exterior", "calles", "otras", "total"].includes(next.stageKey)) fail("Etapa de avance inválida.");
    if (!next.date || next.date > today || p.signedDate && next.date < p.signedDate) fail("El avance debe tener una fecha entre la firma y hoy.");
    if ([next.quantity, next.completedUnits, next.percent].every(v => v === null)) fail("Registra al menos una medición de avance.");
    if (next.percent !== null && next.percent > 100) fail("El avance no puede superar el 100%.");
    if (next.completedUnits !== null && (!Number.isInteger(next.completedUnits) || next.completedUnits > p.units)) fail("Las casas terminadas deben ser enteras y no superar las contratadas.");
    if (next.quantity !== null) {
      if (next.stageKey === "fabricacion" && p.areaM2 !== null && next.quantity > p.areaM2) fail("Los m² fabricados superan la superficie contratada.");
      if (["despachos", "fundaciones", "montaje"].includes(next.stageKey) && (!Number.isInteger(next.quantity) || next.quantity > p.units)) fail("La cantidad de casas debe ser entera y no superar las contratadas.");
    }
    if (["interior", "exterior", "calles", "otras", "total"].includes(next.stageKey) && (next.quantity !== null || next.completedUnits !== null || next.percent === null)) fail("Esta etapa se mide por porcentaje.");
    if (next.stageKey !== "fabricacion" && next.completedUnits !== null) fail("Las casas terminadas se registran en fabricación.");
    if (["fabricacion", "despachos", "montaje"].includes(next.stageKey) && next.percent !== null) fail("El porcentaje de esta etapa se calcula desde sus cantidades.");
    p.progressReports.push(next);
  }
  validateOperations(input, p, { text, date, number }, today);
  if (!["UF", "CLP"].includes(p.currency)) fail("Moneda inválida.");
  if (p.ufValue !== null && p.ufValue <= 0) fail("La UF debe ser mayor que cero.");
  if (p.startDate && p.endDate && p.endDate < p.startDate) fail("El término debe ser posterior al inicio.");
  if (p.approvedFolder && !/^https:\/\//i.test(p.approvedFolder)) fail("La carpeta debe ser un enlace HTTPS de Microsoft 365.");
  if (!Array.isArray(p.scopes) || p.scopes.some(s => !scopes.includes(s))) fail("Alcances inválidos.");
  p.scopes = [...new Set(p.scopes)];
  if (!Array.isArray(p.sources) || p.sources.length > 100) fail("Fuentes inválidas.");
  p.sources = p.sources.map(s => ({ name: text(s.name, "fuente", 250, true), reference: text(s.reference, "referencia", 2000, true) }));
  if (!Array.isArray(p.issues) || p.issues.length > 100) fail("Pendientes inválidos.");
  p.issues = p.issues.map(i => ({ id: text(i.id, "pendiente", 100, true), text: text(i.text, "detalle del pendiente", 2000, true), resolved: i.resolved === true }));
  if (!Array.isArray(input.milestones) || input.milestones.length > 500) fail("Hitos inválidos (máximo 500).");
  const ids = new Set();
  const stageKeys = new Set();
  for (const m of input.milestones) {
    if (m.detailKeys != null && (!Array.isArray(m.detailKeys) || !m.detailKeys.length || m.detailKeys.some(k => !["fabricacion", "interior", "montaje", "exterior"].includes(k)))) fail("Detalles de EDP inválidos.");
    const next = {
      id: text(m.id, "identificador del hito", 100, true),
      name: text(m.name, "nombre del hito", 200, true),
      type: m.type,
      scope: m.scope,
      detailKeys: m.detailKeys == null ? undefined : [...new Set(m.detailKeys)],
      startDate: date(m.startDate, "inicio del hito"),
      baselineDate: date(m.baselineDate, "base del hito"),
      forecastDate: date(m.forecastDate, "previsión del hito"),
      actualDate: date(m.actualDate, "cumplimiento del hito"),
      baselineApproved: m.baselineApproved === true,
      state: m.state,
      evidence: text(m.evidence, "evidencia", 2000),
      notes: text(m.notes, "observaciones del hito", 4000),
      source: text(m.source, "fuente del hito", 2000),
      invoicingComplete: m.invoicingComplete === true,
      cashAmount: number(m.cashAmount, "cobro previsto", true),
      baselineCashAmount: number(m.baselineCashAmount, "cobro base", true),
      cashDate: date(m.cashDate, "cobro previsto"), edpCount: m.edpCount == null ? undefined : number(m.edpCount, "cantidad de EDP"),
      baselineCashDate: date(m.baselineCashDate, "cobro base")
    };
    if (m.settlement != null) {
      const a = m.settlement;
      const adjustments = a.adjustments ?? 0;
      if (typeof adjustments !== "number" || !Number.isFinite(adjustments) || Math.abs(adjustments) > 1e15) fail("El ajuste del EDP debe ser un número válido.");
      next.settlement = { gross: number(a.gross, "avance bruto"), advanceRecovery: number(a.advanceRecovery, "amortización de anticipo"), retention: number(a.retention, "retención"), discounts: number(a.discounts ?? 0, "descuentos"), penalties: number(a.penalties ?? 0, "multas"), adjustments };
      for (const key of ["retentionPercent", "recoveryPercent"]) {
        if (a[key] !== undefined) {
          next.settlement[key] = number(a[key], "porcentaje del EDP");
          if (next.settlement[key] > 100) fail("El porcentaje del EDP no puede superar el 100%.");
        }
      }
      if ((a.retentionPercent ?? 5) + (a.recoveryPercent ?? 20) > 100 && (a.retentionPercent !== undefined || a.recoveryPercent !== undefined)) fail("Los porcentajes del EDP no pueden superar juntos el 100%.");
      for (const flag of ["applyAdvanceRecovery", "applyRetention"]) {
        if (a[flag] !== undefined) {
          if (typeof a[flag] !== "boolean") fail("Selección de devoluciones inválida.");
          next.settlement[flag] = a[flag];
        }
      }
      if (a.applyAdvanceRecovery === false && next.settlement.advanceRecovery !== 0 || a.applyRetention === false && next.settlement.retention !== 0) fail("Una devolución desactivada debe tener monto cero.");
      const net = next.settlement.gross - next.settlement.advanceRecovery - next.settlement.retention - next.settlement.discounts - next.settlement.penalties + adjustments;
      if (a.taxMode !== undefined && a.taxMode !== "iva19-ceec309") fail("El cálculo tributario del EDP no es válido.");
      let total = net;
      if (a.taxMode === "iva19-ceec309") {
        next.settlement.taxMode = a.taxMode;
        for (const [rate, amount, flag] of [["recoveryPercent", "advanceRecovery", "applyAdvanceRecovery"], ["retentionPercent", "retention", "applyRetention"]]) {
          if (a[rate] !== undefined && next.settlement[amount] !== (a[flag] === false ? 0 : Math.round(next.settlement.gross * a[rate] / 100))) fail("El descuento del EDP no coincide con su porcentaje guardado.");
        }
        const netRounded = Math.round(net);
        total = netRounded + Math.round(netRounded * 0.19) - Math.round(netRounded * 0.0309);
      }
      if (next.cashAmount === null || net < 0 || Math.abs(total-next.cashAmount) > 0.011) fail(a.taxMode ? "El total bruto a facturar debe coincidir con el neto más IVA 19% menos CEEC 3,09%, redondeados sin decimales." : "El neto del EDP debe coincidir con bruto menos anticipo, retenciones, descuentos y multas, más ajustes.");
    }
    if (m.stageKey !== undefined) {
      if (!stages.some(([key]) => key === m.stageKey) || stageKeys.has(m.stageKey)) fail("Etapa contractual inválida o repetida.");
      if (m.edp || !["Etapa", "Contrato"].includes(m.type)) fail("Las etapas físicas se separan de sus EDP.");
      if (next.cashAmount !== null || next.baselineCashAmount !== null) fail("Programa el cobro en el EDP de la etapa.");
      stageKeys.add(m.stageKey); next.stageKey = m.stageKey;
    }
    if (m.edp !== undefined) {
      const e = m.edp;
      if (!e || !["EDP", "Anticipo"].includes(m.type) || !stageMetrics[e.stageKey]?.includes(e.metric)) fail("Condición del EDP incompatible con su partida.");
      next.edp = { stageKey: e.stageKey, metric: e.metric, threshold: number(e.threshold, "umbral del EDP"), status: e.status,
        triggeredDate: date(e.triggeredDate ?? null, "habilitación"), presentedDate: date(e.presentedDate ?? null, "presentación"), approvedDate: date(e.approvedDate ?? null, "aprobación"), approvalEvidence: text(e.approvalEvidence ?? "", "evidencia de aprobación", 2000) };
      if (!["Previsto", "Preparado", "Presentado", "Aprobado"].includes(e.status)) fail("Estado de EDP inválido.");
      if (e.documentOnly === true) next.edp.documentOnly = true;
      if (next.edp.threshold <= 0 || e.metric.endsWith("Pct") && next.edp.threshold > 100 || e.metric === "firma" && next.edp.threshold !== 1) fail("Umbral del EDP inválido.");
      if (["terminadas", "despachadas", "fundaciones", "montadas"].includes(e.metric) && (!Number.isInteger(e.threshold) || e.threshold > p.units)) fail("El umbral debe ser una cantidad entera dentro de las viviendas contratadas.");
      if (e.metric === "m2" && p.areaM2 !== null && e.threshold > p.areaM2) fail("El umbral supera los m² contratados.");
      if ([next.edp.presentedDate, next.edp.approvedDate].some(d => d && d > today)) fail("Las fechas documentales no pueden estar en el futuro.");
      if (e.stageKey === "anticipo" && m.type !== "Anticipo" || e.stageKey !== "anticipo" && m.type !== "EDP") fail("Tipo de EDP incompatible con su etapa.");
    }
    if (next.edpCount !== undefined && (!Number.isInteger(next.edpCount) || next.edpCount < 1 || next.edpCount > 450)) fail("La cantidad de EDP debe ser un entero entre 1 y 450.");
    if (ids.has(next.id)) fail("Hay hitos con identificadores repetidos.");
    ids.add(next.id);
    if (!types.includes(next.type) || !scopes.includes(next.scope)) fail("Tipo o alcance de hito inválido.");
    if (!["Pendiente", "En curso", "Observado"].includes(next.state)) fail("Estado de hito inválido.");
    if (next.actualDate && !next.evidence) fail("Agrega evidencia para registrar un hito cumplido.");
    if (next.actualDate && next.actualDate > today) fail("La fecha efectiva no puede estar en el futuro.");
    if (next.baselineApproved && !next.baselineDate) fail("Indica una fecha base antes de confirmar el hito.");
    if (next.startDate && next.forecastDate && next.startDate > next.forecastDate) fail("El inicio del hito no puede ser posterior a su fecha prevista.");
    p.milestones.push(next);
  }
  if (!Array.isArray(input.invoiceLinks) || input.invoiceLinks.length > 2000) fail("Asociaciones de facturas inválidas.");
  const invoices = new Set();
  p.invoiceLinks = input.invoiceLinks.map(link => {
    const invoiceId = text(link.invoiceId, "factura", 200, true);
    const milestoneId = text(link.milestoneId, "hito de la factura", 100, true);
    if (!ids.has(milestoneId)) fail("El hito de la factura no existe.");
    if (p.simulation ? !p.simulation.invoices.some(i => i.id === invoiceId) : invoiceId.startsWith("sim-")) fail("No mezcles facturas ficticias con proyectos reales.");
    if (invoices.has(invoiceId)) fail("Una factura no puede contarse dos veces en el proyecto.");
    invoices.add(invoiceId);
    const tags = link.tags ?? [];
    if (!Array.isArray(tags) || tags.length > 12) fail("Usa como máximo 12 etiquetas por relación.");
    const normalizedTags = [...new Set(tags.map(tag => text(tag, "etiqueta", 50, true).toLocaleLowerCase("es")))];
    return { invoiceId, milestoneId, ...(normalizedTags.length ? { tags: normalizedTags } : {}) };
  });
  validateEdpPlan(input.edpPlan, p, { text, number });
  return p;
}

export function preserveBaselines(previous, next) {
  if (!previous) return;
  if (previous.currency !== next.currency && previous.milestones.some(m => m.baselineApproved && m.baselineCashAmount !== null)) {
    fail("No puedes cambiar la moneda de un plan base con importes confirmados.");
  }
  for (const m of previous.milestones.filter(m => m.baselineApproved)) {
    const updated = next.milestones.find(item => item.id === m.id);
    if (!updated || !updated.baselineApproved || ["baselineDate", "baselineCashDate", "baselineCashAmount"].some(key => updated[key] !== m[key])) {
      fail("El plan base confirmado se conserva. Modifica la fecha o el monto previsto para reprogramar.");
    }
  }
}
