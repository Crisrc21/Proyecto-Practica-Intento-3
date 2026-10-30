import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const source = await readFile(new URL("../src/modules/projects/data/edp-slots.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { edpSlots, edpListStatus, latestRegisteredEdp } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
const first = { id: "first", type: "EDP", name: "EDP 1 · avance presentado", edpCount: 13, source: "https://example.com/edp1", edp: { status: "Presentado", presentedDate: "2026-01-10" } };
test("existing declaration immediately exposes thirteen slots without invented money or dates", () => {
  const project = { id: "p", milestones: [first] };
  const slots = edpSlots(project);
  assert.equal(slots.length, 13);
  assert.equal(slots[12].name, "EDP 13");
  assert.equal(edpListStatus(slots[0]), "Presentado");
  for (const m of slots.slice(1)) {
    assert.equal(edpListStatus(m), "En proceso");
    assert.equal(m.cashAmount, null);
    assert.equal(m.cashDate, null);
    assert.equal(m.source, "");
  }
  assert.equal(project.milestones.length, 1);
});
test("twelve advance EDP retain all slots when advance and retention records are added", () => {
  const project = { id: "p", milestones: [{ ...first, edpCount: 12 }] };
  const before = edpSlots(project);
  const advance = { id: "a", type: "Anticipo", name: "Z anticipo" };
  const retention = { id: "r", type: "Retenciones", name: "EDP 12 retenciones" };
  const after = edpSlots({ ...project, milestones: [...project.milestones, advance, retention] });
  assert.equal(after.length, 14);
  assert.equal(after[0].id, "a");
  assert.equal(after.at(-1).id, "r");
  assert.deepEqual(after.filter(m => m.type === "EDP").map(m => m.id), before.map(m => m.id));
  assert.equal(after[12].name, "EDP 12");
});

test("completing a slot retains its identity and does not duplicate following EDP", () => {
  const project = { id: "p", milestones: [first] };
  const before = edpSlots(project);
  const completed = { ...before[4], source: "https://example.com/edp5", cashAmount: 100, edp: { ...before[4].edp, presentedDate: "2026-01-10" }, settlement: { gross: 100 } };
  const after = edpSlots({ ...project, milestones: [first, completed] });
  assert.equal(after.length, 13);
  assert.deepEqual(after.map(m => m.id), before.map(m => m.id));
  assert.equal(edpListStatus(after[4]), "Presentado");
  assert.equal(edpListStatus({ ...completed, source: "" }), "Presentado");
});

test("presentation depends on its date and cutoff, never on the document link", () => {
  for (const status of ["Previsto", "Preparado", "Presentado", "Aprobado"]) {
    assert.equal(edpListStatus({ ...first, source: "", edp: { status } }), "En proceso");
    assert.equal(edpListStatus({ ...first, source: "Contrato", edp: { status } }), "En proceso");
    assert.equal(edpListStatus({ ...first, source: "https://example.com/document", cashAmount: null, edp: { status } }), "En proceso");
    for (const source of ["", "Documento entregado", "https://example.com/document"]) {
      const m = { ...first, source, edp: { status, presentedDate: "2026-01-10" } };
      assert.equal(edpListStatus(m, "2026-01-09"), "En proceso");
      assert.equal(edpListStatus(m, "2026-01-10"), "Presentado");
      assert.equal(edpListStatus(m, "2026-02-01"), "Presentado");
    }
  }
});

test("current EDP uses highest registered number, not first among equal dates or empty slots", () => {
 const m = n => ({...first,id:`e${n}`,name:`EDP ${n}`,edp:{presentedDate:"2026-06-30"}});
 assert.equal(latestRegisteredEdp({milestones:[m(1),m(13),m(2)]},"2026-09-30").id,"e13");
 assert.equal(latestRegisteredEdp({milestones:[m(1),{...m(13),edp:{presentedDate:null}}]},"2026-09-30").id,"e13");
 assert.equal(latestRegisteredEdp({milestones:[m(1),{...m(13),edp:{presentedDate:"2027-01-01"}}]},"2026-09-30").id,"e1");
 assert.equal(latestRegisteredEdp({milestones:[]},"2026-09-30"),undefined);
});
