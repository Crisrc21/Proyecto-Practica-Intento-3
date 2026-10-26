import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProjectsRepository } from "../src/modules/projects/infrastructure/local-projects-repository.js";
import { createProjectsService } from "../src/modules/projects/application/projects-service.js";
import { validateProject } from "../src/modules/projects/domain/project-validation.js";

test("project EDP conditions persist independently of existing EDP amounts and rates", async t => {
  const { service } = await setup(t);
  const edpConditions = { reference: "Contrato / condiciones", retentionPercent: 3, recoveryPercent: 10 };
  const settlement = { gross: 1000, advanceRecovery: 100, retention: 30, recoveryPercent: 10, retentionPercent: 3, taxMode: "iva19-ceec309" };
  const saved = await service.save({ project: project({ edpConditions, milestones: [milestone({ settlement, cashAmount: 1008 })] }), expectedRevision: 0 });
  assert.deepEqual(saved.edpConditions, edpConditions);
  assert.equal(saved.milestones[0].settlement.recoveryPercent, 10);
  const changed = await service.save({ project: { ...saved, edpConditions: { ...edpConditions, recoveryPercent: 0 } }, expectedRevision: saved.revision });
  assert.deepEqual(changed.milestones, saved.milestones);
  assert.equal((await service.list()).projects[0].edpConditions.recoveryPercent, 0);
  assert(changed.history.at(-1).changes.some(c => c.includes("Condiciones EDP")));
  for (const recoveryPercent of [-1, 101, "20", null, 98]) {
    assert.throws(() => validateProject(project({ edpConditions: { ...edpConditions, recoveryPercent } })));
  }
  assert.throws(() => validateProject(project({ milestones: [milestone({ settlement: { ...settlement, recoveryPercent: 20 }, cashAmount: 1008 })] })), /porcentaje/);
});

test("declared EDP total persists and rejects invalid quantities", async t => {
  const { service } = await setup(t);
  const saved = await service.save({ project: project({ milestones: [milestone({ edpCount: 12 })] }), expectedRevision: 0 });
  assert.equal(saved.milestones.find(m => m.id === "edp1").edpCount, 12);
  for (const edpCount of [0, -1, 1.5, 451]) {
    assert.throws(() => validateProject(project({ milestones: [milestone({ edpCount })] })), /EDP/);
  }
});

