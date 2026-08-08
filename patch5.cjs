const fs = require('fs');
let content = fs.readFileSync('src/services/geminiService.ts', 'utf8');

// Fix 1: The batch trigger condition - "dia" won't match "địa"
// Replace the ASCII check with a proper Unicode check
const oldCondition = 'const isGeo10Batch = subject.toLowerCase().includes("dia") && grade === "10"';

// Use a regex approach that handles both "địa lý" and "địa lí" etc.
const newCondition = 'const isGeo10Batch = /\u0111\u1ecba/i.test(subject) && grade === "10"';

if (content.includes(oldCondition)) {
    content = content.replace(oldCondition, newCondition);
    console.log('Fixed isGeo10Batch condition!');
} else {
    console.log('Condition not found, searching...');
    const idx = content.indexOf('isGeo10Batch');
    console.log('isGeo10Batch at:', idx);
    if (idx > -1) console.log(content.substring(idx, idx+200));
}

// Fix 2: Also fix the second check inside the batch:
// subject.toLowerCase().includes("dia") inside the first check is OK since it's the same var
// But the overrideCurriculumDbData check also uses "địa" (unicode) - that one was already correct

// Fix 3: Check if there's another location where geo10 is enabled
const geoCheckOld = 'subject.toLowerCase().includes("dia") && grade === "10"';
const geoCheckCount = (content.match(/subject\.toLowerCase\(\)\.includes\("dia"\)/g)||[]).length;
console.log('Remaining "dia" checks:', geoCheckCount);

// Replace all remaining "dia" with proper regex check
content = content.replaceAll('subject.toLowerCase().includes("dia")', '/\u0111\u1ecba/i.test(subject)');

console.log('All fixes applied. Writing...');
fs.writeFileSync('src/services/geminiService.ts', content, 'utf8');
console.log('Done! File size:', content.length);

// Verify
const verify = content.indexOf('/\u0111\u1ecba/i.test(subject)');
console.log('Verification - first match at:', verify);
