import { HttpError } from "../../../shared/errors/http-error.js";
const fail = message => { throw new HttpError(400, message); };

export function houseProgress(project) {
  if (!project.houseTracking) return [];
  const latest = new Map();
  for (const e of project.houseEvents || []) latest.set(`${e.house}-${e.stage}`, e);
  return ["despachos", "montaje"].flatMap(stageKey => {
    const events = [...latest.values()].filter(e => e.stage === stageKey && e.date).sort((a,b) => a.date.localeCompare(b.date));
    const dates = [...new Set([project.signedDate, ...events.map(e => e.date)])].filter(Boolean).sort();
    return dates.map(date => ({ id: `casas-${stageKey}-${date}`, stageKey, date,
      quantity: events.filter(e => e.date <= date).length, completedUnits: null, percent: null,
      evidence: `Registro individual de casas · ${stageKey} acumulados al ${date}` }));
  });
}
export function allProgress(project) { return [...(project.progressReports || []), ...houseProgress(project)]; }
export function withOperations(project) { return { ...project, houseProgress: houseProgress(project) }; }

export function validateOperations(input, p, helpers, today) {
  const { text, date, number } = helpers;
  p.houseTracking = input.houseTracking === true;
  const events = input.houseEvents ?? [];
  if (!Array.isArray(events) || events.length > 10000) fail("Registro de casas inválido.");
  if (events.length && !p.houseTracking) fail("Activa el seguimiento individual de casas.");
  if (p.houseTracking && p.units > 2000) fail("El seguimiento individual admite hasta 2.000 casas.");
  p.houseEvents = events.map(e => ({ id: text(e.id, "registro de casa", 100, true), house: number(e.house, "número de casa"), stage: e.stage, date: date(e.date, "despacho o montaje"), evidence: text(e.evidence, "referencia de casa", 1000, true) }));
  if (new Set(p.houseEvents.map(e => e.id)).size !== events.length) fail("Hay registros de casa repetidos.");
  const latest = new Map();
  for (const e of p.houseEvents) {
    if (!Number.isInteger(e.house) || e.house < 1 || e.house > p.units || !["despachos", "montaje"].includes(e.stage)) fail("Casa o etapa inválida.");
    if (e.date && (!p.signedDate || e.date < p.signedDate || e.date > today)) fail("La fecha de la casa debe estar entre la firma y la fecha de trabajo.");
    latest.set(`${e.house}-${e.stage}`, e);
  }
  for (const e of latest.values()) if (e.stage === "montaje" && e.date) {
    const dispatch = latest.get(`${e.house}-despachos`);
    if (!dispatch?.date || e.date < dispatch.date) fail(`Casa ${e.house}: registra el despacho antes del montaje.`);
  }
  if (p.houseTracking && p.progressReports.some(r => ["despachos", "montaje"].includes(r.stageKey))) fail("Con seguimiento por casa, los avances de despacho y montaje se calculan desde las fechas individuales.");
}

export function preserveOperations(previous, project) {
  if ((previous?.houseEvents || []).some((e,i) => JSON.stringify(e) !== JSON.stringify(project.houseEvents[i]))) fail("Los registros de casas se conservan. Agrega una corrección nueva.");
  if (previous?.houseTracking && !project.houseTracking) fail("El seguimiento individual ya activado se conserva.");
  if (previous && Boolean(previous.simulation) !== Boolean(project.simulation)) fail("Los proyectos reales y de simulación se mantienen separados.");
  if (project.lifecycle === "Potencial" && (project.houseEvents.length || project.simulation)) fail("Firma el proyecto antes de registrar operaciones.");
  if (previous?.simulation) {
    const old = previous.simulation, next = project.simulation;
    if (old.ufValue !== next.ufValue || old.asOf !== next.asOf || JSON.stringify(old.assumptions) !== JSON.stringify(next.assumptions)) fail("Conserva los supuestos originales de la simulación.");
    if (JSON.stringify(old.invoices.map(i => ({ ...i, payments: [] }))) !== JSON.stringify(next.invoices.map(i => ({ ...i, payments: [] })))) fail("Las facturas del escenario se conservan; registra pagos de prueba para conciliarlas.");
    for (const i of old.invoices) if (i.payments.some((p,n) => JSON.stringify(p) !== JSON.stringify(next.invoices.find(inv => inv.id === i.id)?.payments[n]))) fail("Los pagos simulados ya registrados se conservan.");
  }
}

export function validateSimulation(input, projectId, helpers) {
  if (input == null) return undefined;
  const { text, date, number } = helpers;
  const asOf = date(input.asOf, "corte de simulación"), ufValue = number(input.ufValue, "UF ficticia");
  if (!asOf || ufValue <= 0) fail("Indica fecha del escenario y UF ficticia positiva.");
  if (!Array.isArray(input.invoices) || input.invoices.length > 500 || !Array.isArray(input.assumptions) || input.assumptions.length > 30) fail("Escenario de simulación inválido.");
  const invoices = input.invoices.map(i => {
    const item = { id: text(i.id, "factura ficticia", 200, true), number: text(i.number, "folio ficticio", 30, true), amountUF: number(i.amountUF, "factura en UF"), issued: date(i.issued, "emisión ficticia"), due: date(i.due, "vencimiento ficticio"), payments: [] };
    if (!item.id.startsWith(`sim-${projectId}-`) || !item.issued || !item.due || item.issued > asOf || item.due < item.issued || item.amountUF <= 0) fail("Fechas, monto o identificador de factura ficticia inválidos.");
    if (!Array.isArray(i.payments) || i.payments.length > 300) fail("Pagos de simulación inválidos.");
    item.payments = i.payments.map(pay => ({ id: text(pay.id, "identificador de pago", 100, true), date: date(pay.date, "pago simulado"), amountUF: number(pay.amountUF, "pago simulado en UF"), reference: text(pay.reference, "referencia de conciliación", 500, true) }));
    if (new Set(item.payments.map(p => p.id)).size !== item.payments.length || item.payments.some(p => !p.date || p.date < item.issued || p.date > asOf || p.amountUF <= 0 || Math.abs(p.amountUF*100-Math.round(p.amountUF*100)) > .0001)) fail("Revisa fecha, monto o identificador del pago simulado (máximo dos decimales).");
    if (item.payments.reduce((sum,p) => sum + Math.round(p.amountUF*100),0) > Math.round(item.amountUF*100)) fail("El pago supera el saldo de la factura simulada.");
    return item;
  });
  if (new Set(invoices.map(i => i.id)).size !== invoices.length || new Set(invoices.map(i => i.number)).size !== invoices.length) fail("Facturas ficticias duplicadas.");
  return { asOf, ufValue, assumptions: input.assumptions.map(s => text(s, "supuesto", 1200, true)), invoices };
}
