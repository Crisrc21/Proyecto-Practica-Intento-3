import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source=await readFile(new URL("../src/modules/projects/data/project-calculations.ts",import.meta.url),"utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {milestoneStatus,compliance,monthlyCash,received}=await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
const m={id:"edp",name:"EDP",type:"EDP",scope:"General",invoicingComplete:true,baselineApproved:true,baselineDate:"2026-01-31",forecastDate:"2026-02-28",actualDate:null,state:"Pendiente",cashAmount:1000,baselineCashAmount:1000,cashDate:"2026-03-01",baselineCashDate:"2026-02-01"};
const p={id:"p",currency:"CLP",ufValue:null,milestones:[m],invoiceLinks:[{invoiceId:"inv",milestoneId:"edp"}]};
const inv={id:"inv",monto:1000,anulada:false,pagos:[{fechaPago:"2026-01-31",monto:200},{fechaPago:"2026-02-01",monto:300}],notasCredito:[],notasDebito:[]};
test("unconfirmed past proposals do not count as noncompliance",()=>{
  const proposed={...m,baselineApproved:false};
  assert.equal(milestoneStatus(proposed,"2026-02-15"),"Propuesto");
  assert.equal(compliance({...p,milestones:[proposed]},"2026-02-15").due,0);
});
test("completion is measured against original baseline, not postponed forecast",()=>{
  const actual={...m,actualDate:"2026-02-10"};
  assert.equal(milestoneStatus(actual,"2026-02-15"),"Cumplido con atraso");
  assert.equal(milestoneStatus(actual,"2026-01-31"),"Sin evidencia");
  assert.equal(compliance({...p,milestones:[actual]},"2026-01-31").completed,0);
  assert.equal(compliance({...p,milestones:[actual]},"2026-02-15").onTime,0);
});
test("cash is grouped by payment date and respects cutoff, not invoice or EDP dates",()=>{
  const report=monthlyCash(p,[inv],"ready",2026,"2026-02-15","base");
  assert.equal(report.data[0].actual,200);
  assert.equal(report.data[1].actual,300);
  assert.equal(report.data[2].actual,null);
  assert.equal(report.data[1].variance,null,"open months have no full-month variance");
  assert.equal(received(p,[inv],"ready","2026-01-31"),200);
});
test("missing accounting source or unresolved invoice link is not reported as zero cash",()=>{
  for(const [invoices,state] of [[[inv],"error"],[[],"ready"]]) assert.equal(monthlyCash(p,invoices,state,2026,"2026-02-28","base").data[1].actual,null);
  assert.equal(received({...p,invoiceLinks:[]},[inv],"ready","2026-02-28"),null);
});
test("future forecast uses unpaid invoice balance instead of adding invoice and EDP",()=>{
  const report=monthlyCash(p,[inv],"ready",2026,"2026-02-28","current");
  assert.equal(report.data[2].planned,500);
  assert.equal(monthlyCash(p,[inv],"ready",2026,"2026-02-28","base").data[1].planned,1000);
});
test("missing UF and incomplete plans suppress misleading comparisons",()=>{
  const report=monthlyCash({...p,currency:"UF"},[inv],"ready",2026,"2026-02-28","base");
  assert.equal(report.missingUf,true);
  assert.equal(report.data[1].planned,null);
  assert.equal(report.data[1].variance,null);
  const partial=monthlyCash({...p,milestones:[m,{...m,id:"noamount",baselineCashAmount:null}]},[inv],"ready",2026,"2026-02-28","base");
  assert.equal(partial.data[1].complete,false);
  assert.equal(partial.data[1].variance,null);
});
test("partial billing keeps the unbilled remainder in the future cash projection",()=>{
  const partial={...p,milestones:[{...m,invoicingComplete:false}]};
  const smallInvoice={...inv,monto:600,pagos:[{fechaPago:"2026-02-01",monto:200}]};
  assert.equal(monthlyCash(partial,[smallInvoice],"ready",2026,"2026-02-28","current").data[2].planned,800);
  const full={...p,milestones:[{...m,invoicingComplete:true}]};
  assert.equal(monthlyCash(full,[smallInvoice],"ready",2026,"2026-02-28","current").data[2].planned,400);
});
test("fully invoiced cash can be projected in pesos without a UF assumption",()=>{
  const report=monthlyCash({...p,currency:"UF"},[inv],"ready",2026,"2026-02-28","current");
  assert.equal(report.missingUf,false);
  assert.equal(report.data[2].planned,500);
});
test("credit notes are not receipts and signed refund movements reduce received cash",()=>{
  const adjusted={...inv,notasCredito:[{fecha:"2026-02-02",monto:100}],pagos:[...inv.pagos,{fechaPago:"2026-02-10",monto:-50}]};
  assert.equal(received(p,[adjusted],"ready","2026-02-28"),450);
  assert.equal(monthlyCash(p,[adjusted],"ready",2026,"2026-02-28","current").data[2].planned,450);
});
