import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const source = await readFile(new URL("../src/modules/projects/data/retention-settlement.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { appliedRetentions } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
const edp = (retention, status = "Aprobado", approvedDate = "2026-01-10", applyRetention = true) => ({ type: "EDP", edp: { status, approvedDate }, settlement: { retention, applyRetention } });
test("retentions sum only approved EDP at cutoff with active deductions", () => {
  const project = { milestones: [edp(100), edp(50.25), edp(200, "Presentado"), edp(300, "Aprobado", "2026-03-01"), edp(400, "Aprobado", null), edp(500, "Aprobado", "2026-01-10", false), { ...edp(600), type: "Retenciones" }, { ...edp(700), type: "Anticipo" }] };
  assert.equal(appliedRetentions(project, "2026-02-01"), 150.25);
  assert.equal(appliedRetentions({ milestones: [] }, "2026-02-01"), 0);
  project.milestones[0].settlement.retention = 125;
  assert.equal(appliedRetentions(project, "2026-02-01"), 175.25);
});
