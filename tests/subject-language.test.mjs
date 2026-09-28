import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/data/competencyTranslations.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, context);
const { checkIsEnglishSubject: detect } = context.exports;
assert.equal(detect('Ngữ văn', 'Reading comprehension', 'English Bright Unit 1 Getting started', 'english.docx'), false);
assert.equal(detect('Địa lí', '', 'English sources'), false);
assert.equal(detect('', '', 'Môn: Ngữ văn\nEnglish reading comprehension'), false);
assert.equal(detect('', '', 'Ngữ văn\nUnit 1 Getting started'), false);
assert.equal(detect('', '', 'Bright ideas for reading comprehension'), false);
assert.equal(detect('', '', '', 'Ngu_Van_12.docx'), false);
assert.equal(detect('Tiếng Anh'), true);
assert.equal(detect('English'), true);
assert.equal(detect('', '', 'Subject: English\nUnit 1'), true);
assert.equal(detect('', '', 'Unit 1: Getting started'), true);
assert.equal(detect('', '', '', 'Tieng_Anh_12.docx'), true);
assert.equal(detect(), false);
assert.equal(detect('Ngữ văn (tham khảo English)'), false);
assert.equal(detect('', '', 'Môn: Ngữ văn - tư liệu English'), false);
assert.equal(detect('', '', 'Lớp: 12\tMôn: Ngữ văn\nUnit 1 Getting started', 'English.docx'), false);
assert.equal(detect('', '', '| Môn học | Địa lí |\nUnit 1 Getting started', 'English.docx'), false);
assert.equal(detect('', '', 'Môn\tNgữ văn\nUnit 1 Getting started'), false);
assert.equal(detect('', '', 'Môn: Tiếng Anh\rLớp: 12'), true);
assert.equal(detect('Môn học: Tiếng Anh'), true);
assert.equal(detect('TIẾNG ANH'.normalize('NFD')), true);
assert.equal(detect(null, null, null, null), false);
console.log('Subject language regression checks passed.');
