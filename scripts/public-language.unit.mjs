import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function load(path){const output=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const exports={};new Function('exports','require',output)(exports,require);return exports;}
const l=load('../src/lib/public-language.ts'), model=load('../src/lib/b2b/model.ts'), e=load('../src/lib/b2b/errors.ts');
assert.equal(model.products.length,25);
for(const [name,flavor] of model.products){assert.notEqual(l.translatedFlavor(flavor,'ru'),flavor,name);assert.equal(l.translatedFlavor(flavor,'ro'),flavor);assert(l.matchesProduct({name,flavor},l.translatedFlavor(flavor,'ru').toUpperCase()));assert(l.matchesProduct({name,flavor},l.normalizeSearch(flavor)));assert(l.matchesProduct({name,flavor},name.toLowerCase()));}
assert.equal(l.translatedFlavor('Unknown','ru'),'Unknown');assert.equal(l.translatedFlavor('ciocolata','ru'),'Шоколад');
assert.equal(l.publicLanguage(undefined),'ro');assert.equal(l.publicLanguage('invalid'),'ro');assert.equal(l.publicLanguage('ru'),'ru');
assert.equal(l.publicText('ru','Comanda #12 a fost plasată.'),'Заказ №12 оформлен.');assert.equal(l.publicText('ru','Modifică comanda #12'),'Изменить заказ №12');
assert.equal(l.publicText('ro','În stoc'),'În stoc');
assert.equal(e.b2bErrorCode('Produs indisponibil.',400),'unavailable');assert.equal(e.b2bErrorCode('Other',401),'expired');
const marker=e.requestError(new e.B2BRequestError('Original error','conflict'),'fallback');assert(e.translatedError(marker,'ru').includes('изменены'));assert(!e.translatedError(marker,'ro').includes('@b2b:'));
console.log('25 flavors, bilingual search, defaults, dynamic messages and stable error codes passed.');
