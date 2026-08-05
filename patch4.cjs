const fs = require('fs');
let content = fs.readFileSync('src/services/geminiService.ts', 'utf8');

const funcIdx = content.indexOf('export const generateDepartmentPlan');
const insertIdx = content.indexOf('    const overrideCurriculumDbData', funcIdx);

console.log('Insert position:', insertIdx);

const batchCode = `  // ===== BATCH PROCESSING FOR DIA LI 10 (prevents output token truncation) =====
  const isGeo10Batch = subject.toLowerCase().includes("dia") && grade === "10" && !options?.customCurriculumData && Array.isArray(GEO_10_KNTT) && GEO_10_KNTT.length > 0;
  if (isGeo10Batch) {
    const GEO_BATCH_SIZE = 22;
    const allBatchResults: any[] = [];
    let weekCounter = 1;
    const geoRulesForBatch = GEOGRAPHY_AI_RULES;

    for (let bIdx = 0; bIdx < (GEO_10_KNTT as any[]).length; bIdx += GEO_BATCH_SIZE) {
      const batch = (GEO_10_KNTT as any[]).slice(bIdx, bIdx + GEO_BATCH_SIZE);
      const batchNum = Math.floor(bIdx / GEO_BATCH_SIZE) + 1;
      const totalBatches = Math.ceil((GEO_10_KNTT as any[]).length / GEO_BATCH_SIZE);

      const bLines = [
        CONTENT_INTEGRITY_RULES,
        "",
        "Ban la Chuyen gia xay dung Ke hoach giao duc To chuyen mon tich hop AI cho mon: Dia li, lop: 10.",
        'TUYET DOI: Dung bo sach "Ket noi tri thuc voi cuoc song". KHONG dung sach Canh Dieu hay Chan Troi Sang Tao.',
        "",
        AI_SUBJECT_GUIDELINES,
        SOCIAL_INTEGRATION_GUIDELINES,
        geoRulesForBatch,
        "",
        "DANH SACH " + batch.length + " BAI HOC CAN TAO (Lo " + batchNum + "/" + totalBatches + ", bat dau Tuan " + weekCounter + "):",
        JSON.stringify(batch, null, 2),
        "",
        "YEU CAU TUYET DOI BAT BUOC:",
        "1. TAO DUNG DU " + batch.length + " HANG cho " + batch.length + " bai tren. KHONG DUOC BO SOT BAI NAO.",
        "2. lessonGoal: SAO CHEP Y NGUYEN 100% noi dung yccd tu du lieu tren. TUYET DOI KHONG tom tat hay cat xen.",
        "3. TICH HOP NLS va NL AI cho 100% so bai (ke ca kiem tra, on tap, chuyen de).",
        "4. digitalCompetencyTT02: 2-3 ma NLS KHAC NHAU kem mo ta (VD: 1.1NC1a: Su dung GPS...; 2.2NC1b: Khai thac ban do so...)",
        "5. aiCompetency3439Integrated: 2-3 ma NL AI KHAC NHAU theo chuan QD 3439 kem YCCD cu the.",
        "   Quy uoc ma: [10].[Mach(A/B/C/D)+So chu de].[STT] - VD: 10.A1.1, 10.A2.3, 10.B1.2, 10.C2.1, 10.D3.2",
        "   - Mach A: Tu duy lay con nguoi lam trung tam | Mach B: Dao duc & trach nhiem | Mach C: Ky thuat & ung dung | Mach D: Giai quyet van de",
        "   PHAI DA DANG: moi bai dung ma va chu de KHAC NHAU. KHONG lap lai cung ma.",
        "6. Phan bo thoi gian bat dau tu Tuan " + weekCounter + ".",
        "",
        "Dau ra: JSON Array gom dung " + batch.length + " object voi cac truong: time, lessonContent, periods, lessonGoal, digitalCompetencyTT02, aiCompetency3439Integrated"
      ];
      const batchPrompt = bLines.join("\\n");

      const batchBody = {
        contents: [{ role: 'user', parts: [{ text: batchPrompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          maxOutputTokens: 65536,
          temperature: 0.1,
          responseSchema: {
            type: 'ARRAY' as any,
            items: {
              type: 'OBJECT' as any,
              properties: {
                time: { type: 'STRING' as any },
                lessonContent: { type: 'STRING' as any },
                periods: { type: 'STRING' as any },
                lessonGoal: { type: 'STRING' as any },
                digitalCompetencyTT02: { type: 'STRING' as any },
                aiCompetency3439Integrated: { type: 'STRING' as any }
              },
              required: ['time', 'lessonContent', 'periods', 'lessonGoal', 'digitalCompetencyTT02', 'aiCompetency3439Integrated'],
            },
          },
        },
      };

      const bApiKey = localStorage.getItem('GEMINI_API_KEY');
      if (!bApiKey) throw new Error('API_KEY_REQUIRED');
      const bStartModel = localStorage.getItem('GEMINI_MODEL') || 'gemini-3.5-flash';
      const bModels = getFallbackModels(bStartModel);
      let batchResult: any[] | null = null;

      for (let mi = 0; mi < bModels.length; mi++) {
        try {
          const url = \`https://generativelanguage.googleapis.com/v1beta/models/\${bModels[mi]}:generateContent?key=\${bApiKey}\`;
          const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(batchBody) });
          if (!res.ok) {
            const errText = await res.text();
            if (res.status === 429) throw new Error('QUOTA_EXHAUSTED');
            if (res.status === 401 || res.status === 403) throw new Error('API_KEY_INVALID');
            throw new Error(\`HTTP \${res.status}: \${errText}\`);
          }
          const bjson = await res.json();
          const btext = bjson?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!btext) throw new Error('Empty batch response');
          let bparsed: any = null;
          let bstripped = stripMarkdownJson(btext);
          try { bparsed = JSON.parse(bstripped); } catch {
            try {
              const ob = (bstripped.match(/\{/g)||[]).length, cb = (bstripped.match(/\}/g)||[]).length;
              const oa = (bstripped.match(/\[/g)||[]).length, ca = (bstripped.match(/\]/g)||[]).length;
              for (let x=0; x<ob-cb; x++) bstripped+='}';
              for (let x=0; x<oa-ca; x++) bstripped+=']';
              bparsed = JSON.parse(bstripped);
            } catch { /* ignore */ }
          }
          if (Array.isArray(bparsed) && bparsed.length > 0) {
            batchResult = bparsed;
            weekCounter += Math.max(1, Math.ceil(bparsed.reduce((s: number, it: any) => s + (parseInt(it.periods||'2')||2), 0) / 5));
            break;
          }
        } catch (bErr: any) {
          if (bErr.message?.startsWith('API_KEY_INVALID') || bErr.message?.includes('QUOTA_EXHAUSTED')) throw bErr;
          if (mi === bModels.length - 1) throw bErr;
          await new Promise(r => setTimeout(r, 2000));
        }
      }
      if (batchResult) allBatchResults.push(...batchResult);
    }
    if (allBatchResults.length > 0) return allBatchResults;
  }
  // ===== END BATCH PROCESSING FOR DIA LI 10 =====

`;

content = content.slice(0, insertIdx) + batchCode + content.slice(insertIdx);
fs.writeFileSync('src/services/geminiService.ts', content, 'utf8');
console.log('Done! File length:', content.length);
const verifyIdx = content.indexOf('BATCH PROCESSING FOR DIA LI 10');
console.log('Batch code verified at char:', verifyIdx);
