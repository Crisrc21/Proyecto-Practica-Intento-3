import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { applyWorkflow } from "../../backend/src/modules/projects/domain/project-workflow.js";
const source = await readFile(new URL("../src/modules/projects/data/edp-invoice-data.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { edpInvoiceData, withInvoiceDates } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
const project = { currency: "UF", invoiceLinks: [{ invoiceId: "i", milestoneId: "e" }], milestones: [{ id: "e", cashAmount: 50, source: "", edp: { documentOnly: true, status: "Previsto", presentedDate: null } }] };
const invoice = { id: "i", numero: "4000", monto: 2000000, fechaEmision: "2026-09-10", fechaVencimiento: "2026-10-10" };

test("invoice date updates preserve the manually recorded original expected payment date", () => {
  const p = { ...project, milestones: [{ ...project.milestones[0], originalExpectedCashDate: "2026-09-30" }] };
  const updated = withInvoiceDates(p, [invoice], "ready");
  assert.equal(updated.milestones[0].originalExpectedCashDate, "2026-09-30");
  assert.equal(updated.milestones[0].cashDate, "2026-10-10");
  const rescheduled = withInvoiceDates(updated, [{ ...invoice, fechaVencimiento: "2026-11-01" }], "ready");
  assert.equal(rescheduled.milestones[0].originalExpectedCashDate, "2026-09-30");
});
test("linked invoice supplies amount in CLP, issuance and due date without changing UF estimate", () => {
  const data = edpInvoiceData(project, "e", [invoice], "ready");
  assert.equal(data.total, 2000000); assert.equal(data.currency, "CLP");
  const updated = withInvoiceDates(project, [invoice], "ready").milestones[0];
  assert.equal(updated.cashAmount, 50);
  assert.equal(updated.cashDate, invoice.fechaVencimiento);
  assert.equal(updated.edp.presentedDate, null);
  assert.equal(updated.edp.status, "Previsto");
  assert.equal(updated.source, "");
});

test("linking, replacing and removing invoices preserve EDP presentation and approval", () => {
  const milestone = { ...project.milestones[0], source: "Documento del mandante", edp: { ...project.milestones[0].edp, status: "Aprobado", presentedDate: "2026-01-15", approvedDate: "2026-01-20", approvalEvidence: "Aprobación del mandante" } };
  const original = { ...project, lifecycle: "Firmado", progressReports: [], milestones: [milestone] };
  for (const changed of [
    original,
    { ...original, invoiceLinks: [{ invoiceId: "replacement", milestoneId: "e" }] },
    { ...original, invoiceLinks: [] }
  ]) {
    const updated = withInvoiceDates(changed, [invoice, { ...invoice, id: "replacement", fechaEmision: "2026-10-01" }], "ready");
    assert.deepEqual(updated.milestones[0].edp, milestone.edp);
    assert.equal(updated.milestones[0].source, milestone.source);
    assert.doesNotThrow(() => applyWorkflow(original, updated));
    assert.equal(updated.milestones[0].actualDate, "2026-01-20");
  }
  assert.equal(original.milestones[0].edp.presentedDate, "2026-01-15");
});

test("explicit presentation corrections survive saving and approval chronology is still enforced", () => {
  const original = { ...project, lifecycle: "Firmado", progressReports: [], milestones: [{ ...project.milestones[0], source: "Documento del mandante", edp: { ...project.milestones[0].edp, status: "Aprobado", presentedDate: "2026-01-15", approvedDate: "2026-01-20", approvalEvidence: "Aprobación" } }] };
  for (const date of ["2026-01-14", "2026-01-21", null]) {
    const edited = { ...original, milestones: original.milestones.map(m => ({ ...m, edp: { ...m.edp, presentedDate: date } })) };
    const updated = withInvoiceDates(edited, [invoice], "ready");
    assert.equal(updated.milestones[0].edp.presentedDate, date);
    if (date === "2026-01-14") assert.doesNotThrow(() => applyWorkflow(original, updated));
    else assert.throws(() => applyWorkflow(original, updated), date ? /aprobación no puede ser anterior/ : /fecha de presentación/);
  }
});
test("missing, unlinked and cancelled invoices do not show false zero amounts", () => {
  assert.equal(edpInvoiceData(project, "e", [], "error").total, null);
  assert.equal(edpInvoiceData({ ...project, invoiceLinks: [] }, "e", [invoice], "ready").total, null);
  assert.equal(edpInvoiceData(project, "e", [{ ...invoice, anulada: true }], "ready").total, null);
  assert.equal(withInvoiceDates(project, [], "error").milestones[0].edp.presentedDate, null);
});
test("several invoices retain individual dates and aggregate amount", () => {
  const p = { ...project, invoiceLinks: [...project.invoiceLinks, { invoiceId: "j", milestoneId: "e" }] };
  const second = { ...invoice, id: "j", fechaVencimiento: "2026-11-10", monto: 1000000 };
  const data = edpInvoiceData(p, "e", [invoice, second], "ready");
  assert.equal(data.total, 3000000); assert.equal(data.rows.length, 2);
  assert.equal(withInvoiceDates(p, [invoice, second], "ready").milestones[0].cashDate, "2026-11-10");
});
