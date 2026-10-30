import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
async function moduleUrl(file, replacements = {}) {
  let js = ts.transpileModule(await readFile(new URL(`../src/modules/projects/data/${file}.ts`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const [from, to] of Object.entries(replacements)) js = js.replace(from, to);
  return `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
}
const { buildEdpBatch, buildFinancialEdpBatch, physicalPlan } = await import(await moduleUrl("edp-programming"));
const { contractMilestones } = await import(await moduleUrl("contract-milestones", { '"./project-history"': JSON.stringify(await moduleUrl("project-history")) }));
const project = { units: 113, areaM2: 5650, contractAmount: 260000, signedDate: "2026-01-20", milestones: [], invoiceLinks: [], currency: "UF" };
const batch = { stageKey: "fabricacion", metric: "terminadas", from: 0, remaining: 113, perEdp: 10, gross: 208000, retentionPercent: 5, recoveryPercent: 20, approvalDate: "2027-09-01", intervalDays: 7, paymentDays: 30 };
const financialBatch = { count: 3, grossPerEdp: 1000, retentionPercent: 5, recoveryPercent: 20, approvalDate: "2026-12-15", intervalDays: 30, paymentDays: 15 };

test("financial batches repeat the amount and deductions, schedule dates and create no physical progress", () => {
  const rows = buildFinancialEdpBatch({ ...project, units: 0, areaM2: null }, financialBatch, [{ type: "EDP", name: "EDP 7" }]);
  assert.deepEqual(rows.map(m => m.name), ["EDP 8", "EDP 9", "EDP 10"]);
  assert.deepEqual(rows.map(m => m.forecastDate), ["2026-12-15", "2027-01-14", "2027-02-13"]);
  assert.deepEqual(rows.map(m => m.cashDate), ["2026-12-30", "2027-01-29", "2027-02-28"]);
  assert.equal(physicalPlan({ ...project, milestones: rows }).length, 0);
  for (const m of rows) {
    assert.equal(m.settlement.gross, 1000);
    assert.equal(m.settlement.retention, 50);
    assert.equal(m.settlement.advanceRecovery, 200);
    assert.equal(m.cashAmount, 750);
    assert.equal(m.baselineCashAmount, 750);
    assert.equal(m.edp.documentOnly, true);
    assert.equal(m.edp.status, "Previsto");
    assert.equal(m.edp.presentedDate, null);
  }
  const taxed = buildFinancialEdpBatch(project, { ...financialBatch, taxMode: "iva19-ceec309" }, [])[0];
  assert.equal(taxed.cashAmount, 870);
});

test("taxed batches retain the configured CEEC rate and matching total", () => {
  for (const ceecPercent of [0, 2.5, 3.09]) {
    const p = { ...project, edpConditions: { ceecPercent } };
    const rows = [
      ...buildFinancialEdpBatch(p, { ...financialBatch, taxMode: "iva19-ceec309" }, []),
      ...buildEdpBatch(p, { ...batch, taxMode: "iva19-ceec309" }, [])
    ];
    for (const row of rows) {
      const s = row.settlement;
      const net = s.gross - s.advanceRecovery - s.retention;
      assert.equal(s.ceecPercent, ceecPercent);
      assert.equal(row.cashAmount, net + Math.round(net * .19) - Math.round(net * ceecPercent / 100));
    }
  }
});

test("financial programming rejects invalid amounts, counts, deductions and dates", () => {
  for (const patch of [
    { count: 0 }, { count: 1.5 }, { count: 451 }, { grossPerEdp: 0 }, { grossPerEdp: NaN },
    { retentionPercent: -1 }, { retentionPercent: 81 }, { recoveryPercent: 101 },
    { approvalDate: "2026-02-30" }, { approvalDate: "2025-01-01" },
    { intervalDays: 0 }, { paymentDays: -1 }, { paymentDays: 1.5 }, { paymentDays: 1e12 }
  ]) assert.throws(() => buildFinancialEdpBatch(project, { ...financialBatch, ...patch }, []));
  assert.throws(() => buildFinancialEdpBatch({ ...project, milestones: [{ type: "EDP", edp: { presentedDate: "2027-01-01" } }] }, financialBatch, []));
  assert.throws(() => buildFinancialEdpBatch(project, financialBatch, Array(448).fill({ type: "Etapa", name: "Etapa" })));
});

test("113 homes yield 11 EDP of ten and a final EDP of three, preserving gross and net reconciliation", () => {
  const rows = buildEdpBatch(project, batch, []);
  assert.equal(rows.length, 12);
  assert.equal(rows.at(-1).edp.threshold, 113);
  assert.equal(physicalPlan({ ...project, milestones: rows }).at(-1).period, 3);
  assert.equal(Math.round(rows.reduce((s, m) => s + m.settlement.gross, 0) * 100), 20800000);
  for (const m of rows) {
    assert.equal(m.edp.status, "Previsto"); assert.equal(m.edp.presentedDate, null);
    assert.equal(m.actualDate, null);
    assert.equal(Math.round((m.settlement.gross - m.settlement.retention - m.settlement.advanceRecovery) * 100), Math.round(m.cashAmount * 100));
  }
  assert.equal(rows[0].cashDate, "2027-10-01");
});
test("future programming continues after the first presented EDP without duplicating its quantities", () => {
  const source = buildEdpBatch(project, { ...batch, remaining: 10, gross: 18407.08 }, [])[0];
  const rows = buildEdpBatch(project, { ...batch, from: 10, remaining: 103, gross: 189592.92 }, [source]);
  assert.equal(rows.length, 11); assert.equal(rows[0].edp.threshold, 20);
  assert.throws(() => buildEdpBatch(project, batch, [source]), /continuar/);
  assert.throws(() => buildEdpBatch(project, { ...batch, from: 10, remaining: 113 }, [source]), /supera/);
  assert.throws(() => buildEdpBatch(project, { ...batch, remaining: 10.5 }, []), /enteras/);
  assert.throws(() => buildEdpBatch(project, { ...batch, recoveryPercent: 101 }, []), /superar/);
});
test("urbanization groups independently schedule two EDP at 50 percent", () => {
  for (const stageKey of ["interior", "exterior"]) {
    const rows = buildEdpBatch(project, { ...batch, stageKey, metric: `${stageKey}Pct`, remaining: 100, perEdp: 50, gross: 26000 }, []);
    assert.deepEqual(rows.map(m => m.edp.threshold), [50, 100]);
    assert.deepEqual(rows.map(m => m.settlement.retention), [0, 0]);
    assert.deepEqual(rows.map(m => m.cashAmount), [10400, 10400]);
  }
});
test("retention collection is independent of global closure and obsolete release fields", () => {
  const advance = { id: "a", type: "Anticipo", invoicingComplete: true };
  const edp = { id: "e", type: "EDP", invoicingComplete: true, settlement: { gross: 260000 } };
  const retained = { id: "r", type: "Retenciones", invoicingComplete: true, actualDate: "2026-03-01", evidence: "Liberadas" };
  const p = { ...project, milestones: [advance, edp, retained], invoiceLinks: ["a", "e", "r"].map(id => ({ invoiceId: id, milestoneId: id })) };
  const bills = ["a", "e", "r"].map(id => ({ id, numero: id, fechaEmision: "2026-02-01", monto: 1000, pagos: [{ fechaPago: "2026-03-05", monto: 1000 }], notasCredito: [], notasDebito: [] }));
  const get = (pr = p, invoices = bills, date = "2026-03-31", state = "ready") => contractMilestones(pr, invoices, state, date);
  assert.equal(get().length, 3); assert.equal(get()[2].actual, "2026-03-05");
  assert.equal(get(p, bills.map(b => b.id === "e" ? { ...b, pagos: [] } : b))[2].actual, "2026-03-05");
  assert.equal(get({ ...p, milestones: [advance, edp, { ...retained, actualDate: null, invoicingComplete: false }] })[2].actual, "2026-03-05");
  assert.equal(get({ ...p, contractAmount: null })[2].actual, "2026-03-05");
  assert.equal(get(p, bills.map(b => b.id === "r" ? { ...b, pagos: [] } : b))[2].actual, null);
  assert.equal(get(p, bills, "2026-02-28")[2].actual, null);
  assert.equal(get(p, bills, "2026-03-31", "error")[2].actual, null);
  const future = { ...bills[0], id: "future", fechaEmision: "2026-04-01" };
  assert.equal(get({ ...p, invoiceLinks: [...p.invoiceLinks, { invoiceId: "future", milestoneId: "a" }] }, [...bills, future])[1].actual, null);
});
