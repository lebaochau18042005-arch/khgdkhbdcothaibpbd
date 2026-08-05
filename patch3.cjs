const fs = require('fs');
let content = fs.readFileSync('src/services/geminiService.ts', 'utf8');

// Add the batch processing function after the existing generateDepartmentPlan function
// First, let's find the end of generateDepartmentPlan and insert the new batch logic

// The key change: replace the single call with batched calls
// Find the place where defaultCurriculum is assembled and the curriculumConstraint is built
// We need to add batch processing logic INSIDE the function

// Strategy: Convert the list into batches of 30, call AI for each batch, merge results
// Find the prompt body section and wrap it in batch processing

const newBatchLogic = `
  // BATCH PROCESSING: Split curriculum data into chunks to avoid output truncation
  const curriculumList = Array.isArray(GEO_10_KNTT) && subject.toLowerCase().includes("địa") && grade === "10" 
    ? GEO_10_KNTT 
    : null;
  
  if (curriculumList && !options?.customCurriculumData) {
    // Process in batches of 25 items
    const BATCH_SIZE = 25;
    const batches: any[][] = [];
    for (let bIdx = 0; bIdx < curriculumList.length; bIdx += BATCH_SIZE) {
      batches.push(curriculumList.slice(bIdx, bIdx + BATCH_SIZE));
    }
    
    const allResults: any[] = [];
    let weekCounter = 1;
    
    for (let bIdx = 0; bIdx < batches.length; bIdx++) {
      const batch = batches[bIdx];
      const batchPrompt = \`
    \${CONTENT_INTEGRITY_RULES}
    
    Bạn là Chuyên gia xây dựng chương trình giáo dục. Hãy tạo Kế hoạch Tổ chuyên môn tích hợp AI cho môn: \${subject}, lớp: \${grade}.
    
    YÊU CẦU QUAN TRỌNG: TUYỆT ĐỐI BẮT BUỘC tuân thủ bộ sách "Kết nối tri thức với cuộc sống". KHÔNG dùng sách khác.
    
    \${AI_SUBJECT_GUIDELINES}
    \${SOCIAL_INTEGRATION_GUIDELINES}
    \${geographyRules}
    \${englishConstraint}
    
    DANH SÁCH BÀI HỌC CẦN TẠO KẾ HOẠCH (Đây là lô \${bIdx + 1}/\${batches.length}, bắt đầu từ Tuần \${weekCounter}):
    \${JSON.stringify(batch, null, 2)}
    
    YÊU CẦU TẠO KẾ HOẠCH CHO TỪNG BÀI TRONG DANH SÁCH TRÊN:
    1. KHÔNG ĐƯỢC BỎ SÓT BẤT KỲ BÀI NÀO trong danh sách - phải tạo đủ \${batch.length} hàng.
    2. Với mỗi bài, sao chép Y NGUYÊN nội dung "yccd" từ dữ liệu trên vào lessonGoal. KHÔNG được tóm tắt hay cắt xén.
    3. BẮT BUỘC tích hợp NLS và NL AI cho ÍT NHẤT 95% số bài (kể cả bài ôn tập và kiểm tra).
    4. Mỗi bài đề xuất 2-3 mã NLS và 2-3 mã NL AI KHÁC NHAU (đa dạng chủ đề A1,A2,B1,B2,C1,C2...).
    5. Mã NL AI theo quy ước: [Khối].[Mạch NL + Chủ đề].[STT] (VD: 10.A1.1, 10.B2.3).
    6. Phân bổ thời gian tuần học hợp lý, bắt đầu từ Tuần \${weekCounter}.
    
    Định dạng đầu ra: JSON Array với CÁC TRƯỜNG SAU cho TỪNG BÀI:
    - time: Thời gian (VD: "Học kì I, Tuần \${weekCounter}")
    - lessonContent: Tên bài học/chuyên đề/kiểm tra (lấy từ trường "lesson" trong dữ liệu)
    - periods: Số tiết (ước lượng hợp lý: bài lý thuyết 1-2 tiết, bài thực hành 1-2 tiết, kiểm tra 1 tiết)
    - lessonGoal: SAO CHÉP Y NGUYÊN từ trường "yccd" trong dữ liệu trên
    - digitalCompetencyTT02: 2-3 mã NLS + mô tả YCCĐ (BẮT BUỘC cho ít nhất 95% bài)
    - aiCompetency3439Integrated: 2-3 mã NL AI + YCCĐ AI chi tiết (BẮT BUỘC cho ít nhất 95% bài)
    \`;
      
      const batchBody = {
        contents: [{ role: 'user', parts: [{ text: batchPrompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          maxOutputTokens: 65536,
          temperature: 0,
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
      
      const apiKey = localStorage.getItem('GEMINI_API_KEY');
      if (!apiKey) throw new Error('API_KEY_REQUIRED');
      const startModel = localStorage.getItem('GEMINI_MODEL') || 'gemini-3.5-flash';
      const batchModels = getFallbackModels(startModel);
      
      let batchResult: any[] | null = null;
      for (let mi = 0; mi < batchModels.length; mi++) {
        try {
          const url = \`https://generativelanguage.googleapis.com/v1beta/models/\${batchModels[mi]}:generateContent?key=\${apiKey}\`;
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(batchBody),
          });
          if (!res.ok) {
            const errText = await res.text();
            if (res.status === 429) throw new Error('QUOTA_EXHAUSTED');
            if (res.status === 401 || res.status === 403) throw new Error('API_KEY_INVALID');
            throw new Error(\`HTTP \${res.status}: \${errText}\`);
          }
          const json = await res.json();
          const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!text) throw new Error('Batch AI returned empty');
          let parsed: any = null;
          let stripped = stripMarkdownJson(text);
          try { parsed = JSON.parse(stripped); } catch { 
            try {
              const openBraces = (stripped.match(/\\{/g)||[]).length;
              const closeBraces = (stripped.match(/\\}/g)||[]).length;
              const openBrackets = (stripped.match(/\\[/g)||[]).length;
              const closeBrackets = (stripped.match(/\\]/g)||[]).length;
              for (let i2=0;i2<openBraces-closeBraces;i2++) stripped+='}';
              for (let i2=0;i2<openBrackets-closeBrackets;i2++) stripped+=']';
              parsed = JSON.parse(stripped);
            } catch { /* ignore */ }
          }
          if (Array.isArray(parsed) && parsed.length > 0) {
            batchResult = parsed;
            // Count periods for next batch week calculation
            let periodsCount = 0;
            parsed.forEach((item: any) => { periodsCount += parseInt(item.periods||'1')||1; });
            weekCounter += Math.ceil(periodsCount / 5);
            break;
          }
        } catch (err: any) {
          if (mi === batchModels.length - 1) throw err;
          await new Promise(r => setTimeout(r, 1500));
        }
      }
      
      if (batchResult) {
        allResults.push(...batchResult);
      }
    }
    
    if (allResults.length > 0) return allResults;
  }
  `;

// Find the position right after the prompt is defined and before the body is sent
// Insert before: "  const apiKey = localStorage.getItem('GEMINI_API_KEY');"
content = content.replace(
    "  const apiKey = localStorage.getItem('GEMINI_API_KEY');\n  if (!apiKey) throw new Error('API_KEY_REQUIRED');\n  const startModel = localStorage.getItem('GEMINI_MODEL') || 'gemini-3.5-flash';\n  const modelsToTry = getFallbackModels(startModel);\n\n  const parts = [{ text: prompt }];",
    newBatchLogic + "\n  const apiKey = localStorage.getItem('GEMINI_API_KEY');\n  if (!apiKey) throw new Error('API_KEY_REQUIRED');\n  const startModel = localStorage.getItem('GEMINI_MODEL') || 'gemini-3.5-flash';\n  const modelsToTry = getFallbackModels(startModel);\n\n  const parts = [{ text: prompt }];"
);

fs.writeFileSync('src/services/geminiService.ts', content, 'utf8');
console.log('Done patching. New length:', content.length);