function milestone(overrides={}) {
  return { id: "edp1", name: "EDP enero", type: "EDP", scope: "General", startDate: "2026-01-01", baselineDate: "2026-01-31", forecastDate: "2026-01-31", actualDate: null, baselineApproved: true, state: "Pendiente", evidence: "", source: "Contrato", notes: "", cashAmount: 100, baselineCashAmount: 100, cashDate: "2026-02-20", baselineCashDate: "2026-02-20", ...overrides };
}
test("EDP net deducts recoveries, retentions, discounts and fines with signed adjustments", () => {
  const settlement = { gross: 1000, advanceRecovery: 200, retention: 50, discounts: 20, penalties: 10, adjustments: -30 };
  const valid = project({ milestones: [milestone({ settlement, cashAmount: 690 })] });
  assert.equal(validateProject(valid).milestones[0].settlement.adjustments, -30);
  assert.throws(() => validateProject(project({ milestones: [milestone({ settlement, cashAmount: 750 })] })), /neto/);
  assert.throws(() => validateProject(project({ milestones: [milestone({ settlement, cashAmount: null })] })), /neto/);
  assert.throws(() => validateProject(project({ milestones: [milestone({ settlement: { ...settlement, adjustments: NaN }, cashAmount: 690 })] })), /ajuste/);
  const legacy = validateProject(project({ milestones: [milestone({ settlement: { gross: 1000, advanceRecovery: 200, retention: 50 }, cashAmount: 750 })] }));
  assert.equal(legacy.milestones[0].settlement.discounts, 0);
});
test("EDP subtracts CEEC from net plus VAT and persists its calculation mode", async t => {
  const { service } = await setup(t);
  const settlement = { gross: 100000, advanceRecovery: 20000, retention: 5000, taxMode: "iva19-ceec309" };
  const valid = project({ milestones: [milestone({ settlement, cashAmount: 86932, baselineCashAmount: 86932 })] });
  const saved = await service.save({ project: valid, expectedRevision: 0 });
  assert.equal(saved.milestones[0].settlement.taxMode, "iva19-ceec309");
  assert.equal(saved.milestones[0].cashAmount, 75000 + 14250 - 2318);
  assert.throws(() => validateProject(project({ milestones: [milestone({ settlement, cashAmount: 75000 + 14250 + 2318 })] })), /CEEC/);
  assert.throws(() => validateProject(project({ milestones: [milestone({ settlement: { ...settlement, retention: 90000 }, cashAmount: 0 })] })), /CEEC/);
});
test("documentary EDP can be presented without creating physical progress", async t => {
  const { service } = await setup(t);
  const edp = { stageKey: "fabricacion", metric: "m2", threshold: 1, documentOnly: true, status: "Presentado", presentedDate: "2026-02-01", triggeredDate: null, approvedDate: null, approvalEvidence: "" };
  const saved = await service.save({ expectedRevision: 0, project: project({ nature: "fabricacion_montaje", areaM2: 500, milestones: [milestone({ source: "EDP presentado 1", edp })] }) });
  assert.equal(saved.milestones.find(m => m.id === "edp1").edp.status, "Presentado");
  assert.equal(saved.milestones.find(m => m.id === "edp1").edp.triggeredDate, null);
  assert.equal(saved.progressReports.length, 0);
});
test("EDP pending invoice saves without base or invoice dates and keeps existing baselines", async t => {
  const { service } = await setup(t);
  const pending = milestone({ id: "pending", baselineApproved: false, baselineDate: null, forecastDate: null, cashDate: null, baselineCashDate: null, edp: { stageKey: "fabricacion", metric: "m2", threshold: 1, documentOnly: true, status: "Previsto", presentedDate: null, approvedDate: null, triggeredDate: null, approvalEvidence: "" } });
  const saved = await service.save({ expectedRevision: 0, project: project({ nature: "fabricacion_montaje", areaM2: 500, milestones: [milestone(), pending] }) });
  const result = saved.milestones.find(m => m.id === "pending");
  assert.equal(result.baselineApproved, false);
  assert.equal(result.baselineDate, null);
  assert.equal(result.cashDate, null);
  assert.equal(result.edp.presentedDate, null);
  assert.equal(saved.milestones.find(m => m.id === "edp1").baselineDate, "2026-01-31");
});
function project(overrides={}) {
  return { id:"test-project", name:"Proyecto de prueba", customer:"Cliente de prueba", customerRut:"", location:"", owner:"", units:10, contractType:"Suma alzada", currency:"UF", contractAmount:1000, signedDate:"2026-01-01", startDate:"2026-01-01", endDate:"2026-12-31", ufValue:null, approvedFolder:"", paymentTerms:"", notes:"", scopes:[], sources:[], issues:[], milestones:[milestone()], invoiceLinks:[], ...overrides };
}
async function setup(t) {
  const folder = await mkdtemp(join(tmpdir(),"cxc-projects-test-"));
  t.after(()=>rm(folder,{recursive:true,force:true,maxRetries:4,retryDelay:100}));
  const repo = createProjectsRepository({dataPrivatePath:folder});
  return {folder, repo, service:createProjectsService(repo)};
}
test("deleting a project persists removal, preserves other projects and rejects stale changes", async t => {
  const { service, repo, folder } = await setup(t);
  const first = await service.save({ project: project(), expectedRevision: 0 });
  const other = await service.save({ project: project({ id: "other-project" }), expectedRevision: 0 });
  await assert.rejects(service.remove({ id: first.id, expectedRevision: 2 }), e => e.statusCode === 409);
  assert.equal((await service.list()).projects.length, 2);
  assert.deepEqual(await service.remove({ id: first.id, expectedRevision: first.revision }), { id: first.id });
  assert.deepEqual((await service.list()).projects.map(p => p.id), [other.id]);
  const stored = await createProjectsRepository({ dataPrivatePath: folder }).read();
  assert.equal(stored.projects.length, 1);
  assert.equal(stored.deletedProjects[0].id, first.id);
  assert.deepEqual(stored.projects[0], (await repo.read()).projects[0]);
  await assert.rejects(service.remove({ id: first.id, expectedRevision: 1 }), e => e.statusCode === 404);
  await assert.rejects(service.save({ project: first, expectedRevision: first.revision }), e => e.statusCode === 409);
});
test("project saves persist across repository instances and preserve history",async t=>{
  const {folder,service}=await setup(t);
  const p=await service.save({project:project(),expectedRevision:0,reason:"Alta"});
  assert.equal(p.revision,1);
  const next=await service.save({project:{...p,milestones:[{...p.milestones[0],forecastDate:"2026-02-05"}]},expectedRevision:1,reason:"Cambio de programación"});
  assert.equal(next.milestones[0].baselineDate,"2026-01-31");
  assert.equal(next.history.length,2);
  assert(next.history[1].changes.some(c=>c.includes("2026-01-31 → 2026-02-05")));
  const stored=await createProjectsRepository({dataPrivatePath:folder}).read();
  assert.equal(stored.projects[0].milestones[0].forecastDate,"2026-02-05");
  assert.equal(JSON.parse(await readFile(join(folder,"projects.json"),"utf8")).schemaVersion,1);
});
test("concurrent updates cannot overwrite a more recent revision",async t=>{
  const {service}=await setup(t);
  const p=await service.save({project:project(),expectedRevision:0,reason:"Alta"});
  const results=await Promise.allSettled([service.save({project:{...p,owner:"A"},expectedRevision:1,reason:"A"}),service.save({project:{...p,owner:"B"},expectedRevision:1,reason:"B"})]);
  assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
  assert.equal(results.find(r=>r.status==="rejected").reason.statusCode,409);
});
test("confirmed baseline and its cash assumptions cannot be overwritten",async t=>{
  const {service}=await setup(t);
  const p=await service.save({project:project(),expectedRevision:0,reason:"Alta"});
  for(const patch of [{baselineDate:"2026-02-01"},{baselineApproved:false},{baselineCashAmount:200},{baselineCashDate:"2026-03-01"}]) {
    await assert.rejects(service.save({project:{...p,milestones:[{...p.milestones[0],...patch}]},expectedRevision:1,reason:"Intento"}),e=>e.statusCode===400);
  }
});
test("invoices cannot be counted in multiple projects or twice in one project",async t=>{
  const {service}=await setup(t);
  await service.save({project:project({invoiceLinks:[{invoiceId:"inv1",milestoneId:"edp1"}]}),expectedRevision:0,reason:"Alta"});
  await assert.rejects(service.save({project:project({id:"second",invoiceLinks:[{invoiceId:"inv1",milestoneId:"edp1"}]}),expectedRevision:0,reason:"Alta"}),e=>e.statusCode===409);
  assert.throws(()=>validateProject(project({invoiceLinks:[{invoiceId:"inv2",milestoneId:"edp1"},{invoiceId:"inv2",milestoneId:"edp1"}]})),/dos veces/);
});
test("completion requires evidence and a valid non-future date",()=>{
  assert.throws(()=>validateProject(project({milestones:[milestone({actualDate:"2026-02-05"})]})),/evidencia/);
  assert.throws(()=>validateProject(project({milestones:[milestone({forecastDate:"2026-02-30"})]})),/Fecha inválida/);
  assert.throws(()=>validateProject(project({milestones:[milestone({actualDate:"2099-01-01",evidence:"Acta"})]})),/futuro/);
});
test("zero is a valid projected amount; empty amounts remain unknown",()=>{
  assert.equal(validateProject(project({milestones:[milestone({cashAmount:0})]})).milestones[0].cashAmount,0);
  assert.equal(validateProject(project({milestones:[milestone({cashAmount:null})]})).milestones[0].cashAmount,null);
});

