import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const source = await readFile(new URL("../src/modules/projects/data/edp-invoice-data.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { edpInvoiceData, withInvoiceDates } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
const project = { currency: "UF", invoiceLinks: [{ invoiceId: "i", milestoneId: "e" }], milestones: [{ id: "e", cashAmount: 50, source: "", edp: { documentOnly: true, status: "Previsto", presentedDate: null } }] };
const invoice = { id: "i", numero: "4000", monto: 2000000, fechaEmision: "2026-09-10", fechaVencimiento: "2026-10-10" };
test("linked invoice supplies amount in CLP, issuance and due date without changing UF estimate", () => {
  const data = edpInvoiceData(project, "e", [invoice], "ready");
  assert.equal(data.total, 2000000); assert.equal(data.currency, "CLP");
  const updated = withInvoiceDates(project, [invoice], "ready").milestones[0];
  assert.equal(updated.cashAmount, 50);
  assert.equal(updated.cashDate, invoice.fechaVencimiento);
  assert.equal(updated.edp.presentedDate, invoice.fechaEmision);
  assert.equal(updated.edp.status, "Presentado");
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
