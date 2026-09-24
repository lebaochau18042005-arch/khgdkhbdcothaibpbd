import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const context = { exports: {}, Error };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/services/geminiErrors.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, context);
const errors = context.exports;
for (const [status, kind, fallback] of [
  [400, 'INVALID_ARGUMENT', false], [401, 'API_KEY_INVALID', false],
  [403, 'PERMISSION_DENIED', false], [404, 'MODEL_NOT_FOUND', true],
  [429, 'QUOTA_EXHAUSTED', false], [500, 'MODEL_OVERLOADED', true],
  [503, 'MODEL_OVERLOADED', true], [504, 'MODEL_OVERLOADED', true],
]) {
  const error = errors.geminiHttpError(status, '{}');
  assert.equal(errors.classifyGeminiError(error), kind);
  assert.equal(errors.canFallbackGemini(error), fallback);
}
assert.equal(errors.classifyGeminiError({status:403,message:'temporarily unavailable'}), 'PERMISSION_DENIED');
assert.equal(errors.classifyGeminiError({status:400,message:'API_KEY_INVALID'}), 'API_KEY_INVALID');
assert.equal(errors.canFallbackGemini(new SyntaxError('Invalid JSON')), false);
assert.equal(errors.canFallbackGemini({name:'AbortError'}), true);
assert.equal(errors.canFallbackGemini({message:'This model is no longer available'}), true);

const source = fs.readFileSync('src/services/geminiService.ts', 'utf8');
const file = ts.createSourceFile('service.ts', source, ts.ScriptTarget.Latest, true);
const adapter = file.statements.find(n => ts.isVariableStatement(n) &&
  n.declarationList.declarations.some(d => d.name.getText(file) === 'getModel'));
assert.ok(adapter);
const attempts = [];
let failure = 404;
const sandbox = {
  ...errors, exports: {}, Error,
  normalizeGeminiModel: m => m, getSavedGeminiModel: () => 'primary',
  getFallbackModels: () => ['primary', 'fallback'],
  GoogleGenAI: class { models = { generateContent: async p => {
    attempts.push(p.model);
    if (p.model === 'primary') throw {status:failure};
    return {text:'ok'};
  }}; },
};
vm.runInNewContext(ts.transpileModule(adapter.getText(file) + '\nexports.getModel = getModel;', {
  compilerOptions: {module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText.replaceAll('\\n', '\n'), sandbox);
await sandbox.exports.getModel('test').generateContent({});
assert.deepEqual(attempts, ['primary','fallback']);
attempts.length = 0;
failure = 429;
await assert.rejects(sandbox.exports.getModel('test').generateContent({}), /QUOTA_EXHAUSTED/);
assert.deepEqual(attempts, ['primary']);
console.log('PASS: HTTP classification, fallback eligibility, SDK retirement recovery and quota stop.');