function potential(overrides={}) { return project({ lifecycle:"Potencial", nature:1, areaM2:1000, signedDate:null, milestones:[], progressReports:[], ...overrides }); }
function progress(overrides={}) { return { id:"cut-1", stageKey:"fabricacion", date:"2026-02-01", evidence:"Informe de producción 1", quantity:100, completedUnits:1, percent:null, ...overrides }; }
function edp(overrides={}) { return milestone({ id:"edp-progress", name:"EDP por fabricación", baselineApproved:false, actualDate:null, edp:{ stageKey:"fabricacion", metric:"m2", threshold:100, status:"Previsto", triggeredDate:null, presentedDate:null, approvedDate:null, approvalEvidence:"" }, ...overrides }); }
async function activate(service, nature=1) {
  const draft=await service.save({project:potential({nature}),expectedRevision:0,reason:"Potencial"});
  return service.save({project:{...draft,lifecycle:"Firmado",signedDate:"2026-01-01"},expectedRevision:1,reason:"Contrato firmado"});
}
async function update(service,p,patch) { return service.save({project:{...p,...patch},expectedRevision:p.revision,reason:"Seguimiento"}); }

test("contract classification is descriptive and does not create stages", async t => {
  for (const nature of [1,2,3,4]) {
    const {service}=await setup(t); let p=await activate(service,nature);
    assert.deepEqual(p.milestones,[]);
    p=await update(service,p,{nature:"llave_en_mano",includedWorks:["interior","calles","otras"]});
    assert.deepEqual(p.includedWorks,["interior","calles","otras"]);
    assert.deepEqual(p.milestones,[]);
    assert.deepEqual(p.progressReports,[]);
    await assert.rejects(update(service,p,{lifecycle:"Potencial"}),/no puede volver/);
  }
});
test("EDP presentation and approval are independent of contract type and physical progress",async t=>{
  const {service}=await setup(t); let p=await activate(service);
  const item=edp({edp:{...edp().edp,stageKey:"exterior",metric:"exteriorPct",threshold:50,status:"Presentado",presentedDate:"2026-02-03"}});
  p=await update(service,p,{milestones:[item]});
  assert.equal(p.nature,"fabricacion_montaje");
  assert.deepEqual(p.includedWorks,[]);
  assert.deepEqual(p.progressReports,[]);
  const setEdp=patch=>p.milestones.map(m=>({...m,edp:{...m.edp,...patch}}));
  await assert.rejects(update(service,p,{milestones:setEdp({status:"Aprobado",approvedDate:"2026-02-04"})}),/referencia/);
  p=await update(service,p,{milestones:setEdp({status:"Aprobado",approvedDate:"2026-02-04",approvalEvidence:"EDP aprobado"})});
  assert.equal(p.milestones[0].actualDate,"2026-02-04");
  p=await update(service,p,{nature:"llave_en_mano",includedWorks:["interior"]});
  p=await update(service,p,{nature:"fabricacion_montaje",includedWorks:[]});
  assert.equal(p.milestones[0].edp.status,"Aprobado");
  await assert.rejects(update(service,p,{milestones:setEdp({status:"Previsto"})}),/conserva su estado/);
});
test("editing classification preserves historical evidence and existing financial commitments",async t=>{
  const {service}=await setup(t);
  let p=await service.save({project:project({nature:"llave_en_mano",includedWorks:["interior"],progressReports:[progress({stageKey:"interior",quantity:null,completedUnits:null,percent:20})]}),expectedRevision:0});
  const before=structuredClone(p);
  p=await update(service,p,{nature:"fabricacion_montaje",includedWorks:[]});
  assert.deepEqual(p.milestones,before.milestones);
  assert.deepEqual(p.progressReports,before.progressReports);
  assert.deepEqual(p.invoiceLinks,before.invoiceLinks);
  await assert.rejects(update(service,p,{progressReports:[]}),/se conservan/);
});

