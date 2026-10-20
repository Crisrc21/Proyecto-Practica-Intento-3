import test from "node:test";
import assert from "node:assert/strict";
import { createProjectsService } from "../src/modules/projects/application/projects-service.js";

function service() {
  let data = { projects: [] };
  return createProjectsService({ read: async () => structuredClone(data), transaction: async fn => { const draft = structuredClone(data); const result = fn(draft); data = draft; return result; } });
}
function project() {
  return { id: "programming-test", name: "Contrato de prueba", customer: "Mandante", customerRut: "", owner: "", location: "", units: 20, areaM2: 1000,
    lifecycle: "Firmado", nature: "fabricacion_montaje", includedWorks: [], contractType: "Suma alzada", currency: "UF", contractAmount: 2000,
    signedDate: "2026-01-01", startDate: null, endDate: null, ufValue: 40000, approvedFolder: "", paymentTerms: "", notes: "", scopes: [], sources: [], issues: [], invoiceLinks: [],
    progressReports: [{ id: "report-first", stageKey: "fabricacion", date: "2026-02-01", evidence: "Primer EDP presentado", quantity: 500, completedUnits: 10, percent: null }],
    milestones: [edp("first", 10, "Presentado"), edp("second", 20, "Previsto")] };
}
function edp(id, threshold, status) {
  return { id, name: `EDP ${id}`, type: "EDP", scope: "Fabricación", startDate: null, baselineDate: null, forecastDate: "2026-03-01", actualDate: null,
    baselineApproved: false, state: "Pendiente", evidence: "", notes: "", source: "Documento EDP 1", invoicingComplete: false,
    settlement: { gross: 1000, advanceRecovery: 200, retention: 50 }, cashAmount: 750, cashDate: "2026-03-31", baselineCashAmount: null, baselineCashDate: null,
    edp: { stageKey: "fabricacion", metric: "terminadas", threshold, status, triggeredDate: null, presentedDate: status === "Presentado" ? "2026-02-02" : null, approvedDate: null, approvalEvidence: "" } };
}
const plan = () => ({ sourceMilestoneId: "first", reference: "Carpeta / EDP 1 presentado", milestoneIds: ["first", "second"], contractAmount: 2000, currency: "UF" });
const save = (s, p) => s.save({ project: p, expectedRevision: p.revision || 0 });

test("financial EDP programming persists without progress reports or physical activation", async () => {
  const p = { ...project(), edpPlan: plan(), progressReports: [] };
  for (const m of p.milestones) {
    m.scope = "General";
    m.edp = { ...m.edp, stageKey: "total", metric: "totalPct", threshold: 1, documentOnly: true };
  }
  const saved = await save(service(), p);
  const next = saved.milestones.find(m => m.id === "second");
  assert.equal(next.edp.documentOnly, true);
  assert.equal(next.edp.status, "Previsto");
  assert.equal(next.edp.triggeredDate, null);
  assert.equal(next.cashAmount, 750);
  assert.equal(next.baselineCashAmount, 750);
});

test("first presented document establishes a persistent baseline without fabricating future progress, invoices or receipts", async () => {
  const s = service();
  const p = await save(s, { ...project(), edpPlan: plan() });
  assert.equal(p.progressReports.length, 1);
  assert.equal(p.milestones.find(m => m.id === "first").edp.status, "Presentado");
  assert.equal(p.milestones.find(m => m.id === "second").edp.status, "Previsto");
  assert.equal(p.milestones.find(m => m.id === "second").baselineCashAmount, 750);
  assert.equal(p.invoiceLinks.length, 0);
  assert.deepEqual((await s.list()).projects[0].edpPlan, plan());
  const updated = await save(s, { ...p, milestones: p.milestones.map(m => m.id === "second" ? { ...m, cashDate: "2026-04-15" } : m) });
  assert.equal(updated.milestones.find(m => m.id === "second").baselineCashDate, "2026-03-31");
  assert.match(updated.history.at(-1).changes.join(" "), /2026-04-15/);
});

test("programming rejects an unpresented source, duplicated EDP, missing amounts and impossible payment dates", async () => {
  for (const change of [
    p => { p.edpPlan.sourceMilestoneId = "second"; },
    p => { p.edpPlan.milestoneIds.push("second"); },
    p => { p.milestones[1].settlement = undefined; },
    p => { p.milestones[1].cashDate = "2026-02-10"; },
    p => { p.edpPlan.contractAmount = 1; },
    p => { p.edpPlan.currency = "CLP"; }
  ]) {
    const p = { ...project(), edpPlan: plan() }; change(p);
    await assert.rejects(save(service(), p), e => e.statusCode === 400);
  }
});

test("source and original membership cannot be removed or rewritten, but the current forecast can grow", async () => {
  const s = service(), p = await save(s, { ...project(), edpPlan: plan() });
  for (const next of [undefined, { ...p.edpPlan, reference: "Rewritten" }, { ...p.edpPlan, milestoneIds: ["first"] }]) {
    await assert.rejects(save(s, { ...p, edpPlan: next }), /programación inicial/);
  }
  await assert.rejects(save(s, { ...p, milestones: p.milestones.filter(m => m.id !== "second") }), /EDP programado/);
  const updated = await save(s, { ...p, milestones: [...p.milestones, edp("third", 20, "Previsto")] });
  assert.deepEqual(updated.edpPlan.milestoneIds, ["first", "second"]);
});

test("potential creation requires mandante and remains outside the financial process", async () => {
  const p = { ...project(), lifecycle: "Potencial", signedDate: null, nature: null, units: 0, areaM2: null, contractAmount: null, progressReports: [], milestones: [] };
  await assert.rejects(save(service(), { ...p, customer: "" }), /mandante/);
  const saved = await save(service(), p);
  assert.equal(saved.lifecycle, "Potencial");
  assert.equal(saved.milestones.length, 0);
});
