import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const source=await readFile(new URL("../src/modules/projects/data/project-workflow.ts",import.meta.url),"utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {activeStages,physicalPercent,metricValue,advancePayment,workflowAtCutoff}=await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
const p={units:10,areaM2:1000,signedDate:"2026-01-01",milestones:[],invoiceLinks:[],progressReports:[
  {id:"r1",stageKey:"fabricacion",date:"2026-02-01",quantity:500,completedUnits:3,percent:null,evidence:"Informe"},
  {id:"r2",stageKey:"fabricacion",date:"2026-03-01",quantity:1000,completedUnits:10,percent:null,evidence:"Informe"}
]};
test("the two contract types preserve core stages and enable only selected turnkey works",()=>{
  const works=["interior","exterior","calles","otras"];
  assert.deepEqual(activeStages("fabricacion_montaje",works).map(s=>s.key),["firma","anticipo","fabricacion","despachos","fundaciones","montaje","total"]);
  assert.deepEqual(activeStages("llave_en_mano",["exterior","calles"]).map(s=>s.key),["firma","anticipo","fabricacion","despachos","fundaciones","montaje","exterior","calles","total"]);
  assert.equal(activeStages("llave_en_mano",works).length,11);
  assert.equal(physicalPercent({...p,progressReports:[{stageKey:"calles",date:"2026-02-01",percent:35}]},"calles","2026-02-28"),35);
});
test("m2 progress and completed homes stay separate and historical cutoff excludes later reports",()=>{
  assert.equal(physicalPercent(p,"fabricacion","2026-02-28"),50);
  assert.equal(metricValue(p,{stageKey:"fabricacion",metric:"terminadas"},"2026-02-28"),3);
  assert.equal(physicalPercent(p,"fabricacion","2026-03-31"),100);
  assert.equal(physicalPercent({...p,areaM2:null},"fabricacion","2026-02-28"),null);
  assert.equal(physicalPercent(p,"total","2026-02-28"),null,"total progress is not an invented average");
});
const advance={id:"advance",type:"Anticipo",invoicingComplete:true};
const bill={id:"inv",monto:1000,anulada:false,pagos:[{fechaPago:"2026-02-05",monto:400},{fechaPago:"2026-03-05",monto:600}],notasCredito:[],notasDebito:[]};
const financed={...p,milestones:[advance,{id:"stage",stageKey:"anticipo"},{id:"factory",stageKey:"fabricacion"}],invoiceLinks:[{invoiceId:"inv",milestoneId:"advance"}]};
test("advance is only paid using linked CxC receipts and respects partial payments and cutoff",()=>{
  assert.equal(advancePayment(financed,[bill],"ready","2026-02-28").percent,40);
  assert.equal(advancePayment(financed,[bill],"ready","2026-03-31").label,"Anticipo pagado");
  assert.equal(advancePayment(financed,[bill],"error","2026-03-31").paid,null);
  assert.equal(advancePayment(financed,[],"ready","2026-03-31").paid,null);
  const partial={...financed,milestones:[{...advance,invoicingComplete:false}]};
  assert.equal(advancePayment(partial,[bill],"ready","2026-03-31").percent,null,"paid invoice does not imply entire advance has been billed");
});
test("timeline derives advance receipt date and physical evidence without modifying stored project",()=>{
  const shown=workflowAtCutoff(financed,[bill],"ready","2026-03-31");
  assert.equal(shown.milestones.find(m=>m.id==="stage").actualDate,"2026-03-05");
  assert.equal(shown.milestones.find(m=>m.id==="factory").actualDate,"2026-03-01");
  const earlier=workflowAtCutoff(financed,[bill],"ready","2026-02-28");
  assert.equal(earlier.milestones.find(m=>m.id==="stage").actualDate,null);
  assert.equal(earlier.milestones.find(m=>m.id==="factory").actualDate,null);
  assert.equal(financed.milestones[1].actualDate,undefined);
});
test("credit notes without money do not mark an advance as paid",()=>{
  const credited={...bill,pagos:[],notasCredito:[{fecha:"2026-02-01",monto:1000}]};
  assert.equal(advancePayment(financed,[credited],"ready","2026-03-31").paid,0);
  assert.equal(advancePayment(financed,[credited],"ready","2026-03-31").percent,null);
});
test("repeated full-completion reports retain the date first reached",()=>{
  const repeated={...financed,progressReports:[...p.progressReports,{...p.progressReports[1],id:"r3",date:"2026-04-01"}]};
  assert.equal(workflowAtCutoff(repeated,[bill],"ready","2026-04-30").milestones.find(m=>m.id==="factory").actualDate,"2026-03-01");
});