test("a potential requires name and mandante, and signing unlocks contractual details",async t=>{
  const {service}=await setup(t);
  const p=await service.save({project:potential({name:"Nuevo potencial",customer:"Mandante potencial",nature:null,units:0,areaM2:null,contractAmount:null}),expectedRevision:0});
  assert.equal(p.customer,"Mandante potencial");
  assert.equal(p.history[0].reason,"Contrato potencial agregado");
  const signed=await service.save({project:{...p,lifecycle:"Firmado",signedDate:"2026-01-01"},expectedRevision:p.revision});
  assert.equal(signed.lifecycle,"Firmado");
  assert.equal(signed.customer,"Mandante potencial");
  assert(signed.history.at(-1).changes.some(c=>c.includes("Potencial → Firmado")));
  await assert.rejects(service.save({project:potential({id:"blank",name:"   ",customer:""}),expectedRevision:0}),/nombre/);
});
test("updates require no written reason and record the six new scopes in automatic history",async t=>{
  const {service}=await setup(t);
  let p=await service.save({project:project(),expectedRevision:0});
  for (const scope of ["Fabricación","Despacho","Fundaciones","Montaje","Urbanización Interior","Urbanización Exterior"]) {
    p=await service.save({project:{...p,milestones:p.milestones.map(m=>({...m,scope}))},expectedRevision:p.revision});
    assert.equal(p.milestones[0].scope,scope);
    assert(p.history.at(-1).changes.some(c=>c.includes(`alcance:`) && c.endsWith(scope)));
    assert(p.history.at(-1).reason);
  }
});


