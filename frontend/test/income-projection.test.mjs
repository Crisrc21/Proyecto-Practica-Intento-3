import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const source=await readFile(new URL("../src/modules/projects/data/income-projection.ts",import.meta.url),"utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {incomeProjection,projectionPeriods,plusTwoMonths,matrixProjected}=await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
const m={id:"e",name:"EDP 1",type:"EDP",cashAmount:1000,invoicingComplete:true,source:"https://example.com/edp",edp:{presentedDate:"2026-01-31"}};
const p={id:"p",currency:"CLP",milestones:[m],invoiceLinks:[{invoiceId:"i",milestoneId:"e"}]};
const i={id:"i",numero:"4000",fechaEmision:"2026-02-01",fechaVencimiento:"2026-03-01",monto:1000,pagos:[{fechaPago:"2026-03-10",monto:200}],notasCredito:[],notasDebito:[]};
for (const type of ["Anticipo", "Retenciones"]) {
 test(`${type}: projects the entered collection date without presentation or real payments`,()=>{
  const milestone={...m,type,source:"",edp:undefined,cashDate:"2026-05-15"};
  const project={...p,invoiceLinks:[],milestones:[milestone]};
  const rows=incomeProjection([project],[],"ready","2026-03-20");
  assert.equal(rows.length,1);
  assert.equal(rows[0].status,"Previsto sin factura");
  assert.equal(rows[0].original,"2026-05-15");
  assert.equal(rows[0].date,"2026-05-15");
  assert.equal(rows[0].pending,1000);
  assert.deepEqual(rows[0].payments,[]);
  const withPresentation=incomeProjection([{...project,milestones:[{...milestone,edp:m.edp,source:m.source}]}],[],"ready","2026-03-20");
  assert.equal(withPresentation[0].date,"2026-05-15");
  const moved=incomeProjection([{...project,incomeDates:{"edp:e":"2026-06-01"}}],[],"ready","2026-03-20");
  assert.equal(moved[0].original,"2026-05-15");assert.equal(moved[0].date,"2026-06-01");
  for(const incomplete of [{cashDate:null},{cashAmount:null}]) {
   assert.equal(incomeProjection([{...project,milestones:[{...milestone,...incomplete,source:m.source,edp:m.edp}]}],[],"ready","2026-03-20").length,0);
  }
  const ufProject={...project,currency:"UF",ufValue:40000};
  assert.equal(incomeProjection([ufProject],[],"ready","2026-03-20")[0].total,40000000);
  assert.equal(incomeProjection([{...ufProject,ufValue:null}],[],"ready","2026-03-20")[0].total,null);
 });
 test(`${type}: invoice replaces estimate and only invoice payments count as real`,()=>{
  const project={...p,milestones:[{...m,type,source:"",edp:undefined,cashDate:"2026-05-15"}],incomeDates:{"edp:e":"2026-06-01"}};
  const rows=incomeProjection([project],[i],"ready","2026-03-20");
  assert.equal(rows.length,1);assert.equal(rows[0].key,"invoice:i");
  assert.equal(rows[0].date,"2026-03-01");assert.equal(rows[0].pending,800);
  assert.deepEqual(rows[0].payments,[{date:"2026-03-10",amount:200}]);
  const unavailable=incomeProjection([project],[],"ready","2026-03-20");
  assert.equal(unavailable.length,1);assert.equal(unavailable[0].status,"Factura por verificar");
  assert.equal(unavailable[0].total,null);
 });
}
test("invoice projections preserve due dates, deduct payments and move only current balance",()=>{
 const rows=incomeProjection([{...p,incomeDates:{"invoice:i":"2026-04-15"}}],[i],"ready","2026-03-20");
 assert.equal(rows.length,1);assert.equal(rows[0].original,"2026-03-01");assert.equal(rows[0].date,"2026-04-15");assert.equal(rows[0].pending,800);
 const months=projectionPeriods(rows,"monthly","2026-03-20",2026,"2026-03-20");
 assert.equal(months[2].expected,1000);assert.equal(months[2].paid,200);assert.equal(months[3].pending,800);
});
test("unbilled EDP uses calendar months and linked invoice replaces the EDP estimate",()=>{
 assert.equal(plusTwoMonths("2026-12-31"),"2027-02-28");
 const rows=incomeProjection([{...p,invoiceLinks:[]}],[],"ready","2026-03-20");
 assert.equal(rows[0].date,"2026-03-31");assert.equal(rows[0].total,1000);
 const partial=incomeProjection([{...p,milestones:[{...m,invoicingComplete:false}]}],[{...i,monto:600}],"ready","2026-03-20");
 assert.equal(partial.length,1);assert.equal(partial[0].total,600);assert.equal(partial[0].pending,400);assert.equal(partial[0].variance,-400);
});
test("unknown UF remains unknown and an EDP without financial information is excluded",()=>{
 const rows=incomeProjection([{...p,currency:"UF",invoiceLinks:[]}],[],"ready","2026-03-20");assert.equal(rows[0].total,null);
 assert.equal(incomeProjection([{...p,invoiceLinks:[],milestones:[{...m,source:"",edp:{}}]}],[],"ready","2026-03-20").length,0);
});

test("matrix preserves original comparison and moves only unpaid balance",()=>{
 const rows=incomeProjection([{...p,incomeDates:{"invoice:i":"2026-04-15"}}],[i],"ready","2026-03-20");
 assert.equal(matrixProjected(rows,"2026-03-01","2026-03-31","original"),1000);
 assert.equal(matrixProjected(rows,"2026-04-01","2026-04-30","original"),0);
 assert.equal(matrixProjected(rows,"2026-03-01","2026-03-31","current"),200);
 assert.equal(matrixProjected(rows,"2026-04-01","2026-04-30","current"),800);
});

test("planning covers January 2026 through December 2027 without gaps",()=>{
 for(const mode of ["weekly","monthly"]) {
  const periods=projectionPeriods([],mode,"2026-01-01",2026,"2026-09-30","2027-12-31");
  assert.equal(periods[0].from,"2026-01-01");assert.equal(periods.at(-1).to,"2027-12-31");
  for(let i=1;i<periods.length;i++) assert.equal(Date.parse(periods[i].from)-Date.parse(periods[i-1].to),86400000);
  if(mode==="monthly")assert.equal(periods.length,24);
 }
 const rows=[{original:"2027-12-31",date:"2027-12-31",total:100,pending:100,payments:[]}];
 assert.equal(projectionPeriods(rows,"monthly","2026-01-01",2026,"2026-09-30","2027-12-31").at(-1).pending,100);
});

test("invoiced EDP without a UF assumption does not create an unknown remainder row",()=>{
 const project={...p,currency:"UF",ufValue:null,milestones:[{...m,invoicingComplete:false}],incomeDates:{"invoice:i":"2026-11-16","edp:e":"2026-11-16"}};
 const rows=incomeProjection([project],[i],"ready","2026-09-30");
 assert.equal(rows.length,1);
 assert.equal(rows[0].key,"invoice:i");
 assert.equal(rows[0].date,"2026-11-16");
 assert.equal(rows[0].total,1000);
 assert.equal(rows[0].pending,800);
 assert.equal(rows[0].variance,null);
 const missingAmount=incomeProjection([{...p,milestones:[{...m,cashAmount:null,invoicingComplete:false}]}],[i],"ready","2026-09-30");
 assert.equal(missingAmount.length,1);
});

test("invoice differences of either sign are informational, never additional projected income",()=>{
 for(const monto of [600,1000,1300]) {
  const rows=incomeProjection([{...p,milestones:[{...m,invoicingComplete:false}]}],[{...i,monto}],"ready","2026-09-30");
  assert.equal(rows.length,1);assert.equal(rows[0].total,monto);assert.equal(rows[0].variance,monto-1000);
 }
});
