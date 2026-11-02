import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const module = {};
const source = readFileSync(new URL('../src/lib/feedback-preview.ts', import.meta.url), 'utf8');
new Function('exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(module);
const { feedbackPreview } = module;
for (const limit of [100, 200]) {
  assert.equal(feedbackPreview('Scurt: șț Привет 😀', limit), 'Scurt: șț Привет 😀');
  assert.equal(feedbackPreview('a'.repeat(limit), limit), 'a'.repeat(limit));
  assert.equal(feedbackPreview('a'.repeat(limit + 1), limit), 'a'.repeat(limit) + '...');
  assert.equal(feedbackPreview('😀'.repeat(limit + 1), limit), '😀'.repeat(limit) + '...');
  assert.equal(feedbackPreview('\r\n  Primul paragraf  \r\n\r\nAl doilea', limit), 'Primul paragraf...');
  assert.equal(feedbackPreview('Primul\nAl doilea', limit), 'Primul...');
  assert.equal(feedbackPreview('Primul\rAl doilea', limit), 'Primul...');
  assert.equal(feedbackPreview('Primul\u2029Al doilea', limit), 'Primul...');
  assert.equal(feedbackPreview('  Primul  \n \n', limit), 'Primul');
  assert.equal(feedbackPreview(' \n ', limit), '');
}
console.log('PASS feedback previews: 100/200 boundaries, paragraphs, CRLF, Romanian, Russian and emoji.');
