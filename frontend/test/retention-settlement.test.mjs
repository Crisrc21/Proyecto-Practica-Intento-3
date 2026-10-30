import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const source = await readFile(new URL("../src/modules/projects/data/retention-settlement.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { appliedRetentions, retentionForSave } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
const edp = (retention, status = "Presentado", presentedDate = "2026-01-10", applyRetention = true) => ({ type: "EDP", edp: { status, presentedDate }, settlement: { retention, applyRetention } });
test("retentions sum only presented EDP at cutoff with active deductions", () => {
  const project = { milestones: [edp(100), edp(50.25), edp(200, "Aprobado"), edp(300, "Aprobado", "2026-03-01"), edp(400, "Aprobado", null), edp(500, "Aprobado", "2026-01-10", false), { ...edp(600), type: "Retenciones" }, { ...edp(700), type: "Anticipo" }] };
  assert.equal(appliedRetentions(project, "2026-02-01"), 350.25);
  assert.equal(appliedRetentions({ milestones: [] }, "2026-02-01"), 0);
  project.milestones[0].settlement.retention = 125;
  assert.equal(appliedRetentions(project, "2026-02-01"), 375.25);
});

test("saving observations during a historical review keeps the current accumulated amount", () => {
  const project = { milestones: [edp(400, "Presentado", "2026-06-01"), edp(600, "Presentado", "2026-10-01")] };
  const draft = { id: "ret", name: "Liberación de retenciones", type: "Retenciones", cashAmount: 1000, notes: "Observación corregida", expectedReceiptDate: "2026-12-01", cashDate: "2026-12-15", baselineCashAmount: 1000, baselineCashDate: "2026-12-10" };
  assert.equal(appliedRetentions(project, "2026-06-30"), 400);
  const saved = retentionForSave(project, draft, "2026-10-30");
  assert.equal(saved.cashAmount, 1000);
  assert.equal(saved.notes, draft.notes);
  assert.equal(saved.expectedReceiptDate, draft.expectedReceiptDate);
  assert.equal(saved.cashDate, draft.cashDate);
  assert.equal(saved.baselineCashAmount, draft.baselineCashAmount);
  assert.equal(saved.baselineCashDate, draft.baselineCashDate);
  assert.equal(retentionForSave(project, { ...draft, cashAmount: null }, "2026-10-30").cashAmount, 1000);
  assert.equal(draft.cashAmount, 1000);
});

test("current saving excludes future presentations and uses simulation reference date", () => {
  const project = { milestones: [edp(400, "Presentado", "2026-06-01"), edp(600, "Presentado", "2026-10-01"), edp(200, "Presentado", "2026-12-01")] };
  const draft = { type: "Retenciones", cashAmount: 1000 };
  assert.equal(retentionForSave(project, draft, "2026-10-30").cashAmount, 1000);
  assert.equal(retentionForSave({ ...project, simulation: { asOf: "2026-06-30" } }, draft, "2026-10-30").cashAmount, 400);
});
