import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const source = await readFile(new URL("../src/modules/projects/data/edp-settlement.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { settlementTotals, fixedEdpDeductions } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
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

test("optional deductions independently recalculate net, taxes and total", () => {
  for (const [applyAdvanceRecovery, applyRetention, net] of [[false, false, 100000], [true, false, 80000], [false, true, 95000], [true, true, 75000]]) {
    const s = fixedEdpDeductions({ gross: 100000, advanceRecovery: 0, retention: 0, taxMode: "iva19-ceec309", applyAdvanceRecovery, applyRetention });
    const totals = settlementTotals(s);
    assert.equal(totals.net, net);
    assert.equal(totals.total, net + Math.round(net * .19) - Math.round(net * .0309));
    assert.equal(fixedEdpDeductions({ ...s, gross: 200000 }).advanceRecovery, applyAdvanceRecovery ? 40000 : 0);
  }
});
