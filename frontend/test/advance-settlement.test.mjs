import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const source = await readFile(new URL("../src/modules/projects/data/advance-settlement.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { advanceReturns } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
const advance = { id: "advance", type: "Anticipo", cashAmount: 1000 };
const edp = (id, recovery, status = "Aprobado", date = "2026-01-10", apply = true) => ({ id, type: "EDP", edp: { status, approvedDate: date }, settlement: { advanceRecovery: recovery, applyAdvanceRecovery: apply } });
test("advance returns include only approved active deductions at cutoff", () => {
  const project = { milestones: [advance, edp("a", 200), edp("b", 100, "Presentado"), edp("c", 50, "Aprobado", "2026-02-01"), edp("d", 20, "Aprobado", null), edp("e", 30, "Aprobado", "2026-01-10", false), { ...edp("f", 80), type: "Retenciones" }] };
  assert.deepEqual(advanceReturns(project, advance, "2026-01-31"), { agreed: 1000, applied: 200, balance: 800, multiple: false });
  assert.equal(advanceReturns({ milestones: [advance] }, advance, "2026-01-31").applied, 0);
});
test("draft agreed amount recalculates balance and exposes excess", () => {
  const project = { milestones: [advance, edp("a", 1200)] };
  assert.equal(advanceReturns(project, advance, "2026-01-31").balance, -200);
  assert.equal(advanceReturns(project, { ...advance, cashAmount: 1500 }, "2026-01-31").balance, 300);
  assert.equal(advanceReturns(project, { ...advance, cashAmount: null }, "2026-01-31").balance, null);
});
test("multiple advances compare total agreed without counting the edited advance twice", () => {
  const project = { milestones: [advance, { ...advance, id: "second", cashAmount: 500 }, edp("a", 300)] };
  assert.deepEqual(advanceReturns(project, { ...advance, cashAmount: 1200 }, "2026-01-31"), { agreed: 1700, applied: 300, balance: 1400, multiple: true });
});
