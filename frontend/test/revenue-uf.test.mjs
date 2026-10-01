import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const source = await readFile(new URL("../src/modules/projects/data/revenue-uf.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { invoiceTotals, presentedTotals } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
test("each invoice and its receipts use its own issue-date UF, without intermediate rounding", () => {
 const invoice = (id, date, monto, payment) => ({ id, fechaEmision: date, monto, anulada: false, notasCredito: [], notasDebito: [], pagos: [{ fechaPago: "2026-03-01", monto: payment }] });
 const invoices = [invoice("a", "2026-01-01", 80000, 40000), invoice("b", "2026-02-01", 100000, 100000)];
 const project = { invoiceLinks: [{invoiceId:"a"}, {invoiceId:"b"}, {invoiceId:"a"}] };
 const rates = { "2026-01-01":40000, "2026-02-01":50000 };
 assert.deepEqual(invoiceTotals(project, invoices, "ready", "2026-03-02", rates), {billed:4, paid:3});
 assert.deepEqual(invoiceTotals(project, invoices, "ready", "2026-03-02", {}, "CLP"), {billed:180000, paid:140000});
 assert.equal(invoiceTotals(project, invoices, "ready", "2026-02-02", rates).paid, 0);
 assert.deepEqual(invoiceTotals(project, invoices, "ready", "2026-03-02", {}), {billed:null, paid:null});
});

test("presented EDP keeps its own amount and converts using first invoice issue date", () => {
 const project = {currency:"UF", milestones:[{id:"e",type:"EDP",cashAmount:10,edp:{presentedDate:"2026-01-01"}}],invoiceLinks:[{milestoneId:"e",invoiceId:"a"},{milestoneId:"e",invoiceId:"b"}]};
 const invoices = [{id:"b",fechaEmision:"2026-02-01"},{id:"a",fechaEmision:"2026-01-01"}];
 assert.deepEqual(presentedTotals(project,invoices,"ready","2026-03-01",{"2026-01-01":40000,"2026-02-01":50000}),{uf:10,clp:400000});
 assert.deepEqual(presentedTotals(project,invoices,"ready","2026-03-01",{}),{uf:10,clp:null});
 assert.deepEqual(presentedTotals({...project,invoiceLinks:[]},invoices,"ready","2026-03-01",{"2026-01-01":40000}),{uf:10,clp:null});
});
