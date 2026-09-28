import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Capture the actual request builder without calling the paid AI service.
const source = fs.readFileSync('src/services/geminiService.ts', 'utf8');
const file = ts.createSourceFile('service.ts', source, ts.ScriptTarget.Latest, true);
const declaration = file.statements.find(node => ts.isVariableStatement(node) &&
  node.declarationList.declarations.some(item => item.name.getText(file) === 'analyzeExistingPlan'));
assert.ok(declaration);
let captured;
const sandbox = {
  exports: {}, console,
  detectGradeFromText: () => '12',
  getCompetencyGuardrails: () => '',
  buildGradeSpecificCompetencyPrompt: () => '',
  AI_COMPETENCY_ORDER_RULE: '',
  Type: { OBJECT: 'OBJECT', ARRAY: 'ARRAY', STRING: 'STRING' },
  callGeminiWithFallback: async prompt => { captured = prompt; return { subject: 'Ngữ văn' }; },
  sanitizeAnalysisResultCompetencies: value => value,
};
vm.runInNewContext(ts.transpileModule(declaration.getText(file), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, sandbox);

for (const pdf of [undefined, 'test-pdf']) {
  const result = await sandbox.exports.analyzeExistingPlan(
    pdf ? '' : 'Môn: Ngữ văn\nTài liệu tham khảo English', pdf, undefined, undefined, '12', 'English.docx');
  const promptText = typeof captured === 'string' ? captured : captured.map(part =>
    typeof part === 'string' ? part : part.text || '').join('\n');
  assert.equal(result.subject, 'Ngữ văn');
  assert.ok(promptText.includes('Với Ngữ văn và các môn khác:'));
  assert.ok(promptText.includes('Nếu môn học được xác định là Tiếng Anh:'));
  assert.ok(promptText.includes('không dịch các điểm neo này'));
  assert.ok(!promptText.includes('Giáo án này là môn TIẾNG ANH'));
}
console.log('Analysis language checks passed for text and PDF requests.');
