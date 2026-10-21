import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import ts from "typescript";
const require=createRequire(import.meta.url);
function load(path) {
 const result={};
 new Function("exports","require",ts.transpileModule(readFileSync(path,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(result,require);
 return result;
}
const model=load("src/lib/b2b/model.ts"), errors=load("src/lib/b2b/errors.ts");
for(const [stock,status] of [[0,"unavailable"],[1,"limited"],[49,"limited"],[50,"limited"],[51,"available"],[100,"available"]]) assert.equal(model.stockStatus({stock}),status);
assert.equal(model.stockLimit({stock:0}),0);
assert.equal(model.stockLimit({stock:3},7),10);
assert.equal(model.stockLimit({stock:100000}),10000);
assert.equal(errors.isStockError({cause:{cause:Error("B2B_STOCK_INSUFFICIENT")}}),true);
assert.equal(errors.isStockError(Error("other")),false);
assert.equal(errors.b2bErrorCode("Stoc insuficient pentru cantitatea solicitată.",409),"stock");
assert.match(errors.translatedError("@b2b:stock","ru"),/Недостаточно/);
console.log("PASS: inventory thresholds, reserved edit quantities, limits, nested transaction errors and RU errors.");
