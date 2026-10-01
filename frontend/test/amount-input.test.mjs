import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const source = await readFile(new URL("../src/modules/projects/data/amount-input.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { parseAmountInput } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
test("Chilean monetary input accepts thousands and rounds decimal amounts", () => {
  for (const [input, value] of [["1.234,56", 1235], ["1.234,49", 1234], ["260.000", 260000], ["1234,5", 1235], ["0", 0], ["1.234.567,89", 1234568]]) assert.equal(parseAmountInput(input), value);
  assert.equal(parseAmountInput("-1.234,50", true), -1235);
  for (const input of ["", "-1", "1.23", "1,234.56", "abc", "1,,2"]) assert.equal(parseAmountInput(input), null);
});
