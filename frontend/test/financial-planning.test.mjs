import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const source = await readFile(new URL("../src/modules/projects/data/financial-planning.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { financialPlanning } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
const m = { id: "e", type: "EDP", cashAmount: 1000, cashDate: "2026-09-28", baselineCashAmount: 1000, baselineCashDate: "2026-09-28", baselineApproved: true, invoicingComplete: true };
const p = { id: "p", currency: "CLP", milestones: [m], invoiceLinks: [{ invoiceId: "i", milestoneId: "e" }] };
const i = { id: "i", fechaEmision: "2026-09-01", monto: 1000, pagos: [{ fechaPago: "2026-09-24", monto: 200 }], notasCredito: [], notasDebito: [] };
const plan = (project = p, invoice = i, state = "ready", cutoff = "2026-09-25") => financialPlanning([project], [invoice], state, cutoff);
test("weekly forecast deducts receipts and month close counts actual plus remaining once", () => {
  const result = plan();
  assert.equal(result.weeks[0].start, "2026-09-21");
  assert.equal(result.weeks[1].total, 800);
  assert.equal(result.weeks[1].invoiced, 800);
  assert.equal(result.actual, 200);
  assert.equal(result.estimate, 1000);
});
test("unpaid past dates stay overdue until revised instead of silently entering a future week", () => {
  const result = plan({ ...p, milestones: [{ ...m, cashDate: "2026-09-22" }] });
  assert.equal(result.overdueAmount, 800);
  assert.equal(result.weeks.reduce((s, w) => s + w.total, 0), 0);
  assert.equal(result.estimate, null);
});
test("partial billing retains unbilled EDP remainder without adding invoice twice", () => {
  const result = plan({ ...p, milestones: [{ ...m, invoicingComplete: false }] }, { ...i, monto: 600 });
  assert.equal(result.rows[0].remaining, 800);
  assert.equal(result.rows[0].stage, "Facturación parcial");
});
test("missing accounting information and UF never become known zero receipts", () => {
  const missing = plan(p, i, "error");
  assert.equal(missing.rows[0].remaining, null);
  assert.equal(missing.actual, null);
  assert.equal(missing.weeks[1].unknown, 1);
  const uf = plan({ ...p, currency: "UF", ufValue: null, invoiceLinks: [] });
  assert.equal(uf.rows[0].remaining, null);
  assert.equal(uf.estimate, null);
});
test("credit notes reduce forecast but never constitute receipts", () => {
  const result = plan(p, { ...i, notasCredito: [{ fecha: "2026-09-24", monto: 100 }] });
  assert.equal(result.actual, 200);
  assert.equal(result.rows[0].remaining, 700);
  assert.equal(result.estimate, 900);
});
test("future invoices and payments do not create facturation or cash at an earlier cutoff", () => {
  const result = plan(p, { ...i, fechaEmision: "2026-10-01", pagos: [{ fechaPago: "2026-10-02", monto: 1000 }] });
  assert.equal(result.rows[0].billed, 0);
  assert.equal(result.rows[0].remaining, 1000);
  assert.equal(result.actual, 0);
  assert.equal(result.weeks[1].conditional, 1000);
});
test("simulation converts UF receipts and remaining balances consistently", () => {
  const project = { ...p, currency: "UF", simulation: { ufValue: 40000, invoices: [{ id: "i", issued: "2026-09-01", amountUF: 1000, payments: [{ date: "2026-09-24", amountUF: 200 }] }] } };
  const result = plan(project, i, "error");
  assert.equal(result.actual, 8000000);
  assert.equal(result.rows[0].remaining, 32000000);
  assert.equal(result.estimate, 40000000);
});
test("weeks crossing the year boundary and month-end include each scheduled receipt once", () => {
  const project = { ...p, milestones: [{ ...m, cashDate: "2027-01-01" }, { ...m, id: "e2", invoicingComplete: false, cashDate: "2026-12-31", cashAmount: 500 }] };
  const result = plan(project, i, "ready", "2026-12-30");
  assert.equal(result.weeks[0].start, "2026-12-28");
  assert.equal(result.weeks[0].total, 1300);
  assert.equal(result.pending, 500);
});