test("legacy stored classifications migrate without rewriting evidence, revisions or baseline",async t=>{
  const {folder,repo,service}=await setup(t);
  const legacy=[1,2,3,4].map(n=>project({id:'legacy-'+n,nature:n,revision:7,history:[{id:'h',reason:'Original'}],progressReports:[]}));
  const original=JSON.stringify({schemaVersion:1,projects:legacy});
  await writeFile(join(folder,'projects.json'),original);
  const loaded=await service.list();
  assert.deepEqual(loaded.projects.map(p=>p.nature),['fabricacion_montaje','llave_en_mano','llave_en_mano','llave_en_mano']);
  assert.deepEqual(loaded.projects.map(p=>p.includedWorks),[[],['interior'],['interior','exterior'],['exterior']]);
  for (const p of loaded.projects) { assert.equal(p.revision,7); assert.deepEqual(p.milestones,legacy[0].milestones); assert.deepEqual(p.history,legacy[0].history); }
  assert.equal(await readFile(join(folder,'projects.json'),'utf8'),original,'read-only migration must not rewrite private data');
  const saved=await service.save({project:loaded.projects[3],expectedRevision:7});
  assert.equal(saved.revision,8); assert.deepEqual(saved.milestones,validateProject(legacy[3]).milestones);
  assert.equal((await repo.read()).projects[3].nature,'llave_en_mano');
});

test("contractual works can change independently of historical reports and EDP",async t=>{
  const {service}=await setup(t);
  let p=await service.save({project:project({nature:'llave_en_mano',includedWorks:['calles','otras'],milestones:[],progressReports:[]}),expectedRevision:0});
  assert.deepEqual(p.milestones,[]);
  p=await update(service,p,{milestones:[...p.milestones,edp({edp:{stageKey:'calles',metric:'callesPct',threshold:50,status:'Previsto',triggeredDate:null,presentedDate:null,approvedDate:null,approvalEvidence:''}})],progressReports:[progress({stageKey:'calles',quantity:null,completedUnits:null,percent:60})]});
  assert.equal(p.milestones.at(-1).edp.status,'Previsto');
  p=await update(service,p,{includedWorks:['otras']});
  p=await update(service,p,{nature:'fabricacion_montaje',includedWorks:[]});
  assert.throws(()=>validateProject({...p,includedWorks:['inexistente']}),/Alcances/);
});

