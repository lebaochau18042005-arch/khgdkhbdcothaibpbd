const fs = require('fs');
let content = fs.readFileSync('src/services/geminiService.ts', 'utf8');

content = content.replace(
    /const systemCurriculum = options\?\.curriculumDbData \? \`DỮ LIỆU BÀI HỌC VÀ MÃ CHỈ BÁO AI TỪ HỆ THỐNG:/,
    'const overrideCurriculumDbData = (subject.toLowerCase().includes("địa") && grade === "10") ? undefined : options?.curriculumDbData;\n    const systemCurriculum = overrideCurriculumDbData ? `DỮ LIỆU BÀI HỌC VÀ MÃ CHỈ BÁO AI TỪ HỆ THỐNG:'
);

content = content.replace(
    /\$\{JSON\.stringify\(options\.curriculumDbData\.map/g,
    '${JSON.stringify(overrideCurriculumDbData.map'
);

fs.writeFileSync('src/services/geminiService.ts', content, 'utf8');
