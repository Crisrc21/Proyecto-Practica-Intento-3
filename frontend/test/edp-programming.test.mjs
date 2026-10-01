import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
async function moduleUrl(file, replacements = {}) {
  let js = ts.transpileModule(await readFile(new URL(`../src/modules/projects/data/${file}.ts`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const [from, to] of Object.entries(replacements)) js = js.replace(from, to);
  return `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
}
const { buildEdpBatch, physicalPlan } = await import(await moduleUrl("edp-programming"));
const { contractMilestones } = await import(await moduleUrl("contract-milestones", { '"./project-history"': JSON.stringify(await moduleUrl("project-history")) }));
const project = { units: 113, areaM2: 5650, contractAmount: 260000, signedDate: "2026-01-20", milestones: [], invoiceLinks: [], currency: "UF" };
const batch = { stageKey: "fabricacion", metric: "terminadas", from: 0, remaining: 113, perEdp: 10, gross: 208000, retentionPercent: 5, recoveryPercent: 20, approvalDate: "2027-09-01", intervalDays: 7, paymentDays: 30 };

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
test("financial closure needs release evidence, complete contractual coverage and collection of all EDP", () => {
  const advance = { id: "a", type: "Anticipo", invoicingComplete: true };
  const edp = { id: "e", type: "EDP", invoicingComplete: true, settlement: { gross: 260000 } };
  const retained = { id: "r", type: "Retenciones", invoicingComplete: true, actualDate: "2026-03-01", evidence: "Liberadas" };
  const p = { ...project, milestones: [advance, edp, retained], invoiceLinks: ["a", "e", "r"].map(id => ({ invoiceId: id, milestoneId: id })) };
  const bills = ["a", "e", "r"].map(id => ({ id, numero: id, fechaEmision: "2026-02-01", monto: 1000, pagos: [{ fechaPago: "2026-03-05", monto: 1000 }], notasCredito: [], notasDebito: [] }));
  const get = (pr = p, invoices = bills, date = "2026-03-31", state = "ready") => contractMilestones(pr, invoices, state, date);
  assert.equal(get().length, 3); assert.equal(get()[2].actual, "2026-03-05");
  assert.equal(get(p, bills.map(b => b.id === "e" ? { ...b, pagos: [] } : b))[2].actual, null);
  assert.equal(get({ ...p, milestones: [advance, edp, { ...retained, actualDate: null }] })[2].actual, null);
  assert.equal(get({ ...p, contractAmount: 300000 })[2].actual, null);
  assert.equal(get(p, bills, "2026-02-28")[2].actual, null);
  assert.equal(get(p, bills, "2026-03-31", "error")[2].actual, null);
  const future = { ...bills[0], id: "future", fechaEmision: "2026-04-01" };
  assert.equal(get({ ...p, invoiceLinks: [...p.invoiceLinks, { invoiceId: "future", milestoneId: "a" }] }, [...bills, future])[1].actual, null);
});
