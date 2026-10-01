import test from "node:test";
import assert from "node:assert/strict";
import { historicalUf } from "../src/modules/projects/infrastructure/historical-uf.js";
test("historical UF keeps exact daily rates and rejects invalid requests", async () => {
 const rates = await historicalUf("2020", async url => {
  assert.equal(url, "https://mindicador.cl/api/uf/2020");
  return { ok:true, json:async()=>({codigo:"uf",serie:[{fecha:"2020-01-01T03:00:00.000Z",valor:28309.94}]}) };
 });
 assert.equal(rates["2020-01-01"],28309.94);
 assert.equal(rates["2020-01-02"],undefined);
 await assert.rejects(historicalUf("bad"), /inválido/);
});
