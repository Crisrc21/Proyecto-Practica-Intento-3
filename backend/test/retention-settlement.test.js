import test from "node:test";
import assert from "node:assert/strict";
import { synchronizeRetentions } from "../src/modules/projects/domain/retention-settlement.js";

const edp = (retention, presentedDate) => ({ type: "EDP", edp: { presentedDate }, settlement: { retention } });
test("synchronization uses current presentation dates and does not create a release", () => {
  const milestones = [edp(200, "2026-01-01"), edp(300, "2026-03-01"), edp(400, null), edp(500, "2027-01-01")];
  assert.equal(synchronizeRetentions({ milestones }, "2026-10-30").milestones.length, 4);
  const project = { milestones: [...milestones, { id: "r", type: "Retenciones", cashAmount: 200 }] };
  assert.equal(synchronizeRetentions(project, "2026-10-30").milestones.at(-1).cashAmount, 500);
  assert.equal(project.milestones.at(-1).cashAmount, 200);
  assert.equal(synchronizeRetentions({ ...project, simulation: { asOf: "2026-02-01" } }, "2026-10-30").milestones.at(-1).cashAmount, 200);
});
test("separate legacy release amounts are not multiplied by assigning the full total to each", () => {
  const project = { milestones: [edp(500, "2026-01-01"), { id: "r1", type: "Retenciones", cashAmount: 200 }, { id: "r2", type: "Retenciones", cashAmount: 300 }] };
  assert.deepEqual(synchronizeRetentions(project, "2026-10-30"), project);
});
