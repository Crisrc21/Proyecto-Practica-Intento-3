import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const source = await readFile(new URL("../src/modules/projects/data/edp-settlement.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { settlementTotals, fixedEdpDeductions, newEdpSettlement } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);

test("new EDP uses project conditions and retains its rates after project changes", () => {
  const project = { edpConditions: { retentionPercent: 3, recoveryPercent: 10, reference: "Contrato" } };
  const original = newEdpSettlement(project);
  const calculated = fixedEdpDeductions({ ...original, gross: 1000 });
  assert.equal(calculated.retention, 30);
  assert.equal(calculated.advanceRecovery, 100);
  assert.equal(settlementTotals(calculated).total, 1008);
  project.edpConditions.recoveryPercent = 15;
  assert.equal(fixedEdpDeductions({ ...calculated, gross: 2000 }).advanceRecovery, 200);
  assert.equal(newEdpSettlement(project).recoveryPercent, 15);
  assert.equal(newEdpSettlement({}).recoveryPercent, 20);
  assert.equal(newEdpSettlement({}).retentionPercent, 5);
});

test("CEEC conditions are copied to new EDP, support zero and remain independent", () => {
  const project = { edpConditions: { ceecPercent: 2.5 } };
  const s = fixedEdpDeductions({ ...newEdpSettlement(project), gross: 1000 });
  assert.equal(s.ceecPercent, 2.5);
  assert.equal(settlementTotals(s).ceec, 19);
  assert.equal(settlementTotals({ ...s, ivaExempt: true }).total, 731);
  project.edpConditions.ceecPercent = 0;
  assert.equal(settlementTotals(s).ceec, 19);
  assert.equal(newEdpSettlement(project).ceecPercent, 0);
  assert.equal(settlementTotals({ ...s, ceecPercent: 0 }).ceec, 0);
  assert.equal(newEdpSettlement({}).ceecPercent, 3.09);
});

test("zero and fractional project rates work with optional deductions", () => {
  const base = newEdpSettlement({ edpConditions: { recoveryPercent: 0, retentionPercent: 2.5 } });
  const s = fixedEdpDeductions({ ...base, gross: 1000 });
  assert.equal(s.advanceRecovery, 0);
  assert.equal(s.retention, 25);
  assert.equal(fixedEdpDeductions({ ...s, applyRetention: false }).retention, 0);
});
test("automatic deductions use 20% and 5% of physical advance, rounding whole amounts", () => {
  const s = fixedEdpDeductions({ gross: 100000, advanceRecovery: 0, retention: 0, taxMode: "iva19-ceec309" });
  assert.equal(s.advanceRecovery, 20000);
  assert.equal(s.retention, 5000);
  assert.equal(settlementTotals(s).total, 86932);
  const changed = fixedEdpDeductions({ ...s, gross: 1235 });
  assert.equal(changed.advanceRecovery, 247);
  assert.equal(changed.retention, 62);
});
test("IVA is added and CEEC deducted from net after advance and retention", () => {
  assert.deepEqual(settlementTotals({ gross: 100000, advanceRecovery: 20000, retention: 5000, taxMode: "iva19-ceec309" }), { net: 75000, iva: 14250, ceec: 2318, total: 86932 });
  assert.deepEqual(settlementTotals({ gross: 1000, advanceRecovery: 0, retention: 0, taxMode: "iva19-ceec309" }), { net: 1000, iva: 190, ceec: 31, total: 1159 });
  assert.equal(settlementTotals({ gross: 1000, advanceRecovery: 200, retention: 50 }).total, 750);
});

test("IVA exemption removes only IVA and can be reversed with deductions preserved", () => {
  const s = fixedEdpDeductions({ gross: 7727, advanceRecovery: 0, retention: 0, applyAdvanceRecovery: false, taxMode: "iva19-ceec309" });
  assert.deepEqual(settlementTotals({ ...s, ivaExempt: true }), { net: 7341, iva: 0, ceec: 227, total: 7114 });
  assert.deepEqual(settlementTotals({ ...s, ivaExempt: false }), { net: 7341, iva: 1395, ceec: 227, total: 8509 });
  assert.deepEqual(settlementTotals({ ...s, ivaExempt: false }), settlementTotals(s));
});

test("optional deductions independently recalculate net, taxes and total", () => {
  for (const [applyAdvanceRecovery, applyRetention, net] of [[false, false, 100000], [true, false, 80000], [false, true, 95000], [true, true, 75000]]) {
    const s = fixedEdpDeductions({ gross: 100000, advanceRecovery: 0, retention: 0, taxMode: "iva19-ceec309", applyAdvanceRecovery, applyRetention });
    const totals = settlementTotals(s);
    assert.equal(totals.net, net);
    assert.equal(totals.total, net + Math.round(net * .19) - Math.round(net * .0309));
    assert.equal(fixedEdpDeductions({ ...s, gross: 200000 }).advanceRecovery, applyAdvanceRecovery ? 40000 : 0);
  }
});
