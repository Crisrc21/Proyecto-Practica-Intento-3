import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const source=await readFile(new URL("../src/modules/projects/data/project-history.ts",import.meta.url),"utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {stageReports,progressSeries,edpPayments}=await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
const project={areaM2:1000,units:10,progressReports:[
  {id:"later",stageKey:"fabricacion",date:"2026-03-01",quantity:800,completedUnits:8,percent:null},
  {id:"earlier",stageKey:"fabricacion",date:"2026-01-01",quantity:200,completedUnits:2,percent:null},
  {id:"unknown",stageKey:"fabricacion",date:"2026-02-01",quantity:null,completedUnits:5,percent:null},
  {id:"montage",stageKey:"montaje",date:"2026-02-01",quantity:2,completedUnits:null,percent:null}
],invoiceLinks:[{invoiceId:"i",milestoneId:"e"}]};
const m={id:"e",invoicingComplete:true};
const invoice={id:"i",numero:"123",monto:1000,anulada:false,notasCredito:[],notasDebito:[],pagos:[{fechaPago:"2026-02-01",monto:400},{fechaPago:"2026-03-01",monto:600}]};
test("history orders backdated reports chronologically and obeys the selected stage and cutoff",()=>{
  assert.deepEqual(stageReports(project,"fabricacion","2026-02-28").map(r=>r.id),["earlier","unknown"]);
  assert.equal(stageReports(project,"all","2026-02-28").length,3);
  assert.equal(project.progressReports[0].id,"later","history sorting must not mutate persisted order");
});
test("history chart retains unknown measurements and separate contractual units",()=>{
  const chart=progressSeries(project,"fabricacion","2026-03-31");
  assert.deepEqual(chart.points.map(p=>p.value),[200,null,800]);
  assert.equal(chart.unit,"m²");assert.equal(chart.target,1000);
  assert.equal(progressSeries(project,"montaje","2026-03-31").target,10);
  assert.equal(progressSeries(project,"total","2026-03-31").target,100);
});
test("EDP history only counts actual payments of this statement at the selected date",()=>{
  const partial=edpPayments(project,m,[invoice],"ready","2026-02-28");
  assert.equal(partial.paid,400); assert.equal(partial.completed,false); assert.equal(partial.payments.length,1);
  const full=edpPayments(project,m,[invoice],"ready","2026-03-31");
  assert.equal(full.paid,1000); assert.equal(full.completed,true); assert.equal(full.paidDate,"2026-03-01");
  assert.equal(edpPayments(project,{...m,id:"other"},[invoice],"ready","2026-03-31").paid,null);
});
test("missing source, partial invoicing and credits do not falsely complete the cash journey",()=>{
  assert.equal(edpPayments(project,m,[invoice],"error","2026-03-31").paid,null);
  assert.equal(edpPayments(project,m,[],"ready","2026-03-31").paid,null);
  assert.equal(edpPayments(project,{...m,invoicingComplete:false},[invoice],"ready","2026-03-31").completed,false);
  assert.equal(edpPayments(project,m,[{...invoice,pagos:[],notasCredito:[{fecha:"2026-02-01",monto:1000}]}],"ready","2026-03-31").completed,false);
});
