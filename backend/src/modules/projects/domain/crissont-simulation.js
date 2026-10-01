export const CRISSONT_ID = "simulacion-los-crissont";
const round = n => Math.round(n * 100) / 100;
const after = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0,10);
const split = (amount, weights) => {
  let allocated = 0;
  const sum = weights.reduce((s,n) => s+n,0);
  return weights.map((w,i) => { const value = i === weights.length-1 ? round(amount-allocated) : round(amount*w/sum); allocated = round(allocated+value); return value; });
};
function milestone(id, name, type, scope, forecastDate, extra = {}) {
  return { id, name, type, scope, startDate: null, baselineDate: forecastDate, forecastDate, actualDate: null, baselineApproved: Boolean(forecastDate), state: "Pendiente", evidence: "", source: "Escenario ficticio Los Crissont", notes: "", invoicingComplete: false, cashAmount: null, baselineCashAmount: null, cashDate: null, baselineCashDate: null, ...extra };
}
function condition(stageKey, metric, threshold) {
  return { stageKey, metric, threshold, status: "Previsto", triggeredDate: null, presentedDate: null, approvedDate: null, approvalEvidence: "" };
}
export function createCrissontSimulation() {
  const milestones = [
    milestone("crissont-firma", "Firma del contrato", "Contrato", "General", "2026-01-10", { stageKey: "firma", actualDate: "2026-01-20", evidence: "Firma ficticia indicada por CDG" }),
    milestone("crissont-materiales", "Compra de materiales", "Otro", "Fabricación", "2026-04-30"),
    milestone("crissont-piloto-1", "Primera piloto", "Otro", "Fabricación", "2026-09-10"),
    milestone("crissont-piloto-2", "Segunda piloto", "Otro", "Fabricación", "2027-03-05"),
    milestone("crissont-produccion", "Producción en serie", "Etapa", "Fabricación", "2027-11-30", { stageKey: "fabricacion", startDate: "2027-09-01" }),
    milestone("crissont-anticipo-etapa", "Anticipo", "Etapa", "General", "2026-04-25", { stageKey: "anticipo" })
  ];
  const invoices = [], invoiceLinks = [];
  function bill(m, issued, due) {
    const folio = String(4000 + invoices.length), id = `sim-${CRISSONT_ID}-${folio}`;
    m.invoicingComplete = true; m.cashDate = due; m.baselineCashDate = due; m.baselineCashAmount = m.cashAmount;
    invoices.push({ id, number: folio, amountUF: m.cashAmount, issued, due, payments: [] });
    invoiceLinks.push({ invoiceId: id, milestoneId: m.id, tags: ["simulación", m.scope.toLocaleLowerCase("es")] });
    milestones.push(m);
  }
  bill(milestone("crissont-anticipo", "Anticipo · 20% del contrato", "Anticipo", "General", "2026-04-25", { cashAmount: 52000, edp: condition("anticipo", "firma", 1) }), "2026-04-25", "2026-04-25");
  const weights = [...Array(11).fill(10), 3], gross = split(208000, weights), recovery = split(41600, weights), retained = split(10400, weights);
  let from = 1;
  weights.forEach((units,i) => {
    const to = from + units - 1, date = after("2027-09-01", Math.round(i * 90 / 11));
    const m = milestone(`crissont-casas-${i+1}`, `EDP viviendas ${i+1} · casas ${from}–${to} (${units} casas)`, "EDP", "Montaje", date,
      { cashAmount: round(gross[i]-recovery[i]-retained[i]), settlement: { gross: gross[i], advanceRecovery: recovery[i], retention: retained[i] }, edp: condition("montaje", "montadas", to), notes: `Tramo ${from}–${to}. Umbral acumulado ${to}/113 casas montadas (${round(to/113*100)}%). Facturación ficticia anticipada; avance físico pendiente de registrar.` });
    bill(m, date, after(date,30)); from = to+1;
  });
  for (const [stage,scope] of [["interior","Urbanización Interior"],["exterior","Urbanización Exterior"]]) {
    for (const [i,date] of ["2027-10-15","2027-11-30"].entries()) bill(milestone(`crissont-${stage}-${i+1}`, `EDP ${scope.toLowerCase()} · ${i===0 ? "0–50%" : "50–100%"}`, "EDP", scope, date,
      { cashAmount: 9750, settlement: { gross: 13000, advanceRecovery: 2600, retention: 650 }, edp: condition(stage, `${stage}Pct`, (i+1)*50), notes: "Cada EDP representa un 50% adicional, con umbral acumulado de 50% y 100%." }), date, after(date,30));
  }
  bill(milestone("crissont-retenciones", "Liberación de retenciones · 5%", "Retenciones", "General", "2028-01-30", { cashAmount: 13000, notes: "Supuesto de prueba: facturación separada de la retención el 30-11-2027, sin pago, con liberación prevista para el 30-01-2028. No es un cargo adicional al contrato; requiere validar la recepción y las condiciones de liberación." }), "2027-11-30", "2028-01-30");
  return { id: CRISSONT_ID, revision: 0, name: "Los Crissont", customer: "Mandante ficticio Los Crissont", customerRut: "", location: "Proyecto de simulación", owner: "CDG · pruebas", lifecycle: "Firmado", nature: "llave_en_mano", includedWorks: ["interior","exterior"], units:113, areaM2:5650, contractType:"Suma alzada · simulación", currency:"UF", contractAmount:260000,
    signedDate:"2026-01-20", startDate:"2026-01-20", endDate:"2027-11-30", ufValue:40000, approvedFolder:"", paymentTerms:"Supuestos de prueba: anticipo 20%, amortización proporcional 20% de cada EDP bruto y retención 5%. Viviendas 80%; urbanización interior 10%; exterior 10%. Montos finales en UF; no se agrega IVA adicional al total proporcionado. Plazo de pago supuesto: 30 días desde factura, salvo anticipo y liberación de retenciones.",
    notes:"113 viviendas de 50 m² = 5.650 m². Pilotos incluidos dentro de las 113 viviendas. Compra de materiales y pilotos son compromisos de calendario, no EDP adicionales. Las fechas se cargan como previstas; solo la firma se acredita. Producción en serie entre 01-09-2027 y 30-11-2027. Todas las facturas son ficticias; pagos iniciales en cero.",
    houseTracking:true, houseEvents:[], progressReports:["fabricacion","fundaciones","interior","exterior","total"].map(stageKey => ({id:`crissont-cero-${stageKey}`,stageKey,date:"2026-01-20",quantity:stageKey==="fabricacion"?0:null,completedUnits:stageKey==="fabricacion"?0:null,percent:stageKey==="fabricacion"?null:0,evidence:"Inicio del escenario ficticio: avance inicial cero"})),
    scopes:[], sources:[{name:"Instrucciones de simulación Los Crissont",reference:"Datos ficticios y supuestos confirmados por CDG"}], issues:[], milestones, invoiceLinks,
    simulation:{asOf:"2028-01-30",ufValue:40000,assumptions:["Escenario al 30-01-2028 para disponer de todas las facturas de prueba. El corte real del calendario de hoy no se cambia.","UF ficticia fija de $40.000, usada solo para probar la matriz mensual en pesos; la conciliación del escenario se registra en UF.","Contrato de 260.000 UF finales: viviendas 208.000 UF, urbanización interior 26.000 UF y exterior 26.000 UF.","Anticipo 52.000 UF, descontado proporcionalmente de los EDP. Retenciones 13.000 UF, separadas en un EDP de liberación ya facturado en este escenario.","Facturación completa no equivale a aprobación documental ni a avance físico: esos registros comienzan pendientes.","Las 113 viviendas incluyen los dos pilotos. EDP de viviendas por casas montadas: once tramos de diez y uno de tres.","Plazo de pago supuesto: 30 días. Liberación de retenciones prevista el 30-01-2028, sujeta a recepción contractual."],invoices}
  };
}
