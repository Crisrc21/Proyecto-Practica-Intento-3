import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const source=await readFile(new URL("../src/modules/projects/data/edp-detail-labels.ts",import.meta.url),"utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {edpDetailLabels}=await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
test("invoice details reflect every selected EDP item and support existing records",()=>{
 assert.deepEqual(edpDetailLabels({detailKeys:["fabricacion","interior","montaje"],edp:{stageKey:"fabricacion"}}),["Vivienda","Vivienda - Urbanización Interior","Vivienda - TGM"]);
 assert.deepEqual(edpDetailLabels({edp:{stageKey:"exterior"}}),["Urbanización Exterior"]);
 assert.deepEqual(edpDetailLabels({scope:"Fundaciones"}),["Fundaciones"]);
 assert.deepEqual(edpDetailLabels(undefined),[]);
});