test("invoice relations preserve normalized tags, support reassignment and prevent duplicate receipts",async t=>{
  const {service,repo}=await setup(t);
  let p=await service.save({project:project({milestones:[milestone(),milestone({id:'edp2',name:'EDP febrero'})],invoiceLinks:[{invoiceId:'inv1',milestoneId:'edp1',tags:[' Lote Norte ','lote norte','Fabricación']}]}),expectedRevision:0});
  assert.deepEqual(p.invoiceLinks[0].tags,['lote norte','fabricación']);
  p=await update(service,p,{invoiceLinks:[{invoiceId:'inv1',milestoneId:'edp2',tags:['montaje']},{invoiceId:'inv2',milestoneId:'edp2',tags:[]}]});
  assert.equal(p.invoiceLinks.length,2);
  assert.equal((await repo.read()).projects[0].invoiceLinks[0].milestoneId,'edp2');
  assert.deepEqual(p.invoiceLinks[0].tags,['montaje']);
  assert(p.history.at(-1).changes.some(c=>c.includes('facturas')));
  await assert.rejects(update(service,p,{invoiceLinks:[...p.invoiceLinks,{invoiceId:'inv1',milestoneId:'edp1'}]}),/dos veces/);
  await assert.rejects(update(service,p,{invoiceLinks:[{invoiceId:'inv1',milestoneId:'missing'}]}),/no existe/);
  assert.throws(()=>validateProject({...p,invoiceLinks:[{invoiceId:'inv1',milestoneId:'edp1',tags:Array(13).fill('tag')}]}),/12 etiquetas/);
  assert.throws(()=>validateProject({...p,invoiceLinks:[{invoiceId:'inv1',milestoneId:'edp1',tags:['x'.repeat(51)]}]}),/etiqueta/);
});

test("EDP preserves multiple housing details", async t => {
  const { service } = await setup(t);
  const detailKeys = ["fabricacion", "interior", "montaje"];
  const saved = await service.save({ project: project({ milestones: [milestone({ detailKeys })] }), expectedRevision: 0 });
  assert.deepEqual(saved.milestones.find(m => m.id === "edp1").detailKeys, detailKeys);
  assert.throws(() => validateProject(project({ milestones: [milestone({ detailKeys: ["invalid"] })] })), /Detalles/);
});

test("monthly production preserves period amounts and accumulates without duplicates", () => {
  const report = (id, period, periodQuantity, quantity) => ({ id, stageKey: "fabricacion", date: `${period}-28`, period, periodQuantity, quantity, completedUnits: null, percent: null, evidence: "Registro mensual" });
  const a = report("a", "2026-01", 100, 100), b = report("b", "2026-02", 50, 150);
  const input = project({ signedDate: "2026-01-01", areaM2: 500, progressReports: [a, b] });
  assert.equal(validateProject(input).progressReports[1].periodQuantity, 50);
  assert.equal(validateProject(input).progressReports[1].quantity, 150);
  assert.throws(() => validateProject({ ...input, progressReports: [a, { ...b, quantity: 50 }] }), /acumulado/);
  assert.throws(() => validateProject({ ...input, progressReports: [a, { ...a, id: "duplicate" }] }), /período/);
});

test("income projection dates persist independently of original milestone dates", async t => {
 const { service } = await setup(t);
 const first = await service.save({project:project(),expectedRevision:0});
 const changed = await service.save({project:{...first,incomeDates:{"edp:edp1":"2026-05-20"}},expectedRevision:first.revision});
 assert.equal(changed.incomeDates["edp:edp1"],"2026-05-20");
 assert.equal(changed.milestones.find(m=>m.id==="edp1").cashDate,first.milestones.find(m=>m.id==="edp1").cashDate);
 assert.ok(changed.history.some(h=>h.changes.some(c=>c.includes("Fecha de proyección"))));
 assert.throws(()=>validateProject({...project(),incomeDates:{"edp:edp1":"2026-02-30"}}),/Fecha/);
});

test("presented EDP detail corrections preserve its original condition and save", async t => {
 const { service } = await setup(t);
 const edp={stageKey:"fabricacion",metric:"m2",threshold:1,documentOnly:true,status:"Presentado",presentedDate:"2026-02-01",triggeredDate:null,approvedDate:null,approvalEvidence:""};
 const saved=await service.save({expectedRevision:0,project:project({nature:"llave_en_mano",includedWorks:["interior"],areaM2:500,milestones:[milestone({source:"https://example.com/edp",edp})]})});
 const changed=await service.save({expectedRevision:saved.revision,project:{...saved,milestones:saved.milestones.map(m=>m.id==="edp1"?{...m,scope:"Urbanización Interior",detailKeys:["interior","montaje"]}:m)}});
 const result=changed.milestones.find(m=>m.id==="edp1");
 assert.deepEqual(result.detailKeys,["interior","montaje"]);
 assert.deepEqual(result.edp,saved.milestones.find(m=>m.id==="edp1").edp);
});
