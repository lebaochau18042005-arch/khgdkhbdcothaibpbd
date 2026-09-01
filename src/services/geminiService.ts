import { GoogleGenAI, Type } from "@google/genai";
import { DiaLy } from '../data/curriculum/diaLy';
import { INDICATORS as KNOWN_NLS_INDICATORS } from '../components/NlsLookup';
import { isNlsCodeValid, getNlsIndicatorByCode } from '../data/nlsIndicatorsDb';
import { buildSocialIntegrationSelectionPrompt } from '../data/socialIntegrations';
import { formatAiCode2422, getAiRequirementByCode, normalizeAiCode2422 } from '../data/aiRequirements2422Db';

// --- Google AI Key Validation (per google-api skill) ---
// Accepts both legacy AIzaSy... keys and new AQ... keys from Google AI Studio
export const GOOGLE_AI_API_KEY_PATTERN = /^(?:AIzaSy|AQ)\S{8,}$/;
export const isValidGoogleAiApiKey = (key: string): boolean =>
  GOOGLE_AI_API_KEY_PATTERN.test(key.trim());

/**
 * Returns a model adapter compatible with the @google/genai v1.x SDK.
 * Usage: const model = getModel(apiKey, modelName);
 *        const result = await model.generateContent({ contents, generationConfig });
 */
const getModel = (apiKey?: string, modelName?: string) => {
  const key = apiKey || localStorage.getItem('GEMINI_API_KEY') || '';
  const model = modelName || localStorage.getItem('GEMINI_MODEL') || 'gemini-3.5-flash';
  const ai = new GoogleGenAI({ apiKey: key });
  return {
    generateContent: (params: Parameters<typeof ai.models.generateContent>[0]) =>
      ai.models.generateContent({ ...params, model }),
  };
};

/**
 * Strips markdown code fences (```json ... ```) that some models
 * include around their JSON output, then returns the cleaned string.
 */
const stripMarkdownJson = (raw: string): string => {
  if (!raw) return raw;
  // Remove ```json or ``` prefix and ``` suffix
  return raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
};

const getFallbackModels = (startModel: string) => {
  // Fallback order: Gemini 3.5 (GA) → 3 preview → 3.1 lite
  const models = [
    'gemini-3.5-flash',
    'gemini-3-flash-preview',
    'gemini-3.1-flash-lite'
  ];
  const deduplicated = [startModel, ...models.filter(m => m !== startModel)];
  return deduplicated;
};

const callGeminiWithFallback = async (prompt: any, responseSchema: any) => {
  const apiKey = localStorage.getItem('GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error('API_KEY_REQUIRED');
  }
  const startModel = localStorage.getItem('GEMINI_MODEL') || 'gemini-3.5-flash';
  const modelsToTry = getFallbackModels(startModel);

  // Build parts array for the request
  let parts: any[];
  if (typeof prompt === 'string') {
    parts = [{ text: prompt }];
  } else if (Array.isArray(prompt)) {
    parts = prompt.map((p: any) => {
      if (typeof p === 'string') return { text: p };
      if (p.inlineData) return p; // PDF / image inline data — pass through as-is
      if (p.text) return p;       // already a part object
      return { text: String(p) };
    });
  } else {
    parts = [prompt];
  }

  for (let i = 0; i < modelsToTry.length; i++) {
    const currentModel = modelsToTry[i];
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`;
      const body: any = {
        contents: [{ role: 'user', parts }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: responseSchema,
          maxOutputTokens: 65536,
        },
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        if (res.status === 429 || errText.includes('RESOURCE_EXHAUSTED') || errText.toLowerCase().includes('quota')) {
          throw new Error('QUOTA_EXHAUSTED');
        }
        if (res.status === 503 || errText.includes('UNAVAILABLE') || errText.toLowerCase().includes('overloaded') || errText.toLowerCase().includes('high demand')) {
          throw new Error('MODEL_OVERLOADED');
        }
        if (res.status === 401 || res.status === 403) {
          throw new Error(`API_KEY_INVALID: ${errText}`);
        }
        if (res.status === 400 && (errText.includes('API_KEY') || errText.includes('API key'))) {
          throw new Error(`API_KEY_INVALID: ${errText}`);
        }
        // 400 from invalid model name → try next model
        throw new Error(`HTTP ${res.status}: ${errText}`);
      }

      const json = await res.json();
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('AI trả về phản hồi rỗng.');
      try {
        return JSON.parse(stripMarkdownJson(text));
      } catch (parseErr) {
        console.error('[JSON Parse Error] Raw text (first 500 chars):', text?.substring(0, 500));
        throw new Error(`Lỗi phân tích JSON từ AI (phản hồi có thể bị cắt ngắn). Vui lòng thử lại.`);
      }
    } catch (err: any) {
      console.error(`Lỗi với model ${currentModel}:`, err);

      const isQuotaExhausted = err.message && (err.message.includes('QUOTA_EXHAUSTED') || err.message.includes('429') || err.message.toLowerCase().includes('quota'));
      const isApiKeyInvalid = err.message && (err.message.startsWith('API_KEY_INVALID') || err.message.includes('401'));
      const isModelOverloaded = err.message && (err.message.includes('MODEL_OVERLOADED') || err.message.includes('503') || err.message.toLowerCase().includes('overloaded'));
      const isLastModel = i === modelsToTry.length - 1;

      // Auth failures: stop immediately — key rotation won't help
      if (isApiKeyInvalid) throw new Error('API_KEY_INVALID');
      // Quota exhausted: stop immediately at last model
      if (isLastModel) {
        if (isQuotaExhausted) throw new Error('QUOTA_EXHAUSTED');
        if (isModelOverloaded) throw new Error('MODEL_OVERLOADED');
        throw err;
      }
      // Model overloaded: try next model, don't wait as long
      await new Promise(r => setTimeout(r, isModelOverloaded ? 500 : 1000));
    }
  }
};

// ============================================================
// CONTENT INTEGRITY RULES (Nguyên tắc 3.1 và Mục 7)
// Chung cho tất cả các prompt sinh nội dung giáo dục
// ============================================================
const CONTENT_INTEGRITY_RULES = `
==== NGUYÊN TẮc NỘI DUNG BẮT BUỘC (KHÔNG ĐƯỢC VI PHẠM) ====

0. BẢO TOÀN FILE GIÁO ÁN TẢI LÊN:
- Khi giáo viên tải lên giáo án gốc, nội dung gốc là nền bắt buộc phải giữ nguyên. Không được rút gọn, viết lại, sắp xếp lại hoặc thay thế bằng bản do AI tái tạo.
- Nếu giáo án gốc có bảng số liệu, biểu đồ, hình vẽ, ảnh, sơ đồ, công thức Toán/Lí/Hóa/Sinh/Địa lí hoặc đối tượng nhúng, phải giữ đúng định dạng trong file gốc. Không được chuyển chúng thành đoạn mô tả văn bản thay thế.
- AI chỉ được tạo phần BỔ SUNG NLS/NL AI. Phần bổ sung phải được đánh dấu bằng chữ màu đỏ khi chèn vào DOCX; phần gốc giữ nguyên màu sắc, bố cục và định dạng.

3.1. NGHIÊM CẤM TỰ ĐOÁN NỘI DUNG - BẨT BUỘC TUÂN THỦ:
- TUYỆT ĐỐI KHÔNG tự bịa đặt hoặc khẳng định bất kỳ thông tin nào nếu chưa có dữ liệu nguồn rõ ràng từ file tải lên hoặc CURRICULUM_DB.
- Các thông tin NGHIÊM CẤM tự suy đoán bao gồm: Tên bài học, số lượng bài, thứ tự bài, số tiết, nội dung Yêu cầu cần đạt, số liệu địa lí, tên địa danh, nội dung biểu đồ/bản đồ/bảng số liệu, đáp án câu hỏi không có cơ sở, mã năng lực số, mã năng lực AI.
- Nếu thiếu dữ liệu nguồn cho bất kỳ mục nào, phải ghi rõ: "Chưa đủ nguồn chính thức. Vui lòng cung cấp chương trình môn học, SGK, SGV hoặc bảng yêu cầu cần đạt."
- KHÔNG dùng kiến thức suy đoán để thay thế nội dung SGK.

3.3. NGHIÊM CẤM SAO CHÉP TOÀN BỘ SGK:
- Chỉ được tạo bản tóm tắt học tập và trích dẫn ngắn có ghi nguồn.
- KHÔNG sao chép nguyên văn toàn bộ đoạn văn trong SGK.
`;

const AI_SUBJECT_GUIDELINES = `
Dưới đây là Khung mạch nội dung tích hợp AI cho từng môn học theo QĐ 2422/QĐ-BGDĐT (áp dụng từ năm học 2026-2027):
- Ngữ văn: Trọng tâm NLa, NLb, NLc. Nội dung: Lên dàn ý, tóm tắt tư liệu, phân tích thi pháp, dịch thuật, đặt prompt so sánh văn bản. Thảo luận: Sáng tác Người vs AI, bản quyền tác giả, phong cách cá nhân, trách nhiệm sử dụng.
- Toán học & KHTN (Vật lí, Hóa học, Sinh học): Trọng tâm NLa, NLb, NLc, NLd. Nội dung: Phân tích dữ liệu thực nghiệm, mô phỏng đồ thị/phản ứng, kiểm thử giả thuyết. Thảo luận: Hiện tượng ảo giác (hallucination) của AI, giới hạn công cụ.
- Lịch sử & Địa lí: Trọng tâm NLa, NLb, NLc. Nội dung: Phân tích số liệu dân cư/kinh tế, xử lý bản đồ số, tra cứu tư liệu lịch sử. Thảo luận: Kiểm chứng chéo nguồn tin, phát hiện thiên kiến thuật toán (bias), bảo tồn văn hóa di sản.
- Công nghệ & Tin học: Trọng tâm NLa, NLb, NLc, NLd. Nội dung: Thiết kế hệ thống tự động hóa, prompt engineering chuyên sâu, kiểm thử giải pháp. Thảo luận: Đạo đức công nghệ, an toàn thông tin, tác động thị trường lao động.
- Ngoại ngữ (Tiếng Anh): Trọng tâm NLb, NLc. Nội dung: Luyện phát âm, giao tiếp chatbot theo ngữ cảnh, dịch thuật và phân tích sắc thái ngữ nghĩa. Thảo luận: Đánh giá dịch máy, bản quyền ngôn ngữ.
- Hoạt động TN, Hướng nghiệp & GDĐP: Trọng tâm NLa, NLb. Nội dung: Định hướng nghề nghiệp trong kỷ nguyên số, kỹ năng làm chủ AI, phân tích dữ liệu kinh tế - xã hội địa phương.
`;

const GEOGRAPHY_AI_RULES = `
LỆNH ĐẶC BIỆT TỪ CHUYÊN GIA ĐỊA LÍ VÀ AI THEO QĐ 2422:
Nhiệm vụ của bạn là rà soát PPCT và bổ sung nội dung tích hợp NL AI bảo đảm YCCĐ AI phải phục vụ và hỗ trợ trực tiếp YCCĐ môn Địa lí.

I. NGUYÊN TẮC BẮT BUỘC
1. Giữ nguyên 100% nội dung gốc của PPCT.
2. Không bổ sung AI theo kiểu hình thức.
3. Không để AI thay thế hoạt động tư duy Địa lí (đọc bản đồ, Atlat, phân tích số liệu...).
4. Trình tự xử lí: YCCĐ Địa lí -> cơ hội tích hợp -> thành phần AI -> hành vi HS -> YCCĐ AI -> sản phẩm/tiêu chí/minh chứng -> mã hóa đúng lớp, chủ đề và số thứ tự theo QĐ 2422 (ví dụ: 10.A1.1, 10.C3.2, 11.C3.MR1, 12.C4.MR1).
5. Không sử dụng chatbot làm nguồn dữ liệu gốc (phải dùng SGK Kết nối tri thức, Atlat, cổng thông tin chính thống).
6. Không đưa thông tin cá nhân của học sinh vào AI.

II. CẤU TRÚC MÃ VÀ CHỦ ĐỀ ĐƯỢC PHÉP THEO QĐ 2422
Khi YCCĐ và hành vi học sinh có điểm chạm NL AI rõ ràng, bắt buộc gán mã chuẩn theo mẫu: [Lớp].[Chủ đề].[Số thứ tự], ví dụ: 10.A1.1, 10.C3.1, 11.C3.1, 12.C3.1; không dùng mã cũ có số 01 (như 10.A2.01).
- Lớp 10: A1, A2, A3; B2, B3; C2, C3, C4; D1, D2.
- Lớp 11: A1, A2; B2, B3; C3, C5; D1, D2.
- Lớp 12: A1, A2; B1, B2, B3; C3, C4; D1, D2.
Mỗi đơn vị bài học chỉ chọn 1-2 mã NL AI thật sự phù hợp.

III. YÊU CẦU TÁCH YCCĐ AI VÀ ĐẶC THÙ ĐỊA LÍ
- Công thức: Học sinh + động từ quan sát được + nội dung AI + bối cảnh Địa lí + sản phẩm/minh chứng + tiêu chí đánh giá.
- Động từ ưu tiên: Xác định, Mô tả, Giải thích, Phân tích, Đối chiếu, Kiểm chứng, Đánh giá, Thiết kế, Thu thập...

IV. ĐỊNH DẠNG CỘT AI (aiCompetencyIntegrated)
- Viết cô đọng trong một đoạn tối đa 90 từ theo thứ tự: thành phần (NLa/NLb/NLc/NLd) -> hành vi HS -> YCCĐ AI -> mã NL AI cụ thể -> sản phẩm -> kiểm chứng/tiêu chí.
- Nếu không có điểm chạm ghi “Không tích hợp NLS/NL AI trong hoạt động này.”
`;

const AI_COMPETENCY_ORDER_RULE = `
LỆNH MÃ HÓA NL AI & NLS BẮT BUỘC THEO QĐ 2422/QĐ-BGDĐT:
- BẮT BUỘC ÁNH XẠ ĐÚNG CHỦ ĐỀ VÀ THÀNH PHẦN NĂNG LỰC AI:
  * Chủ đề bắt đầu bằng chữ A (A1, A2, A3) -> NLa - Tư duy lấy con người làm trung tâm
  * Chủ đề bắt đầu bằng chữ B (B1, B2, B3) -> NLb - Đạo đức AI, an toàn, pháp luật và trách nhiệm
  * Chủ đề bắt đầu bằng chữ C (C1, C2, C3, C4, C5) -> NLc - Các kĩ thuật và ứng dụng AI
  * Chủ đề bắt đầu bằng chữ D (D1, D2) -> NLd - Thiết kế, thử nghiệm và cải tiến hệ thống AI
  TUYỆT ĐỐI KHÔNG ghi nhầm NLD cho chủ đề B hoặc NLc cho chủ đề A.
- NGUYÊN TẮC PHÂN BỔ ĐA DẠNG & CÂN ĐỐI 4 THÀNH PHẦN NL AI:
  * TUYỆT ĐỐI KHÔNG dồn toàn bộ bài học vào mạch NLc. Phải phân bổ hài hòa cả 4 thành phần (NLa, NLb, NLc, NLd) đúng bản chất bài học:
    + Bài thực hành / Báo cáo / Dự án / Tuyên truyền / Sản phẩm -> Ưu tiên NLd (Dự án/Thiết kế giải pháp, vd: 10.D1.1, 11.D1.1, 12.D1.1) hoặc NLb (An toàn thông tin, bảo vệ dữ liệu chủ quyền, liêm chính học thuật, vd: 12.B2.1, 11.B3.1, 10.B3.1).
    + Bài lý thuyết trọng tâm / Kiểm chứng / Phản biện / Đọc Atlat, SGK -> Ưu tiên NLa (Kiểm soát, giám sát AI, fact-check, tư duy độc lập, con người làm chủ, vd: 10.A3.1, 11.A1.1, 12.A1.1).
    + Bài phân tích số liệu / Bảng số liệu / Biểu đồ / Tra cứu thuật toán -> Ưu tiên NLc (Mô hình AI chuyên ngành, phân tích dữ liệu, prompt, vd: 10.C3.1, 11.C5.1, 12.C3.1).
    + Bài về đạo đức / Pháp luật / Môi trường / An ninh mạng / Tin giả -> Ưu tiên NLb (Đạo đức, trách nhiệm xã hội, pháp lý, vd: 10.B2.1, 11.B2.1, 12.B1.1, 12.B2.1, 12.B3.1).
- Mã NL AI chuẩn: “[Lớp].[Mã chủ đề].[Số thứ tự]” (hoặc “NL[a/b/c/d]-[Lớp].[Mã chủ đề].[Số thứ tự]”), ví dụ: “10.A1.1”, “11.B2.1”, “12.B2.1”, “12.C3.1”, “12.D1.1”.
- MẪU TRÌNH BÀY BẮT BUỘC: “Thành phần NL AI: NLb - Đạo đức AI, an toàn, pháp luật và trách nhiệm; Khối lớp: 12; Chủ đề: B2; Mã chỉ báo NL AI: 12.B2.1”.
- Mã NLS phải giữ nguyên đúng mã mức NC trong bảng TT 02/CV 3456, ví dụ “1.1.NCa”, “1.2.NCa”, “6.2.NCa”. Không dùng mã CB, TC hoặc NC1a.
- Trình bày NLS: “Mã chỉ báo NLS: 1.1.NCa; Thành phần NLS: Duyệt, tìm kiếm và lọc dữ liệu số”.
- Mọi mã NLS và mã NL AI trong phần bổ sung phải được chèn vào văn bản bằng chữ màu đỏ (#FF0000); nội dung giáo án gốc giữ nguyên 100% định dạng và màu sắc.
`;

const LOCKED_NLS_AI_INTEGRATION_RULES = `
==== BỘ QUY TẮC KHÓA TÍCH HỢP NLS / NL AI (ÁP DỤNG CHO KHBD, PL1, PL2, PL3, PL4) ====
1. PHẠM VI RÀ SOÁT:
- Phải rà soát từng bài, từng dòng phụ lục và từng hoạt động theo Chuỗi đối chiếu 13 bước.
- Với mỗi hoạt động chỉ chọn 1 trong 4 kết luận: (1) Không tích hợp NLS/NL AI; (2) Chỉ NLS; (3) Chỉ NL AI; (4) Tích hợp cả NLS và NL AI.
- Nếu không có điểm chạm thật từ YCCĐ và hoạt động của học sinh, ghi chính xác: "Không tích hợp NLS/NL AI trong hoạt động này."; tuyệt đối không gán mã hình thức.

2. CHUỖI MINH CHỨNG BẮT BUỘC:
- Mọi mã phải chứng minh được theo chuỗi: YCCĐ môn học nguyên văn -> Nhiệm vụ -> Hành vi học sinh -> Sản phẩm -> Minh chứng -> Mã NLS -> YCCĐ AI QĐ 2422 -> Mã AI -> Công cụ -> Kiểm chứng -> Tiêu chí đánh giá.
- Việc giáo viên dùng máy tính, máy chiếu hoặc AI soạn bài KHÔNG tính là năng lực của học sinh.

3. NĂNG LỰC SỐ THEO TT 02/2025/TT-BGDĐT (MỨC NC CHO THPT):
- Chỉ gán NLS khi học sinh trực tiếp thực hiện hành vi số. Mỗi bài/chủ đề mặc định tối đa 1 mã chính.
- Mã chuẩn mức NC có dạng [miền].[NLTP].NC[chỉ báo], ví dụ 1.1.NCa, 1.2.NCa, 6.2.NCa.

4. GIÁO DỤC AI THEO QĐ 2422/QĐ-BGDĐT & CV 5588/BGDĐT-GDPT:
- Chỉ chọn NLa/NLb/NLc/NLd khi học sinh trực tiếp dùng AI, đặt prompt, kiểm chứng kết quả hoặc đánh giá rủi ro/thiết kế sản phẩm AI.
- Mã AI chuẩn: [Lớp].[Chủ đề].[Số TT] (ví dụ: 10.A1.1, 10.C3.2, 11.C3.MR1, 12.C4.MR1).

5. AN TOÀN, ĐẠO ĐỨC VÀ ĐÁNH GIÁ:
- Không nhập dữ liệu cá nhân học sinh vào AI; tôn trọng bản quyền; ghi rõ nguồn; phân biệt phần học sinh làm và phần AI gợi ý.
- Mọi hoạt động có phương án dự phòng ngoại tuyến (không Internet / không thiết bị số).
`;

const AI_THEMES_BY_THPT_GRADE: Record<string, string[]> = {
  "10": ["A1", "A2", "A3", "B2", "B3", "C2", "C3", "C4", "D1", "D2"],
  "11": ["A1", "A2", "A3", "B2", "B3", "C2", "C3", "C5", "D1", "D2"],
  "12": ["A1", "A2", "A3", "B1", "B2", "B3", "C2", "C3", "C4", "D1", "D2"],
};

const extractGradeNumber = (grade?: string) => {
  const match = (grade || "").match(/\b(10|11|12|[1-9])\b/);
  return match?.[1] || (grade || "").trim();
};

const isThptGrade = (grade?: string) => ["10", "11", "12"].includes(extractGradeNumber(grade));
const isPrimaryGrade = (grade?: string) => ["1", "2", "3", "4", "5"].includes(extractGradeNumber(grade));

const NLS_LEVEL_BY_GRADE: Record<string, string> = {
  "1": "CB1", "2": "CB1", "3": "CB1",
  "4": "CB2", "5": "CB2",
  "6": "TC1", "7": "TC1",
  "8": "TC2", "9": "TC2",
  "10": "NC1", "11": "NC1", "12": "NC1",
};

const getExpectedNlsLevel = (grade?: string) => NLS_LEVEL_BY_GRADE[extractGradeNumber(grade)];

type GradeCandidate = { grade: string; score: number };

const findGradeCandidate = (text?: string): GradeCandidate | undefined => {
  const lines = String(text || "").slice(0, 60000).split(/\r?\n/);
  const scores = new Map<string, number>();

  lines.forEach((line, lineIndex) => {
    const normalizedLine = normalizeViText(line);
    if (!normalizedLine) return;

    // Generated integration lines may contain an old/wrong grade. They are not
    // reliable evidence for the actual grade of the lesson plan.
    if (/ma chi bao|thanh phan nl ai|tich hop nls|tich hop nl ai|nl[abcd]\s*[-:]/i.test(normalizedLine)) return;

    const nearbyText = normalizeViText(lines.slice(Math.max(0, lineIndex - 2), lineIndex + 3).join(" "));
    const gradePattern = /(?:khối\s*lớp|khoi\s*lop|lớp|lop|khối|khoi)\s*(?:học|hoc)?\s*([:\-–—]?)\s*(10|11|12|[1-9])\b/gi;
    let match: RegExpExecArray | null;
    while ((match = gradePattern.exec(line)) !== null) {
      const grade = match[2];
      let score = 4;
      if (match[1]) score += 3;
      if (lineIndex < 80) score += 4;
      else if (lineIndex < 200) score += 2;
      if (/ke hoach bai day|giao an|ke hoach giao duc|mon\s*[:\-]|khoi lop/i.test(nearbyText)) score += 7;
      scores.set(grade, (scores.get(grade) || 0) + score);
    }
  });

  const ranked = [...scores.entries()]
    .map(([grade, score]) => ({ grade, score }))
    .sort((a, b) => b.score - a.score);
  return ranked[0];
};

const detectGradeFromText = (lessonPlanText?: string, pl1Text?: string) => {
  const lessonGrade = findGradeCandidate(lessonPlanText);
  const pl1Grade = findGradeCandidate(pl1Text);

  if (lessonGrade && pl1Grade?.grade === lessonGrade.grade) return lessonGrade.grade;
  if (lessonGrade && (!pl1Grade || lessonGrade.score >= pl1Grade.score - 3)) return lessonGrade.grade;
  if (pl1Grade) return pl1Grade.grade;
  return lessonGrade?.grade;
};

const KNOWN_NLS_CODE_SET = new Set(KNOWN_NLS_INDICATORS.map((indicator) => indicator.code.toUpperCase()));
const getKnownNlsIndicator = (code?: string) => {
  const normalizedCode = String(code || "").trim().toUpperCase();
  return KNOWN_NLS_INDICATORS.find((indicator) => indicator.code.toUpperCase() === normalizedCode);
};

const collectAuthorizedNlsCodes = (grade: string | undefined, ...sources: unknown[]) => {
  const expectedLevel = getExpectedNlsLevel(grade);
  const codes = new Set<string>();
  sources.forEach((source) => {
    const matches = String(source || "").match(/\b([1-6]\.\d+)\.?(CB1|CB2|TC1|TC2|NC1|NC2)([a-z])\b/gi) || [];
    matches.forEach((rawCode) => {
      const match = rawCode.match(/\b([1-6]\.\d+)\.?(CB1|CB2|TC1|TC2|NC1|NC2)([a-z])\b/i);
      if (!match) return;
      const [, component, level, indicator] = match;
      if (expectedLevel && level.toUpperCase() !== expectedLevel) return;
      codes.add(`${component}.${level.toUpperCase()}${indicator.toLowerCase()}`.toUpperCase());
    });
  });
  return codes;
};

const sanitizeNlsCodeForGrade = (code: string | undefined, grade?: string, authorizedNlsCodes = new Set<string>()) => {
  const rawCode = (code || "").trim();
  if (!rawCode) return { code: "Không gán mã", note: "Thiếu mã NLS." };

  const cleanCode = rawCode.replace(/\.NC1([a-z])\b/i, ".NC$1");
  const match = cleanCode.match(/\b([1-6]\.\d+)\.?(NC|CB1|CB2|TC1|TC2|NC1|NC2)([a-z])\b/i);
  if (!match) return { code: "Không gán mã", note: `Mã "${rawCode}" không đúng cấu trúc NLS.` };

  const [, component, rawLevel, indicator] = match;
  let level = rawLevel.toUpperCase();
  if (level === "NC1" || level === "NC2") level = "NC";
  const expectedLevel = getExpectedNlsLevel(grade);
  const isThpt = ["10", "11", "12"].includes(extractGradeNumber(grade));

  if (!isThpt && expectedLevel && level !== expectedLevel && level !== "NC") {
    return {
      code: "Không gán mã",
      note: `Mức ${level} không khớp mức tham chiếu ${expectedLevel} của lớp ${extractGradeNumber(grade)}; cần đối chiếu bảng mã gốc.`,
    };
  }

  const normalizedCode = `${component}.${level}${indicator.toLowerCase()}`;
  if (isNlsCodeValid(normalizedCode) || isNlsCodeValid(normalizedCode.replace('.NC1', '.NC')) || KNOWN_NLS_CODE_SET.has(normalizedCode.toUpperCase()) || KNOWN_NLS_CODE_SET.has(normalizedCode.replace('.NC', '.NC1').toUpperCase())) {
    return { code: normalizedCode.replace('.NC1', '.NC'), verifiedFromSource: true };
  }

  return { code: normalizedCode.replace('.NC1', '.NC') };
};
const AI_CODE_PATTERN = /^(NL([abcd]))\s*[-–—:]\s*(\d{1,2})\.([ABCD]\d+)\.(MR\d+|\d+)$/i;
const AI_CODE_SEARCH_PATTERN = /\b(NL([abcd]))\s*[-–—:]\s*(\d{1,2})\.([ABCD]\d+)\.(MR\d+|\d+)\b/i;
const isLikelyPlaceholderIndicatorCode = (code?: string) => /^\s*(?:NL[abcd]\s*[-–—:]\s*)?\d{1,2}\.A\d+\.a\s*$/i.test(code || "");

const formatAiComponentCode = (letter?: string) => letter ? `NL${letter.toLowerCase()}` : undefined;

const extractExplicitAiComponent = (...values: Array<string | undefined>) => {
  for (const value of values) {
    const match = String(value || "").match(/\bNL\s*([abcd])\b/i);
    if (match) return formatAiComponentCode(match[1]);
  }
  return undefined;
};

const isValidAiIndicatorCode = (code: string, grade?: string) => {
  const normalizedCode = code.trim();
  const currentGrade = extractGradeNumber(grade);
  const match = normalizedCode.match(AI_CODE_PATTERN);
  if (!match) return false;
  const [, , componentLetter, codeGrade, rawTheme] = match;
  if (componentLetter.toUpperCase() !== rawTheme[0].toUpperCase()) return false;
  if (NLS_LEVEL_BY_GRADE[currentGrade] && codeGrade !== currentGrade) return false;
  const canonicalFull = formatAiCode2422(normalizedCode);
  if (!canonicalFull || canonicalFull.toLowerCase() !== normalizedCode.replace(/\s+/g, "").toLowerCase()) return false;
  const item = getAiRequirementByCode(canonicalFull);
  return Boolean(item && (!currentGrade || item.grade === currentGrade));
};

const getSafeAiIndicatorCode = (code?: string, grade?: string) => {
  if (!code || isLikelyPlaceholderIndicatorCode(code)) return undefined;
  const trimmed = code.trim();
  if (!isValidAiIndicatorCode(trimmed, grade)) return undefined;
  return formatAiCode2422(trimmed);
};

const getAiCompetencyComponentName = (code?: string) => {
  const component = extractExplicitAiComponent(code);
  if (component === "NLa") return "NLa - Tư duy lấy con người làm trung tâm";
  if (component === "NLb") return "NLb - Đạo đức AI, an toàn, pháp luật và trách nhiệm";
  if (component === "NLc") return "NLc - Các kĩ thuật và ứng dụng AI";
  if (component === "NLd") return "NLd - Thiết kế, thử nghiệm và cải tiến hệ thống AI";
  return "Thành phần năng lực AI theo QĐ 2422/QĐ-BGDĐT";
};

const normalizeAiCompetencyComponentName = (value?: string, code?: string) => {
  const rawValue = String(value || "").trim();
  const explicitComponent = extractExplicitAiComponent(rawValue, code);
  const component = explicitComponent?.slice(-1).toUpperCase();
  if (component === "A") return "NLa - Tư duy lấy con người làm trung tâm";
  if (component === "B") return "NLb - Đạo đức AI, an toàn, pháp luật và trách nhiệm";
  if (component === "C") return "NLc - Các kĩ thuật và ứng dụng AI";
  if (component === "D") return "NLd - Thiết kế, thử nghiệm và cải tiến hệ thống AI";
  return rawValue || getAiCompetencyComponentName(code);
};

const getAiReferenceFields = (code?: string, grade?: string, suggestedTopic?: string) => {
  const codeMatch = String(code || "").match(/\b(\d{1,2})\.([ABCD]\d+)\.(MR\d+|\d+)\b/i);
  const currentGrade = extractGradeNumber(grade);
  const topicMatch = String(suggestedTopic || "").match(/\b([ABCD]\d+)\b/i);
  const topicCandidate = (codeMatch?.[2] || topicMatch?.[1] || "").toUpperCase();
  const allowedThemes = AI_THEMES_BY_THPT_GRADE[currentGrade];
  const topic = topicCandidate && (!allowedThemes || allowedThemes.includes(topicCandidate))
    ? topicCandidate
    : "";
  return {
    grade: codeMatch?.[1] || currentGrade || "",
    topic,
    indicatorCode: getSafeAiIndicatorCode(code, grade) || "",
  };
};

const sanitizeAiCodeForGrade = (code: string | undefined, grade?: string, competencyName?: string) => {
  const currentGrade = extractGradeNumber(grade) || "10";
  const rawCode = (code || "").trim();
  if (!rawCode) return { code: "Không gán mã", note: "Thiếu mã NL AI." };

  const directFormatted = formatAiCode2422(rawCode);
  if (directFormatted) return { code: directFormatted };

  const numericMatch = rawCode.match(/\b(\d{1,2})\.([ABCD]\d*)\.(MR\d+|\d+)\b/i);
  if (!numericMatch) {
    return { code: "Không gán mã", note: `Mã "${rawCode}" không đúng định dạng NL AI.` };
  }

  let [, codeGrade, rawTheme, rawOrder] = numericMatch;
  const theme = rawTheme.toUpperCase();
  const topicLetter = theme.slice(0, 1);
  const componentCode = topicLetter === "A" ? "NLa" : topicLetter === "B" ? "NLb" : topicLetter === "C" ? "NLc" : "NLd";

  if (["10", "11", "12"].includes(currentGrade)) {
    codeGrade = currentGrade;
  }

  const canonicalFull = formatAiCode2422(`${componentCode}-${codeGrade}.${theme}.${rawOrder}`);
  if (canonicalFull) {
    return { code: canonicalFull };
  }
  return { code: `${componentCode}-${codeGrade}.${theme}.${rawOrder}` };
};
const appendSanitizerNote = (text: string | undefined, note?: string) => {
  if (!note) return text || "";
  const base = (text || "").trim();
  return base ? `${base} (${note})` : note;
};

const normalizeIntegrationDecision = (suggestion: any) => {
  const raw = normalizeViText(String(suggestion?.integrationDecision || ""));
  if (/khong tich hop/.test(raw)) return "Không tích hợp";
  if (/nls.*(?:va|&)?.*ai|ai.*(?:va|&)?.*nls|dong thoi/.test(raw)) return "NLS và NL AI";
  if (/chi nls|nls only/.test(raw)) return "Chỉ NLS";
  if (/chi (?:nl )?ai|ai only/.test(raw)) return "Chỉ NL AI";
  const hasNls = /\b\d+\.\d+\.(?:CB1|CB2|TC1|TC2|NC1|NC2)[a-z]\b/i.test(String(suggestion?.suggestedNLS || ""))
    || Boolean(String(suggestion?.nlsStudentBehavior || "").trim());
  const hasAi = AI_CODE_PATTERN.test(String(suggestion?.suggestedAI || "").trim())
    || /NL[abcd]/i.test(String(suggestion?.aiCompetencyName || suggestion?.aiComponentName || ""));
  if (hasNls && hasAi) return "NLS và NL AI";
  if (hasNls) return "Chỉ NLS";
  if (hasAi) return "Chỉ NL AI";
  return "Không tích hợp";
};

const integrationUsesNls = (decision?: string) => /nls/i.test(decision || "");
const integrationUsesAi = (decision?: string) => /ai/i.test(decision || "");
const resolveVerifiedIntegrationDecision = (
  requestedDecision: string,
  hasValidNlsCode: boolean,
  hasValidAiCode: boolean,
) => {
  const keepsNls = integrationUsesNls(requestedDecision) && hasValidNlsCode;
  const keepsAi = integrationUsesAi(requestedDecision) && hasValidAiCode;
  if (keepsNls && keepsAi) return "NLS và NL AI";
  if (keepsNls) return "Chỉ NLS";
  if (keepsAi) return "Chỉ NL AI";
  return "Không tích hợp";
};

const collectAuthorizedAiCodes = (grade: string | undefined, ...sources: unknown[]) => {
  const codes = new Set<string>();
  sources.forEach((source) => {
    const matches = String(source || "").match(/\bNL[abcd]\s*[-–—:]\s*\d{1,2}\.[ABCD]\d+\.(?:MR\d+|\d+)\b/gi) || [];
    matches.forEach((rawCode) => {
      const sanitized = sanitizeAiCodeForGrade(rawCode, grade);
      if (sanitized.code !== "Không gán mã") codes.add(sanitized.code.toUpperCase());
    });
  });
  return codes;
};

const sanitizeCompetencyTextCodes = (value: unknown, grade?: string, authorizedAiCodes = new Set<string>(), authorizedNlsCodes = new Set<string>()) => {
  let text = String(value || "");
  text = text.replace(/\b([1-6]\.\d+)\.?(CB1|CB2|TC1|TC2|NC1|NC2)([a-z])\b/gi, (rawCode) => {
    const sanitized = sanitizeNlsCodeForGrade(rawCode, grade, authorizedNlsCodes);
    return sanitized.code === "Không gán mã"
      ? `Không gán mã NLS (${sanitized.note})`
      : sanitized.code;
  });
  text = text.replace(/\bNL[abcd]\s*[-–—:]\s*\d{1,2}\.[ABCD]\d+\.(?:MR\d+|\d+)\b/gi, (rawCode) => {
    const sanitized = sanitizeAiCodeForGrade(rawCode, grade);
    if (sanitized.code === "Không gán mã") return `Không gán mã AI (${sanitized.note})`;
    return sanitized.code;
  });
  text = text.replace(/\b\d{1,2}\.[ABCD]\d+\.(?:MR\d+|\d+)\b/gi, (rawCode, offset, wholeText) => {
    const prefix = String(wholeText).slice(Math.max(0, Number(offset) - 24), Number(offset));
    if (/NL[abcd]\s*[-–—:]\s*$/i.test(prefix)) return rawCode;
    const context = String(wholeText).slice(Math.max(0, Number(offset) - 180), Number(offset) + rawCode.length + 180);
    const component = extractExplicitAiComponent(context);
    const sanitized = sanitizeAiCodeForGrade(rawCode, grade, component);
    return sanitized.code === "Không gán mã"
      ? `Không gán mã AI (${sanitized.note})`
      : sanitized.code;
  });
  return text;
};

const sanitizeCompetencyCodesDeep = (value: any, grade?: string, authorizedAiCodes = new Set<string>(), authorizedNlsCodes = new Set<string>()): any => {
  if (typeof value === "string") return sanitizeCompetencyTextCodes(value, grade, authorizedAiCodes, authorizedNlsCodes);
  if (Array.isArray(value)) return value.map((item) => sanitizeCompetencyCodesDeep(item, grade, authorizedAiCodes, authorizedNlsCodes));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeCompetencyCodesDeep(item, grade, authorizedAiCodes, authorizedNlsCodes)]));
  }
  return value;
};

/**
 * Tự động chuẩn hóa và gán điểm chạm NLS & NL AI chuẩn cho các bài học nếu AI sinh thiếu hoặc ghi từ chối không có căn cứ
 */
function autoAlignCompetencyForInstructionalLesson(row: any, grade: string = "10", subject: string = ""): any {
  if (!row || typeof row !== "object") return row;

  const content = String(row.lessonContent || row.lesson || row.topic || "").trim();
  const yccd = String(row.lessonGoal || row.yccd || "").trim();
  const combined = `${content} ${yccd}`.toLowerCase();
  const isAssessment = /(kiểm tra|kiem tra|đánh giá định kì|danh gia dinh ki|giữa kì|giua ki|cuối kì|cuoi ki|dự trữ|du tru|ôn tập học kì|on tap hoc ki|mid-term|end-of-term|reviews*d|tests*d)/i.test(content);

  if (isAssessment) {
    if (!row.digitalCompetencyTT02 || !row.digitalCompetencyTT02.includes("Không tích hợp")) {
      row.digitalCompetencyTT02 = "Không tích hợp - Tiết kiểm tra / đánh giá định kì.";
    }
    if (!row.aiCompetency2422Integrated || !row.aiCompetency2422Integrated.includes("Không tích hợp")) {
      row.aiCompetency2422Integrated = "Không tích hợp - Tiết kiểm tra / đánh giá định kì.";
    }
    return row;
  }

  const g = ["10", "11", "12"].includes(String(grade)) ? String(grade) : "10";
  const normSubject = (subject || row.subject || "").toLowerCase();
  const isEnglish = normSubject.includes("tiếng anh") || normSubject.includes("english") || /units*d|getting started|language|reading|speaking|listening|writing/i.test(content);

  // 1. NĂNG LỰC SỐ (NLS)
  const isNlsDetailed = row.digitalCompetencyTT02 && /Hành vi|Sản phẩm|YCCĐ/i.test(row.digitalCompetencyTT02);
  const nlsMissing = !row.digitalCompetencyTT02 || /not integrated|không tích hợp|không gán mã/i.test(row.digitalCompetencyTT02) || !isNlsDetailed;

  if (nlsMissing) {
    if (isEnglish) {
      if (/getting started/i.test(combined)) {
        row.digitalCompetencyTT02 = `Mã chỉ báo NLS: 1.1.NCa; Thành phần NLS: Duyệt, tìm kiếm và lọc dữ liệu số\n- YCCĐ NLS: Tìm kiếm và khai thác hình ảnh, tư liệu âm thanh/video số về chủ đề bài học qua môi trường số.\n- Hành vi HS: Sử dụng công cụ tìm kiếm số để thu thập từ vựng và hình ảnh mở đầu.\n- Sản phẩm đầu ra: Bộ sưu tập từ vựng, hình ảnh số theo chủ đề bài học.`;
      } else if (/language|pronunciation|grammar|vocabulary/i.test(combined)) {
        row.digitalCompetencyTT02 = `Mã chỉ báo NLS: 6.2.NCa; Thành phần NLS: Sử dụng phần mềm và công nghệ số chuyên ngành\n- YCCĐ NLS: Sử dụng phần mềm số và từ điển trực tuyến để rèn luyện phát âm và tra cứu cấu trúc ngôn ngữ.\n- Hành vi HS: Tra cứu ngữ âm, phát âm mẫu trên ứng dụng từ điển số và ghi âm đối chiếu.\n- Sản phẩm đầu ra: File ghi âm phát âm chuẩn và bảng tra cứu từ vựng số.`;
      } else if (/reading/i.test(combined)) {
        row.digitalCompetencyTT02 = `Mã chỉ báo NLS: 1.2.NCa; Thành phần NLS: Đánh giá dữ liệu, thông tin và nội dung số\n- YCCĐ NLS: Đánh giá độ tin cậy của thông tin số và khai thác tư liệu đọc mở rộng bằng tiếng Anh.\n- Hành vi HS: Đọc hiểu và phân tích độ tin cậy của các bài báo, tư liệu tiếng Anh trên internet.\n- Sản phẩm đầu ra: Bản tóm tắt bài đọc kèm danh mục nguồn tin kiểm chứng.`;
      } else if (/speaking/i.test(combined)) {
        row.digitalCompetencyTT02 = `Mã chỉ báo NLS: 2.2.NCa; Thành phần NLS: Chia sẻ thông tin và nội dung số\n- YCCĐ NLS: Chia sẻ bản ghi âm, clip thuyết trình tiếng Anh qua nền tảng số của lớp.\n- Hành vi HS: Ghi hình/ghi âm bài nói tiếng Anh và đăng tải lên không gian học tập trực tuyến.\n- Sản phẩm đầu ra: Video/audio thuyết trình tiếng Anh được số hóa hoàn chỉnh.`;
      } else if (/listening/i.test(combined)) {
        row.digitalCompetencyTT02 = `Mã chỉ báo NLS: 1.1.NCa; Thành phần NLS: Duyệt, tìm kiếm và lọc dữ liệu số\n- YCCĐ NLS: Tiếp nhận, xử lý và điều hướng giữa các nguồn học liệu âm thanh số trong học tập.\n- Hành vi HS: Nghe podcast/audio số, điều chỉnh tốc độ nghe và ghi chú thông tin then chốt.\n- Sản phẩm đầu ra: Bản ghi chép (note-taking) số hóa các ý chính từ bài nghe.`;
      } else if (/writing/i.test(combined)) {
        row.digitalCompetencyTT02 = `Mã chỉ báo NLS: 3.1.NCa; Thành phần NLS: Phát triển nội dung số\n- YCCĐ NLS: Tạo lập và định dạng bài viết đoạn văn, bài luận tiếng Anh bằng công cụ soạn thảo số.\n- Hành vi HS: Soạn thảo bài viết, sử dụng công cụ kiểm tra chính tả/ngữ pháp và định dạng văn bản số.\n- Sản phẩm đầu ra: Bài luận tiếng Anh được số hóa và trình bày chuẩn mực.`;
      } else if (/project|looking back/i.test(combined)) {
        row.digitalCompetencyTT02 = `Mã chỉ báo NLS: 2.4.NCa; Thành phần NLS: Hợp tác thông qua công nghệ số\n- YCCĐ NLS: Hợp tác nhóm trực tuyến trên nền tảng số để thiết kế sản phẩm dự án học tập.\n- Hành vi HS: Phân công nhiệm vụ nhóm qua bảng số, cùng chỉnh sửa slide thuyết trình dự án.\n- Sản phẩm đầu ra: Bộ slide thuyết trình dự án hoàn chỉnh của nhóm trên không gian số.`;
      } else {
        row.digitalCompetencyTT02 = `Mã chỉ báo NLS: 1.1.NCa; Thành phần NLS: Duyệt, tìm kiếm và lọc dữ liệu số\n- YCCĐ NLS: Khai thác dữ liệu, thông tin số chính thống phục vụ nhiệm vụ học tập tiếng Anh.\n- Hành vi HS: Tìm kiếm và chọn lọc tư liệu số liên quan đến bài học.\n- Sản phẩm đầu ra: Phiếu học tập số hóa ghi nhận thông tin đã tìm kiếm.`;
      }
    } else {
      // Non-English subjects (Địa lí, Lịch sử, Toán, Lý, Hóa, Sinh, Tin học, Công nghệ, GDCD...)
      if (/thực hành|báo cáo|dự án|tuyên truyền|sản phẩm|infographic|áp phích|poster|thuyết trình/i.test(combined)) {
        row.digitalCompetencyTT02 = `Mã chỉ báo NLS: 3.1.NCa; Thành phần NLS: Phát triển nội dung số\n- YCCĐ NLS: Tạo lập, biên tập và định dạng sản phẩm số phục vụ báo cáo thực hành, tuyên truyền hoặc dự án học tập.\n- Hành vi HS: Sử dụng công cụ đồ họa/soạn thảo số để thiết kế báo cáo, infographic hoặc poster số.\n- Sản phẩm đầu ra: Báo cáo thực hành/infographic số được số hóa và chia sẻ trên nền tảng học tập của lớp.`;
      } else if (/đối chiếu|kiểm chứng|so sánh|đánh giá|phản biện|độ tin cậy|chọn lọc/i.test(combined)) {
        row.digitalCompetencyTT02 = `Mã chỉ báo NLS: 1.2.NCa; Thành phần NLS: Đánh giá dữ liệu, thông tin và nội dung số\n- YCCĐ NLS: Đánh giá dữ liệu, thông tin và nội dung số; kiểm chứng chéo độ tin cậy của các nguồn học liệu số.\n- Hành vi HS: Tra cứu nhiều nguồn tư liệu số chính thống, đối chiếu và thẩm định độ chính xác của thông tin.\n- Sản phẩm đầu ra: Bảng đối chiếu và thẩm định độ tin cậy của các nguồn dữ liệu số.`;
      } else if (/chia sẻ|thảo luận|làm việc nhóm|hợp tác|trao đổi/i.test(combined)) {
        row.digitalCompetencyTT02 = `Mã chỉ báo NLS: 2.4.NCa; Thành phần NLS: Hợp tác thông qua công nghệ số\n- YCCĐ NLS: Hợp tác nhóm trực tuyến thông qua công cụ và nền tảng số để hoàn thành nhiệm vụ học tập.\n- Hành vi HS: Phối hợp làm việc nhóm trên tài liệu số dùng chung, thảo luận và phản hồi trực tuyến.\n- Sản phẩm đầu ra: Sản phẩm học tập hợp tác nhóm được số hóa hoàn chỉnh.`;
      } else {
        row.digitalCompetencyTT02 = `Mã chỉ báo NLS: 1.1.NCa; Thành phần NLS: Duyệt, tìm kiếm và lọc dữ liệu số\n- YCCĐ NLS: Tìm kiếm, duyệt và lọc dữ liệu, thông tin số chính thống phục vụ yêu cầu cần đạt của bài học.\n- Hành vi HS: Sử dụng từ khóa logic để tra cứu văn bản, biểu đồ, hình ảnh số chính thống trên internet.\n- Sản phẩm đầu ra: Bộ dữ liệu số tổng hợp thông tin cốt lõi phục vụ bài học.`;
      }
    }
  }

  // 2. NĂNG LỰC AI (NL AI)
  const isAiDetailed = row.aiCompetency2422Integrated && /Hành vi|Sản phẩm|Tiêu chí/i.test(row.aiCompetency2422Integrated);
  const aiMissing = !row.aiCompetency2422Integrated || /not integrated|không tích hợp|không gán mã/i.test(row.aiCompetency2422Integrated) || !isAiDetailed;

  if (aiMissing) {
    if (isEnglish) {
      if (/getting started/i.test(combined)) {
        row.aiCompetency2422Integrated = `Thành phần NL AI: NLc - Các kĩ thuật và ứng dụng AI; Khối lớp: ${g}; Chủ đề: C3; Mã chỉ báo NL AI: NLc-${g}.C3.1\n- Yêu cầu cần đạt AI: Kỹ thuật Prompt Engineering cơ bản (Sử dụng prompt để AI gợi ý từ vựng, ngữ cảnh giao tiếp theo chủ đề bài học).\n- Hành vi học sinh: Học sinh nhập câu lệnh prompt có bối cảnh để AI gợi ý từ vựng và câu đàm thoại; đối chiếu với SGK.\n- Sản phẩm đầu ra: Lịch sử câu lệnh prompt và bảng từ vựng gợi ý đã được kiểm chứng.\n- Tiêu chí đánh giá: Câu lệnh rõ ràng, thông tin từ vựng chính xác và phù hợp chủ đề.`;
      } else if (/language|pronunciation|grammar|vocabulary/i.test(combined)) {
        row.aiCompetency2422Integrated = `Thành phần NL AI: NLc - Các kĩ thuật và ứng dụng AI; Khối lớp: ${g}; Chủ đề: C2; Mã chỉ báo NL AI: NLc-${g}.C2.1\n- Yêu cầu cần đạt AI: Ứng dụng AI trong học tập ngôn ngữ (Sử dụng AI giải thích sắc thái từ vựng, cấu trúc ngữ pháp).\n- Hành vi học sinh: Học sinh yêu cầu AI phân biệt các cấu trúc ngữ pháp tương đồng và đưa ra ví dụ minh họa.\n- Sản phẩm đầu ra: Bảng so sánh ngữ pháp/sắc thái từ vựng do AI gợi ý và học sinh chỉnh sửa.\n- Tiêu chí đánh giá: Giải thích đúng ngữ pháp, có ví dụ đối chiếu chuẩn xác với SGK.`;
      } else if (/reading/i.test(combined)) {
        row.aiCompetency2422Integrated = `Thành phần NL AI: NLa - Tư duy lấy con người làm trung tâm; Khối lớp: ${g}; Chủ đề: A3; Mã chỉ báo NL AI: NLa-${g}.A3.1\n- Yêu cầu cần đạt AI: Kiểm soát và giám sát AI (Đọc hiểu văn bản SGK và kiểm chứng tính chính xác của bản tóm tắt do AI tạo ra).\n- Hành vi học sinh: Học sinh yêu cầu AI tóm tắt văn bản đọc, sau đó rà soát và chỉ ra các điểm AI tóm tắt chưa chuẩn hoặc ảo giác.\n- Sản phẩm đầu ra: Bản nhận xét đối chiếu văn bản tóm tắt của AI với nội dung bài đọc SGK.\n- Tiêu chí đánh giá: Phát hiện chính xác điểm chưa chuẩn xác của AI, lập luận dựa trên dẫn chứng bài đọc.`;
      } else if (/speaking/i.test(combined)) {
        row.aiCompetency2422Integrated = `Thành phần NL AI: NLc - Các kĩ thuật và ứng dụng AI; Khối lớp: ${g}; Chủ đề: C2; Mã chỉ báo NL AI: NLc-${g}.C2.1\n- Yêu cầu cần đạt AI: Ứng dụng AI tương tác đàm thoại (Luyện tập phản xạ giao tiếp tiếng Anh theo chủ đề).\n- Hành vi học sinh: Học sinh tương tác thoại hoặc chat với AI chatbot đóng vai nhân vật trong tình huống giao tiếp.\n- Sản phẩm đầu ra: Bản ghi chép/lịch sử đoạn hội thoại tiếng Anh với AI.\n- Tiêu chí đánh giá: Phản xạ ngôn ngữ tự nhiên, sử dụng đúng từ vựng và cấu trúc của bài học.`;
      } else if (/listening/i.test(combined)) {
        row.aiCompetency2422Integrated = `Thành phần NL AI: NLa - Tư duy lấy con người làm trung tâm; Khối lớp: ${g}; Chủ đề: A1; Mã chỉ báo NL AI: NLa-${g}.A1.1\n- Yêu cầu cần đạt AI: Con người trong hệ thống AI (Đánh giá độ chính xác của phụ đề do AI nhận diện).\n- Hành vi học sinh: Học sinh nghe audio gốc và kiểm tra lại transcript/phụ đề tự động do AI sinh ra.\n- Sản phẩm đầu ra: Bản transcript đã được học sinh nghe và đính chính các lỗi nhận diện của AI.\n- Tiêu chí đánh giá: Sửa đúng các từ vựng AI nhận diện sai, hiểu chính xác nội dung audio.`;
      } else if (/writing/i.test(combined)) {
        row.aiCompetency2422Integrated = `Thành phần NL AI: NLb - Đạo đức AI, an toàn, pháp luật và trách nhiệm; Khối lớp: ${g}; Chủ đề: B3; Mã chỉ báo NL AI: NLb-${g}.B3.1\n- Yêu cầu cần đạt AI: Liêm chính học thuật và trách nhiệm khi sử dụng AI (Ghi rõ nguồn, không sao chép nguyên văn).\n- Hành vi học sinh: Sử dụng AI để gợi ý dàn ý, tự viết bài luận và lập bảng minh bạch nội dung AI gợi ý.\n- Sản phẩm đầu ra: Bài viết hoàn chỉnh kèm phần chú thích minh bạch mức độ sử dụng AI.\n- Tiêu chí đánh giá: Tự thể hiện văn phong cá nhân, tuyệt đối không sao chép nguyên văn từ AI, có trích dẫn rõ ràng.`;
      } else if (/project|looking back/i.test(combined)) {
        row.aiCompetency2422Integrated = `Thành phần NL AI: NLd - Thiết kế, thử nghiệm và cải tiến hệ thống AI; Khối lớp: ${g}; Chủ đề: D1; Mã chỉ báo NL AI: NLd-${g}.D1.1\n- Yêu cầu cần đạt AI: Thiết kế dự án học tập có ứng dụng AI (Thiết kế bài thuyết trình dự án có sự hỗ trợ công cụ AI).\n- Hành vi học sinh: Sử dụng AI để lên ý tưởng trình bày, hỗ trợ thiết kế slide và chuẩn bị nội dung thuyết trình.\n- Sản phẩm đầu ra: Hồ sơ dự án học tập có ứng dụng AI và được kiểm chứng bởi học sinh.\n- Tiêu chí đánh giá: Ý tưởng sáng tạo, nội dung tiếng Anh chuẩn xác, minh bạch công cụ AI sử dụng.`;
      } else {
        row.aiCompetency2422Integrated = `Thành phần NL AI: NLc - Các kĩ thuật và ứng dụng AI; Khối lớp: ${g}; Chủ đề: C3; Mã chỉ báo NL AI: NLc-${g}.C3.1\n- Yêu cầu cần đạt AI: Kỹ thuật Prompt Engineering (Đặt câu lệnh có cấu trúc để khai thác tư liệu học tập có chọn lọc).\n- Hành vi học sinh: Thiết lập câu lệnh truy vấn thông tin học tập, phân tích và chọn lọc kết quả từ AI.\n- Sản phẩm đầu ra: Phiếu học tập ghi nhận câu lệnh prompt và kết quả chọn lọc.\n- Tiêu chí đánh giá: Prompt có cấu trúc rõ ràng, thông tin thu nhận có tính chọn lọc và chính xác.`;
      }
    } else {
      // Non-English subjects (Địa lí, Lịch sử, Toán, Lý, Hóa, Sinh, Tin học, Công nghệ, GDCD...)
      const isPracticalOrProject = /thực hành|báo cáo|dự án|tuyên truyền|sản phẩm|infographic|thiết kế|địa phương/i.test(combined);
      const isSecurityOrEthics = /chủ quyền|biển đảo|an ninh|pháp luật|đạo đức|tin giả|deepfake|bản quyền|liêm chính|môi trường|bền vững|tài nguyên/i.test(combined);
      const isDataOrSim = /số liệu|biểu đồ|bảng số liệu|bản đồ|gis|thống kê|tính toán|mô phỏng|thuật toán|dữ liệu/i.test(combined);
      const isCareer = /nghề nghiệp|định hướng nghề|thị trường lao động/i.test(combined);
      const isFactCheck = /kiểm chứng|rà soát|fact-check|phản biện|đối chiếu|đánh giá độ tin cậy/i.test(combined);

      if (g === "12") {
        if (isSecurityOrEthics) {
          if (/môi trường|bền vững|tài nguyên/i.test(combined)) {
            row.aiCompetency2422Integrated = `Thành phần NL AI: NLb - Đạo đức AI, an toàn, pháp luật và trách nhiệm; Khối lớp: 12; Chủ đề: B3; Mã chỉ báo NL AI: NLb-12.B3.1\n- Yêu cầu cần đạt AI: Đánh giá được tác động của việc tiêu thụ năng lượng và tài nguyên tính toán của AI đối với môi trường và phát triển bền vững.\n- Hành vi học sinh: Học sinh phân tích tác động môi trường từ hạ tầng AI và đề xuất giải pháp sử dụng công nghệ xanh, bền vững.\n- Sản phẩm đầu ra: Báo cáo ngắn hoặc sơ đồ tư duy đánh giá tác động môi trường của AI trong môn học.\n- Tiêu chí đánh giá: Lập luận có căn cứ khoa học, đề xuất giải pháp khả thi gắn với bảo vệ môi trường.`;
          } else if (/pháp luật|quy định|trách nhiệm giải trình/i.test(combined)) {
            row.aiCompetency2422Integrated = `Thành phần NL AI: NLb - Đạo đức AI, an toàn, pháp luật và trách nhiệm; Khối lớp: 12; Chủ đề: B1; Mã chỉ báo NL AI: NLb-12.B1.1\n- Yêu cầu cần đạt AI: Phân tích được các quy định pháp luật về trách nhiệm giải trình và an toàn khi vận hành hệ thống AI.\n- Hành vi học sinh: Học sinh nghiên cứu các quy định pháp lý, phân tích tình huống thực tế về trách nhiệm khi sử dụng AI.\n- Sản phẩm đầu ra: Bảng phân tích tình huống pháp lý và trách nhiệm đạo đức khi ứng dụng AI.\n- Tiêu chí đánh giá: Đúng quy chuẩn pháp luật, nêu rõ trách nhiệm giải trình của người sử dụng.`;
          } else {
            row.aiCompetency2422Integrated = `Thành phần NL AI: NLb - Đạo đức AI, an toàn, pháp luật và trách nhiệm; Khối lớp: 12; Chủ đề: B2; Mã chỉ báo NL AI: NLb-12.B2.1\n- Yêu cầu cần đạt AI: Nhận diện được các nguy cơ deepfake, tin giả, thông tin sai lệch do AI tạo ra; thực hiện được các biện pháp xác thực nguồn tin đa kênh.\n- Hành vi học sinh: Học sinh nhận diện nguy cơ thông tin sai lệch/deepfake từ AI, thực hiện kiểm chứng chéo với cổng thông tin chính thống và SGK để bảo vệ chủ quyền dữ liệu.\n- Sản phẩm đầu ra: Bản báo cáo tư liệu có kèm bảng đối chiếu xác thực đa nguồn và ghi chú kiểm chứng tin giả.\n- Tiêu chí đánh giá: Đảm bảo tính xác thực tuyệt đối của nguồn tin, bảo vệ chủ quyền thông tin quốc gia.`;
          }
        } else if (isPracticalOrProject) {
          row.aiCompetency2422Integrated = `Thành phần NL AI: NLd - Thiết kế, thử nghiệm và cải tiến hệ thống AI; Khối lớp: 12; Chủ đề: D1; Mã chỉ báo NL AI: NLd-12.D1.1\n- Yêu cầu cần đạt AI: Xây dựng và thực hiện một dự án học tập hoàn chỉnh có ứng dụng AI từ bước thu thập dữ liệu, xử lý, phân tích đến báo cáo kết quả và đánh giá.\n- Hành vi học sinh: Học sinh ứng dụng AI để tổng hợp dữ liệu, thiết kế đồ họa/báo cáo thực hành, thuyết minh và kiểm chứng kết quả với số liệu thực tế.\n- Sản phẩm đầu ra: Báo cáo thực hành/dự án số hoàn chỉnh có minh bạch phần đóng góp của AI và phần tự làm của học sinh.\n- Tiêu chí đánh giá: Đúng chuẩn kiến thức môn học, minh bạch lịch sử prompt, có số liệu đối chiếu kiểm chứng rõ ràng.`;
        } else if (isDataOrSim) {
          row.aiCompetency2422Integrated = `Thành phần NL AI: NLc - Các kĩ thuật và ứng dụng AI; Khối lớp: 12; Chủ đề: C3; Mã chỉ báo NL AI: NLc-12.C3.1\n- Yêu cầu cần đạt AI: Sử dụng thành thạo các mô hình AI chuyên ngành để phân tích cấu trúc không gian, biểu đồ, bảng số liệu hoặc dữ liệu chuyên sâu.\n- Hành vi học sinh: Học sinh thiết lập câu lệnh prompt truy vấn mô hình AI chuyên ngành để xử lý số liệu, phân tích không gian và mô phỏng biểu đồ.\n- Sản phẩm đầu ra: Bảng số liệu thống kê, biểu đồ phân tích và kết quả nhận xét địa lí được kiểm chứng.\n- Tiêu chí đánh giá: Số liệu chính xác, biểu đồ trực quan, đối chiếu chuẩn xác với Atlat/SGK.`;
        } else if (isCareer) {
          row.aiCompetency2422Integrated = `Thành phần NL AI: NLa - Tư duy lấy con người làm trung tâm; Khối lớp: 12; Chủ đề: A2; Mã chỉ báo NL AI: NLa-12.A2.1\n- Yêu cầu cần đạt AI: Xác định được lộ trình phát triển năng lực bản thân để thích ứng và cộng tác hiệu quả với AI trong lĩnh vực tương lai.\n- Hành vi học sinh: Học sinh sử dụng AI để khảo sát xu hướng nghề nghiệp, tự đánh giá điểm mạnh và lập kế hoạch thích ứng nghề nghiệp.\n- Sản phẩm đầu ra: Bản kế hoạch phát triển năng lực cá nhân trong kỷ nguyên AI.\n- Tiêu chí đánh giá: Mục tiêu rõ ràng, định hướng nghề nghiệp thực tế, chủ động làm chủ công nghệ.`;
        } else {
          row.aiCompetency2422Integrated = `Thành phần NL AI: NLa - Tư duy lấy con người làm trung tâm; Khối lớp: 12; Chủ đề: A1; Mã chỉ báo NL AI: NLa-12.A1.1\n- Yêu cầu cần đạt AI: Thể hiện được tư duy độc lập và năng lực làm chủ công nghệ; đưa ra phán đoán phản biện và quyết định cuối cùng trong môn học.\n- Hành vi học sinh: Học sinh đối chiếu các thông tin gợi ý của AI với kiến thức SGK/Atlat, phản biện và đưa ra kết luận độc lập.\n- Sản phẩm đầu ra: Bản ghi chép bài học có tích hợp nhận xét phản biện câu trả lời của AI kèm căn cứ SGK.\n- Tiêu chí đánh giá: Thể hiện tư duy độc lập, con người làm chủ quyết định, không sao chép thụ động.`;
        }
      } else if (g === "11") {
        if (isSecurityOrEthics) {
          if (/định kiến|bias|công bằng/i.test(combined)) {
            row.aiCompetency2422Integrated = `Thành phần NL AI: NLb - Đạo đức AI, an toàn, pháp luật và trách nhiệm; Khối lớp: 11; Chủ đề: B2; Mã chỉ báo NL AI: NLb-11.B2.1\n- Yêu cầu cần đạt AI: Nhận diện và phân tích biểu hiện thiên lệch/bias trong phản hồi của AI; đề xuất cách kiểm chứng.\n- Hành vi học sinh: Học sinh so sánh nhiều câu trả lời từ AI để nhận diện định kiến hoặc thiếu sót thông tin.\n- Sản phẩm đầu ra: Bảng phân tích phát hiện định kiến/thiên lệch của AI và phương án kiểm chứng chéo.\n- Tiêu chí đánh giá: Phân tích khách quan, chỉ rõ góc nhìn thiên kiến và căn cứ đối chiếu chuẩn.`;
          } else {
            row.aiCompetency2422Integrated = `Thành phần NL AI: NLb - Đạo đức AI, an toàn, pháp luật và trách nhiệm; Khối lớp: 11; Chủ đề: B3; Mã chỉ báo NL AI: NLb-11.B3.1\n- Yêu cầu cần đạt AI: Vận dụng chuẩn mực liêm chính học thuật khi dùng AI; lập bảng đối chiếu minh bạch nội dung AI gợi ý và tự làm.\n- Hành vi học sinh: Sử dụng AI để tham khảo ý tưởng, tự viết nội dung và trích dẫn rõ ràng phần AI đóng góp.\n- Sản phẩm đầu ra: Bản báo cáo/bài tập có bảng chú thích minh bạch mức độ sử dụng AI.\n- Tiêu chí đánh giá: Tuân thủ liêm chính học thuật, phân định rõ ràng giữa AI và tư duy cá nhân.`;
          }
        } else if (isPracticalOrProject) {
          row.aiCompetency2422Integrated = `Thành phần NL AI: NLd - Thiết kế, thử nghiệm và cải tiến hệ thống AI; Khối lớp: 11; Chủ đề: D1; Mã chỉ báo NL AI: NLd-11.D1.1\n- Yêu cầu cần đạt AI: Xây dựng quy trình học tập cá nhân hóa có sự trợ giúp của AI và kiểm tra chéo kết quả.\n- Hành vi học sinh: Thiết kế các bước thực hiện nhiệm vụ học tập có ứng dụng AI và tự đánh giá qua rubric.\n- Sản phẩm đầu ra: Quy trình giải pháp học tập tích hợp AI hoàn chỉnh.\n- Tiêu chí đánh giá: Quy trình logic, có tiêu chí kiểm thử kết quả và minh chứng rõ ràng.`;
        } else if (isDataOrSim) {
          row.aiCompetency2422Integrated = `Thành phần NL AI: NLc - Các kĩ thuật và ứng dụng AI; Khối lớp: 11; Chủ đề: C5; Mã chỉ báo NL AI: NLc-11.C5.1\n- Yêu cầu cần đạt AI: Sử dụng AI để xử lý, làm sạch và phân tích các tập dữ liệu thực nghiệm/thống kê trong môn học; rút ra kết luận logic.\n- Hành vi học sinh: Nhập dữ liệu bảng vào AI để lọc, tính toán tốc độ tăng trưởng/cơ cấu và vẽ biểu đồ minh họa.\n- Sản phẩm đầu ra: Báo cáo phân tích dữ liệu thống kê kèm biểu đồ số do AI hỗ trợ.\n- Tiêu chí đánh giá: Tính toán chính xác, nhận xét rút ra có căn cứ khoa học.`;
        } else if (isCareer) {
          row.aiCompetency2422Integrated = `Thành phần NL AI: NLa - Tư duy lấy con người làm trung tâm; Khối lớp: 11; Chủ đề: A2; Mã chỉ báo NL AI: NLa-11.A2.1\n- Yêu cầu cần đạt AI: Đánh giá sự thay đổi ngành nghề dưới tác động của AI; xác định kỹ năng cần trau dồi.\n- Hành vi học sinh: Tra cứu và phân tích tác động của AI đến các ngành nghề liên quan đến môn học.\n- Sản phẩm đầu ra: Bài thu hoạch phân tích cơ hội và thách thức nghề nghiệp trong thời đại AI.\n- Tiêu chí đánh giá: Đánh giá đa chiều, xác định đúng các kỹ năng cốt lõi con người cần có.`;
        } else {
          row.aiCompetency2422Integrated = `Thành phần NL AI: NLa - Tư duy lấy con người làm trung tâm; Khối lớp: 11; Chủ đề: A1; Mã chỉ báo NL AI: NLa-11.A1.1\n- Yêu cầu cần đạt AI: Phân tích vai trò bổ trợ của AI; giải thích tại sao quyết định nhân văn và phán đoán thuộc về con người.\n- Hành vi học sinh: Học sinh thảo luận nhóm về các phương án do AI đề xuất và đưa ra lựa chọn có trách nhiệm.\n- Sản phẩm đầu ra: Biên bản thảo luận nhóm khẳng định vai trò quyết định của con người.\n- Tiêu chí đánh giá: Lập luận chặt chẽ, khẳng định con người làm chủ công nghệ.`;
        }
      } else {
        // Grade 10
        if (isSecurityOrEthics) {
          if (/dữ liệu cá nhân|quyền riêng tư|bảo vệ/i.test(combined)) {
            row.aiCompetency2422Integrated = `Thành phần NL AI: NLb - Đạo đức AI, an toàn, pháp luật và trách nhiệm; Khối lớp: 10; Chủ đề: B2; Mã chỉ báo NL AI: NLb-10.B2.1\n- Yêu cầu cần đạt AI: Tuân thủ nguyên tắc không chia sẻ dữ liệu nhạy cảm, định danh cá nhân khi tương tác với AI.\n- Hành vi học sinh: Thực hành bảo mật thông tin cá nhân, không nhập thông tin định danh khi đặt prompt.\n- Sản phẩm đầu ra: Bản cam kết/quy tắc sử dụng AI an toàn của học sinh.\n- Tiêu chí đánh giá: Tuân thủ nghiêm ngặt quy định an toàn và bảo mật dữ liệu.`;
          } else {
            row.aiCompetency2422Integrated = `Thành phần NL AI: NLb - Đạo đức AI, an toàn, pháp luật và trách nhiệm; Khối lớp: 10; Chủ đề: B3; Mã chỉ báo NL AI: NLb-10.B3.1\n- Yêu cầu cần đạt AI: Giải thích sự cần thiết của việc ghi rõ nguồn gốc, mức độ hỗ trợ của AI; tôn trọng bản quyền.\n- Hành vi học sinh: Ghi chú rõ nguồn tài liệu tham khảo và câu lệnh prompt đã sử dụng trong bài tập.\n- Sản phẩm đầu ra: Bài làm có phần trích dẫn nguồn AI đúng chuẩn mực.\n- Tiêu chí đánh giá: Minh bạch thông tin, tôn trọng quyền tác giả và liêm chính.`;
          }
        } else if (isPracticalOrProject) {
          row.aiCompetency2422Integrated = `Thành phần NL AI: NLd - Thiết kế, thử nghiệm và cải tiến hệ thống AI; Khối lớp: 10; Chủ đề: D1; Mã chỉ báo NL AI: NLd-10.D1.1\n- Yêu cầu cần đạt AI: Đề xuất ý tưởng sử dụng công cụ AI phù hợp để giải quyết nhiệm vụ học tập thực tiễn môn học.\n- Hành vi học sinh: Lựa chọn công cụ AI phù hợp và phác thảo ý tưởng hoàn thành bài thực hành.\n- Sản phẩm đầu ra: Bản đề xuất ý tưởng giải quyết bài toán thực hành có sự hỗ trợ của AI.\n- Tiêu chí đánh giá: Ý tưởng sáng tạo, công cụ phù hợp và có tính khả thi cao.`;
        } else if (isDataOrSim || /prompt|câu lệnh/i.test(combined)) {
          row.aiCompetency2422Integrated = `Thành phần NL AI: NLc - Các kĩ thuật và ứng dụng AI; Khối lớp: 10; Chủ đề: C3; Mã chỉ báo NL AI: NLc-10.C3.1\n- Yêu cầu cần đạt AI: Thiết kế và tinh chỉnh câu lệnh có cấu trúc rõ ràng để nhận phản hồi chính xác từ AI.\n- Hành vi học sinh: Thực hành đặt câu lệnh prompt có bối cảnh, vai trò và yêu cầu cụ thể để AI hỗ trợ tra cứu.\n- Sản phẩm đầu ra: Bảng ghi nhận các câu lệnh prompt và kết quả phản hồi đã được tinh chỉnh.\n- Tiêu chí đánh giá: Câu lệnh rõ ràng, mạch lạc, kết quả AI trả về đạt yêu cầu.`;
        } else if (isFactCheck) {
          row.aiCompetency2422Integrated = `Thành phần NL AI: NLa - Tư duy lấy con người làm trung tâm; Khối lớp: 10; Chủ đề: A3; Mã chỉ báo NL AI: NLa-10.A3.1\n- Yêu cầu cần đạt AI: Thực hiện rà soát, kiểm chứng độc lập các nội dung do AI tạo ra bằng các nguồn SGK chính thống.\n- Hành vi học sinh: Đối chiếu câu trả lời của AI với SGK Kết nối tri thức, phát hiện các điểm chưa chính xác.\n- Sản phẩm đầu ra: Bảng so sánh thông tin AI và kiến thức chuẩn SGK kèm dẫn chứng trang sách.\n- Tiêu chí đánh giá: Nhận diện chính xác lỗi sai của AI, chỉ rõ căn cứ SGK.`;
        } else if (isCareer) {
          row.aiCompetency2422Integrated = `Thành phần NL AI: NLa - Tư duy lấy con người làm trung tâm; Khối lớp: 10; Chủ đề: A2; Mã chỉ báo NL AI: NLa-10.A2.1\n- Yêu cầu cần đạt AI: Nêu ví dụ về lợi ích và rủi ro của AI; khẳng định AI chỉ hỗ trợ chứ không thay thế tư duy con người.\n- Hành vi học sinh: Nêu dẫn chứng về việc AI hỗ trợ học tập môn học và các giới hạn của công cụ.\n- Sản phẩm đầu ra: Bản ghi chép thu hoạch về cơ hội và giới hạn của AI.\n- Tiêu chí đánh giá: Hiểu đúng bản chất công cụ, không phụ thuộc vào AI.`;
        } else {
          row.aiCompetency2422Integrated = `Thành phần NL AI: NLa - Tư duy lấy con người làm trung tâm; Khối lớp: 10; Chủ đề: A1; Mã chỉ báo NL AI: NLa-10.A1.1\n- Yêu cầu cần đạt AI: Nhận biết con người là chủ thể thiết kế, kiểm soát hoạt động và chịu trách nhiệm về quyết định của AI.\n- Hành vi học sinh: Học sinh chủ động đóng vai trò người kiểm soát, ra quyết định cuối cùng khi sử dụng AI.\n- Sản phẩm đầu ra: Bản kết luận bài học do học sinh tự tổng hợp và quyết định.\n- Tiêu chí đánh giá: Khẳng định vai trò chủ thể của người học, làm chủ tri thức.`;
        }
      }
    }
  }

  return row;
}

const sanitizeGeneratedCompetencyRows = (rows: any[], grade?: string, authorizedAiCodes = new Set<string>(), authorizedNlsCodes = new Set<string>()) =>
  rows.map((row) => {
    const aligned = autoAlignCompetencyForInstructionalLesson(row, grade, row?.subject);
    return sanitizeCompetencyCodesDeep(aligned, grade, authorizedAiCodes, authorizedNlsCodes);
  });
const normalizeViText = (value?: string) =>
  (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");

const isGeographyLikeSubject = (subject?: string) => /dia l[yi]|giao duc dia phuong|lich su va dia l[yi]/.test(normalizeViText(subject));
const isStandaloneGeographySubject = (subject?: string) => {
  const key = normalizeViText(subject).replace(/[^a-z0-9]+/g, " ").trim();
  return key === "dia li" || key === "dia ly";
};
const needsScientificFormatting = (subject?: string) => /toan|vat l[yi]|hoa hoc|sinh hoc|dia l[yi]/.test(normalizeViText(subject));
const getGeographyCurriculumByGrade = (grade?: string) =>
  ((DiaLy as Record<string, any[]>)[String(grade || "").trim()] || []);

const getSubjectCompetencyRule = (subject: string) => {
  const key = normalizeViText(subject);
  if (/dia l[yi]|giao duc dia phuong|lich su va dia l[yi]/.test(key)) {
    return "- Môn Địa lí/GD địa phương: chỉ gán mã khi YCCĐ yêu cầu/cho phép thao tác với bản đồ, Atlat, GIS, biểu đồ, bảng số liệu, dữ liệu địa phương hoặc công thức tính toán địa lí. Nếu có số liệu phải tạo bảng/biểu đồ đúng dạng, không chuyển thành đoạn văn.";
  }
  if (/lich su/.test(key)) {
    return "- Môn Lịch sử: chỉ gán mã khi YCCĐ yêu cầu/cho phép phân tích tư liệu, kiểm chứng nguồn, lập timeline, so sánh bối cảnh, nguyên nhân - hệ quả hoặc đánh giá quan điểm lịch sử.";
  }
  if (/toan/.test(key)) {
    return "- Môn Toán: ưu tiên lập luận, mô hình hóa, kí hiệu, bảng, hình vẽ và công thức Word; không làm mất cấu trúc bài toán, giả thiết, kết luận hoặc kí hiệu toán học.";
  }
  if (/vat l[yi]|hoa hoc|sinh hoc|khoa hoc tu nhien/.test(key)) {
    return "- Nhóm KHTN/Vật lí/Hóa học/Sinh học: bám quy trình thí nghiệm, dữ liệu đo đạc, công thức, mô hình, an toàn học đường và giải thích hiện tượng; bảng thí nghiệm/công thức/hình vẽ phải giữ đúng định dạng.";
  }
  if (/ngu van/.test(key)) {
    return "- Môn Ngữ văn: bám đọc hiểu, viết, nói-nghe, phân tích văn bản, phong cách, bản quyền và kiểm chứng nguồn; AI chỉ hỗ trợ gợi ý, không thay thế cảm thụ và lập luận của học sinh.";
  }
  if (/tieng anh|english/.test(key)) {
    return "- Môn Tiếng Anh: toàn bộ giáo án và nội dung tích hợp phải viết bằng tiếng Anh; bám 4 kĩ năng nghe-nói-đọc-viết, giao tiếp số và đánh giá ngôn ngữ.";
  }
  if (/tin hoc/.test(key)) {
    return "- Môn Tin học: bám thuật toán, dữ liệu, lập trình, sản phẩm số, an toàn thông tin và trách nhiệm số; cần có sản phẩm/mã giả/bảng kiểm rõ ràng.";
  }
  if (/cong nghe/.test(key)) {
    return "- Môn Công nghệ: bám thiết kế kĩ thuật, quy trình, hệ thống, vật liệu, sản phẩm, tiêu chí kiểm thử và cải tiến giải pháp.";
  }
  if (/kinh te|phap luat|cong dan/.test(key)) {
    return "- Môn GDCD/GDKT&PL: bám tình huống pháp luật/kinh tế, đạo đức số, ra quyết định công dân, tranh biện và minh chứng hành vi.";
  }
  if (/the chat|quoc phong|trai nghiem|huong nghiep/.test(key)) {
    return "- Nhóm hoạt động/kĩ năng: bám nhiệm vụ thực hành, trải nghiệm, an toàn, hợp tác, tự đánh giá và minh chứng sản phẩm; không gán mã AI nếu không có thao tác số/AI thật.";
  }
  return "- Ưu tiên năng lực số và năng lực AI xuất hiện tự nhiên từ yêu cầu bài học, không gượng ép.";
};

const needsGeoDataArtifact = (analysis: any, suggestion: any, sourceText?: string) => {
  if (!isGeographyLikeSubject(analysis?.subject)) return false;
  const combined = normalizeViText([
    analysis?.topic,
    suggestion?.activityName,
    suggestion?.reason,
    suggestion?.action,
    suggestion?.yccdEvidence,
    sourceText?.slice(0, 10000)
  ].filter(Boolean).join("\n"));
  return /(bang so lieu|bieu do|so lieu|du lieu|aqi|o nhiem|tai nguyen|dan so|kinh te|khi hau|nhiet do|luong mua|grdp|co cau|dien tich|san luong|mat do|toc do tang|ti le|ty le|thuc hanh|nhan xet|giai thich|phan tich)/.test(combined);
};

const buildGeoDataRequirement = (analysis: any, suggestion: any, sourceText?: string) => {
  if (!needsGeoDataArtifact(analysis, suggestion, sourceText)) return suggestion?.geoDataRequirement;
  const topic = analysis?.topic || "bài học Địa lí";
  const activityName = suggestion?.activityName || "hoạt động tích hợp";
  const combined = normalizeViText(`${topic}\n${activityName}\n${suggestion?.action || ""}\n${suggestion?.reason || ""}`);
  const isAqi = /aqi|o nhiem|khong khi|pm2/.test(combined);
  const isForest = /rung|tai nguyen|sinh vat|dat|nuoc/.test(combined);
  const isEconomy = /grdp|kinh te|co cau|san luong|dien tich gieo trong/.test(combined);
  const metric = isAqi
    ? "Chỉ số AQI/PM2.5 theo địa điểm hoặc thời điểm"
    : isForest
      ? "Diện tích/tỉ lệ tài nguyên theo năm hoặc theo vùng"
      : isEconomy
        ? "GRDP/cơ cấu ngành/sản lượng hoặc diện tích theo vùng"
        : "Chỉ tiêu địa lí theo năm/vùng";
  const source = isAqi
    ? "IQAir/AirVisual, cổng quan trắc môi trường địa phương hoặc bảng số liệu giáo viên cung cấp"
    : "SGK, Atlat, Niên giám thống kê, Tổng cục Thống kê/cổng thông tin địa phương hoặc bảng số liệu giáo viên cung cấp";

  return {
    dataTable: `Bắt buộc có bảng số liệu cho ${activityName}: ${metric}. Nếu giáo án/SGK đã có số liệu thì dùng nguyên số liệu đó; nếu chưa có, tạo bảng khung để HS điền từ nguồn chính thống.`,
    sampleTableMarkdown: `| Đối tượng/Thời điểm | Chỉ tiêu | Giá trị | Nguồn kiểm chứng |\n|---|---|---:|---|\n| Mẫu 1 | ${metric} | ... | ${source} |\n| Mẫu 2 | ${metric} | ... | ${source} |\n| Mẫu 3 | ${metric} | ... | ${source} |`,
    chart: `[Biểu đồ: ${isAqi ? "Biểu đồ đường/cột so sánh AQI hoặc PM2.5 theo thời điểm" : isEconomy ? "Biểu đồ cột/tròn thể hiện cơ cấu hoặc quy mô kinh tế" : "Biểu đồ cột/đường thể hiện biến động chỉ tiêu địa lí"} trong ${topic}]`,
    dataSource: source,
    studentTask: "HS nhập/kiểm chứng số liệu, chọn loại biểu đồ phù hợp, vẽ biểu đồ, nhận xét xu hướng và giải thích bằng kiến thức Địa lí; AI chỉ hỗ trợ gợi ý cách xử lí và phải được đối chiếu nguồn."
  };
};

export const sanitizeAnalysisResultForGrade = (
  analysis: any,
  sourceText?: string,
  forcedGrade?: string,
) => {
  const grade = forcedGrade || extractGradeNumber(analysis?.grade) || "10";
  const authorizedNlsCodes = collectAuthorizedNlsCodes(grade, sourceText);
  let rawSuggestions = Array.isArray(analysis?.aiSuggestions) ? analysis.aiSuggestions : [];

  const defaultTasksByGrade: Record<string, any[]> = {
    "10": [
      {
        activityName: "Hoạt động 1: Mở đầu (Khởi động)",
        targetSection: "Nội dung",
        targetContent: "Khởi động và tìm hiểu nhiệm vụ mở đầu",
        integrationDecision: "NLS và NL AI",
        suggestedNLS: "1.1.NCa",
        nlsCompetencyName: "Tìm kiếm và lọc dữ liệu, thông tin và nội dung số",
        nlsStudentBehavior: "Học sinh sử dụng công cụ tìm kiếm và từ khóa logic để thu thập dữ liệu số, hình ảnh minh họa về chủ đề bài học.",
        nlsProduct: "Bộ sưu tập tư liệu số và từ khóa trọng tâm của bài học.",
        nlsCriteria: "Dữ liệu chính xác, trích dẫn đúng nguồn và bám sát mục tiêu bài học.",
        suggestedAI: "NLc-10.C3.1",
        aiCompetencyName: "NLc - Các kĩ thuật và ứng dụng AI",
        aiTopic: "C3",
        aiStudentBehavior: "Học sinh thiết lập câu lệnh prompt có cấu trúc để AI gợi ý các ví dụ/hiện tượng thực tế liên quan đến bài học.",
        aiYccd: "Thiết kế và tinh chỉnh câu lệnh prompt rõ ràng để nhận phản hồi từ AI.",
        aiProduct: "Lịch sử prompt và bảng tổng hợp câu trả lời do AI cung cấp.",
        aiCriteria: "Prompt rõ bối cảnh, học sinh đối chiếu thông tin với SGK Kết nối tri thức.",
        aiEvidence: "Câu lệnh prompt và phần ghi chép phân tích của học sinh.",
        yccdEvidence: "YCCĐ môn học theo Chương trình GDPT 2018.",
        integrationLevel: "Mức vừa",
        devicePlan: "Phương án B: Thiết bị dùng chung / máy chiếu lớp",
        reason: "Tạo hứng thú và hình thành kỹ năng tương tác với công nghệ số ngay đầu bài học.",
        action: "HS tìm kiếm tài liệu số và nhập câu lệnh prompt."
      },
      {
        activityName: "Hoạt động 2: Hình thành kiến thức mới",
        targetSection: "Thực hiện nhiệm vụ",
        targetContent: "Khai thác tài liệu và phân tích kiến thức trọng tâm",
        integrationDecision: "NLS và NL AI",
        suggestedNLS: "1.2.NCa",
        nlsCompetencyName: "Đánh giá dữ liệu, thông tin và nội dung số",
        nlsStudentBehavior: "Học sinh đối chiếu số liệu, thông tin do AI tạo ra với biểu đồ, bảng số liệu trong SGK Kết nối tri thức.",
        nlsProduct: "Bảng đối chiếu thông tin và phát hiện điểm chính xác/sai lệch.",
        nlsCriteria: "Đánh giá chính xác độ tin cậy của thông tin số, chỉ ra căn cứ đối chiếu.",
        suggestedAI: "NLa-10.A3.1",
        aiCompetencyName: "NLa - Tư duy lấy con người làm trung tâm",
        aiTopic: "A3",
        aiStudentBehavior: "Học sinh kiểm soát và giám sát AI, nhận diện điểm thiếu sót hoặc ảo giác (hallucination) của AI so với học liệu chuẩn.",
        aiYccd: "Thực hiện việc rà soát, kiểm chứng độc lập các nội dung do AI tạo ra bằng tài liệu chính thống.",
        aiProduct: "Báo cáo nhận xét tính đúng đắn của thông tin AI kèm trích dẫn SGK.",
        aiCriteria: "Chỉ rõ căn cứ từ SGK để kiểm chứng câu trả lời của AI.",
        aiEvidence: "Bản đối chiếu và ghi chú kiểm chứng của học sinh.",
        yccdEvidence: "Hình thành kiến thức môn học kết hợp tư duy phản biện.",
        integrationLevel: "Mức vừa",
        devicePlan: "Phương án B: Máy chiếu / làm việc nhóm",
        reason: "Rèn luyện tư duy phản biện, làm chủ công nghệ và an toàn thông tin.",
        action: "HS kiểm chứng chéo thông tin AI với SGK."
      },
      {
        activityName: "Hoạt động 4: Vận dụng",
        targetSection: "Nội dung",
        targetContent: "Vận dụng kiến thức bài học vào thực tiễn",
        integrationDecision: "NLS và NL AI",
        suggestedNLS: "3.1.NCa",
        nlsCompetencyName: "Phát triển nội dung số",
        nlsStudentBehavior: "Học sinh biên tập và thiết kế sản phẩm số (infographic, poster số hoặc báo cáo trình chiếu) giải quyết nhiệm vụ thực tiễn.",
        nlsProduct: "Sản phẩm số hoàn chỉnh thể hiện giải pháp vận dụng kiến thức bài học.",
        nlsCriteria: "Sản phẩm trực quan, sáng tạo, thông tin chính xác và có tính ứng dụng cao.",
        suggestedAI: "NLd-10.D1.1",
        aiCompetencyName: "NLd - Thiết kế, thử nghiệm và cải tiến hệ thống AI",
        aiTopic: "D1",
        aiStudentBehavior: "Học sinh ứng dụng AI để gợi ý dàn ý, thiết kế và tối ưu hóa giải pháp giải quyết bài toán thực tế.",
        aiYccd: "Đề xuất được ý tưởng sử dụng công cụ AI phù hợp để giải quyết nhiệm vụ học tập thực tiễn.",
        aiProduct: "Bản đề xuất giải pháp có sự hỗ trợ của AI và ghi rõ nguồn gốc.",
        aiCriteria: "Ý tưởng khả thi, minh bạch phần AI đóng góp và phần tự hoàn thiện.",
        aiEvidence: "Sản phẩm hoàn thiện và báo cáo giải trình.",
        yccdEvidence: "Vận dụng kiến thức vào bối cảnh thực tiễn.",
        integrationLevel: "Mức sâu",
        devicePlan: "Phương án A/B: Thực hiện tại nhà hoặc phòng bộ môn",
        reason: "Khuyến khích sáng tạo và kỹ năng ứng dụng AI giải quyết vấn đề.",
        action: "HS hoàn thành sản phẩm số vận dụng."
      }
    ],
    "11": [
      {
        activityName: "Hoạt động 1: Mở đầu (Khởi động)",
        targetSection: "Nội dung",
        targetContent: "Khởi động và kết nối tri thức",
        integrationDecision: "NLS và NL AI",
        suggestedNLS: "1.1.NCa",
        nlsCompetencyName: "Tìm kiếm và lọc dữ liệu, thông tin và nội dung số",
        nlsStudentBehavior: "Học sinh sử dụng công cụ tìm kiếm và từ khóa chuyên ngành để thu thập dữ liệu số phục vụ bài học.",
        nlsProduct: "Tư liệu số tổng hợp ban đầu.",
        nlsCriteria: "Nguồn chính thống, bám sát yêu cầu cần đạt.",
        suggestedAI: "NLc-11.C3.1",
        aiCompetencyName: "NLc - Các kĩ thuật và ứng dụng AI",
        aiTopic: "C3",
        aiStudentBehavior: "Học sinh áp dụng kỹ thuật prompt nâng cao (Few-shot, Chain-of-thought) để AI gợi ý góc nhìn đa chiều về vấn đề học tập.",
        aiYccd: "Áp dụng kỹ thuật prompt nâng cao để xử lý các bài toán, tình huống phức tạp trong môn học.",
        aiProduct: "Bản ghi prompt và kết quả gợi ý từ AI.",
        aiCriteria: "Prompt có cấu trúc rõ ràng, tư duy logic.",
        aiEvidence: "Lịch sử tương tác và ghi chép của học sinh.",
        yccdEvidence: "YCCĐ môn học Chương trình GDPT 2018.",
        integrationLevel: "Mức vừa",
        devicePlan: "Phương án B: Thiết bị dùng chung / máy chiếu",
        reason: "Khai thác kỹ thuật prompt nâng cao trong bối cảnh lớp 11.",
        action: "HS thực hiện lệnh prompt nâng cao với AI."
      },
      {
        activityName: "Hoạt động 2: Hình thành kiến thức mới",
        targetSection: "Thực hiện nhiệm vụ",
        targetContent: "Phân tích, xử lý dữ liệu và hình thành kiến thức",
        integrationDecision: "NLS và NL AI",
        suggestedNLS: "1.2.NCa",
        nlsCompetencyName: "Đánh giá dữ liệu, thông tin và nội dung số",
        nlsStudentBehavior: "Học sinh đối chiếu, phát hiện thiên kiến và kiểm chứng độ chính xác của thông tin do AI cung cấp.",
        nlsProduct: "Bảng phân tích đối chiếu thông tin AI và SGK.",
        nlsCriteria: "Đánh giá khách quan, chỉ rõ căn cứ đối chiếu.",
        suggestedAI: "NLa-11.A1.1",
        aiCompetencyName: "NLa - Tư duy lấy con người làm trung tâm",
        aiTopic: "A1",
        aiStudentBehavior: "Học sinh phân tích vai trò bổ trợ của AI, thực hiện phán đoán phản biện và ra quyết định độc lập.",
        aiYccd: "Phân tích được vai trò bổ trợ của AI; giải thích tại sao quyết định nhân văn và phán đoán thuộc về con người.",
        aiProduct: "Báo cáo nhận định phản biện của học sinh.",
        aiCriteria: "Lập luận chặt chẽ, khẳng định con người làm chủ AI.",
        aiEvidence: "Bản phân tích và biên bản làm việc nhóm.",
        yccdEvidence: "Rèn luyện tư duy độc lập và làm chủ công nghệ.",
        integrationLevel: "Mức vừa",
        devicePlan: "Phương án B: Thảo luận nhóm / máy chiếu",
        reason: "Khẳng định vai trò chủ đạo của con người trong kỷ nguyên AI.",
        action: "HS đánh giá phản biện kết quả AI."
      },
      {
        activityName: "Hoạt động 4: Vận dụng",
        targetSection: "Nội dung",
        targetContent: "Vận dụng và phát triển giải pháp",
        integrationDecision: "NLS và NL AI",
        suggestedNLS: "3.1.NCa",
        nlsCompetencyName: "Phát triển nội dung số",
        nlsStudentBehavior: "Học sinh thiết kế giải pháp học tập hoặc sản phẩm số cá nhân hóa có sự hỗ trợ của AI.",
        nlsProduct: "Sản phẩm dự án hoặc quy trình học tập cá nhân hóa.",
        nlsCriteria: "Tính ứng dụng cao, minh bạch phần AI đóng góp.",
        suggestedAI: "NLd-11.D1.1",
        aiCompetencyName: "NLd - Thiết kế, thử nghiệm và cải tiến hệ thống AI",
        aiTopic: "D1",
        aiStudentBehavior: "Học sinh xây dựng quy trình học tập cá nhân hóa có sự trợ giúp của AI và kiểm tra chéo kết quả.",
        aiYccd: "Xây dựng được quy trình học tập cá nhân hóa có sự trợ giúp của AI.",
        aiProduct: "Kế hoạch giải pháp học tập tích hợp AI hoàn chỉnh.",
        aiCriteria: "Quy trình rõ ràng, có tiêu chí kiểm thử kết quả.",
        aiEvidence: "Hồ sơ dự án học tập.",
        yccdEvidence: "Vận dụng giải quyết vấn đề thực tiễn.",
        integrationLevel: "Mức sâu",
        devicePlan: "Phương án A/B: Thực hiện tại nhà hoặc phòng bộ môn",
        reason: "Phát triển năng lực thiết kế giải pháp có AI hỗ trợ.",
        action: "HS hoàn thành quy trình giải pháp số."
      }
    ],
    "12": [
      {
        activityName: "Hoạt động 1: Mở đầu (Khởi động)",
        targetSection: "Nội dung",
        targetContent: "Khởi động và kết nối vấn đề chuyên sâu",
        integrationDecision: "NLS và NL AI",
        suggestedNLS: "1.1.NCa",
        nlsCompetencyName: "Tìm kiếm và lọc dữ liệu, thông tin và nội dung số",
        nlsStudentBehavior: "Học sinh tra cứu dữ liệu số chuyên ngành từ các nguồn tài liệu chính thống của bộ ngành.",
        nlsProduct: "Bộ số liệu và tư liệu số chuyên đề.",
        nlsCriteria: "Số liệu chuẩn xác, trích dẫn đúng quy chuẩn.",
        suggestedAI: "NLc-12.C3.1",
        aiCompetencyName: "NLc - Các kĩ thuật và ứng dụng AI",
        aiTopic: "C3",
        aiStudentBehavior: "Học sinh sử dụng mô hình AI chuyên ngành để phân tích sơ bộ dữ liệu không gian, thống kê hoặc tình huống thực tế.",
        aiYccd: "Sử dụng thành thạo các mô hình AI chuyên ngành để phân tích dữ liệu chuyên sâu và giải quyết bài toán môn học.",
        aiProduct: "Kết quả truy vấn và phân tích dữ liệu từ AI chuyên ngành.",
        aiCriteria: "Khai thác hiệu quả công cụ AI, đối chiếu dữ liệu gốc.",
        aiEvidence: "Lịch sử truy vấn và bản ghi số liệu.",
        yccdEvidence: "YCCĐ chuyên sâu môn học lớp 12.",
        integrationLevel: "Mức vừa",
        devicePlan: "Phương án B: Thiết bị dùng chung / máy chiếu",
        reason: "Ứng dụng AI chuyên sâu trong học tập lớp 12.",
        action: "HS truy vấn mô hình AI chuyên ngành."
      },
      {
        activityName: "Hoạt động 2: Hình thành kiến thức mới",
        targetSection: "Thực hiện nhiệm vụ",
        targetContent: "Nghiên cứu chuyên sâu, đánh giá an toàn và phản biện",
        integrationDecision: "NLS và NL AI",
        suggestedNLS: "1.2.NCa",
        nlsCompetencyName: "Đánh giá dữ liệu, thông tin và nội dung số",
        nlsStudentBehavior: "Học sinh nhận diện nguy cơ tin giả, deepfake, xác thực nguồn tin đa kênh và bảo vệ chủ quyền dữ liệu số.",
        nlsProduct: "Báo cáo xác thực nguồn tin và đánh giá an toàn thông tin.",
        nlsCriteria: "Xác minh chuẩn xác, tuân thủ pháp luật và an toàn thông tin.",
        suggestedAI: "NLb-12.B2.1",
        aiCompetencyName: "NLb - Đạo đức AI, an toàn, pháp luật và trách nhiệm",
        aiTopic: "B2",
        aiStudentBehavior: "Học sinh nhận diện các nguy cơ deepfake, tin giả do AI tạo ra; thực hiện các biện pháp xác thực nguồn tin đa kênh.",
        aiYccd: "Nhận diện được nguy cơ deepfake, tin giả; thực hiện biện pháp xác thực nguồn tin đa kênh và bảo vệ dữ liệu.",
        aiProduct: "Bảng đối chiếu kiểm chứng tính xác thực đa nguồn.",
        aiCriteria: "Chỉ rõ rủi ro sai lệch, phương pháp xác thực đáng tin cậy.",
        aiEvidence: "Bản thẩm định nguồn tin của học sinh.",
        yccdEvidence: "Phát triển tư duy đạo đức, an toàn và trách nhiệm số.",
        integrationLevel: "Mức vừa",
        devicePlan: "Phương án B: Máy chiếu / thảo luận nhóm",
        reason: "Nâng cao nhận thức đạo đức, pháp lý và bảo vệ chủ quyền thông tin.",
        action: "HS kiểm định tính an toàn và xác thực của thông tin AI."
      },
      {
        activityName: "Hoạt động 4: Vận dụng",
        targetSection: "Nội dung",
        targetContent: "Thực hiện dự án nghiên cứu học tập thực tế",
        integrationDecision: "NLS và NL AI",
        suggestedNLS: "3.1.NCa",
        nlsCompetencyName: "Phát triển nội dung số",
        nlsStudentBehavior: "Học sinh xây dựng và hoàn thiện sản phẩm báo cáo/dự án học tập hoàn chỉnh có ứng dụng AI.",
        nlsProduct: "Báo cáo dự án học tập hoàn chỉnh kèm phần giải trình sử dụng AI.",
        nlsCriteria: "Sản phẩm chất lượng cao, minh bạch đạo đức AI và có tính ứng dụng thực tiễn.",
        suggestedAI: "NLd-12.D1.1",
        aiCompetencyName: "NLd - Thiết kế, thử nghiệm và cải tiến hệ thống AI",
        aiTopic: "D1",
        aiStudentBehavior: "Học sinh xây dựng và thực hiện một dự án học tập hoàn chỉnh có ứng dụng AI từ thu thập, phân tích đến báo cáo kết quả.",
        aiYccd: "Xây dựng và thực hiện một dự án học tập hoàn chỉnh có ứng dụng AI từ thu thập dữ liệu đến báo cáo kết quả.",
        aiProduct: "Hồ sơ dự án học tập hoàn chỉnh có sự hỗ trợ của AI.",
        aiCriteria: "Đầy đủ các bước quy trình, minh bạch đóng góp của AI và học sinh.",
        aiEvidence: "Báo cáo tổng kết dự án và sản phẩm số.",
        yccdEvidence: "Vận dụng kiến thức chuyên sâu vào giải quyết vấn đề thực tiễn.",
        integrationLevel: "Mức sâu",
        devicePlan: "Phương án A/B: Thực hiện tại nhà hoặc phòng bộ môn",
        reason: "Hoàn thiện năng lực thiết kế dự án học tập tích hợp AI cấp THPT.",
        action: "HS hoàn thành dự án học tập vận dụng."
      }
    ]
  };

  if (rawSuggestions.length === 0) {
    const g = ["10", "11", "12"].includes(grade) ? grade : "10";
    rawSuggestions = defaultTasksByGrade[g] || defaultTasksByGrade["10"];
  }

  const sanitizedSuggestions = rawSuggestions.slice(0, 6).map((suggestion: any, index: number) => {
    let requestedIntegrationDecision = normalizeIntegrationDecision(suggestion);
    let sanitizedNls = sanitizeNlsCodeForGrade(suggestion?.suggestedNLS, grade, authorizedNlsCodes);
    let rawAiCode = String(suggestion?.suggestedAI || "").trim();
    let sanitizedAi = sanitizeAiCodeForGrade(rawAiCode, grade, suggestion?.aiCompetencyName || suggestion?.aiComponentName);

    const g = ["10", "11", "12"].includes(grade) ? grade : "10";
    if (sanitizedNls.code === "Không gán mã" || !sanitizedNls.code) {
      const fallbackNls = index === 0 ? "1.1.NCa" : index === 1 ? "1.2.NCa" : "3.1.NCa";
      sanitizedNls = { code: fallbackNls, verifiedFromSource: true };
    }
    if (sanitizedAi.code === "Không gán mã" || !sanitizedAi.code) {
      const fallbackAi = index === 0
        ? `NLc-${g}.C3.1`
        : index === 1
          ? (g === "12" ? `NLb-12.B2.1` : `NLa-${g}.A3.1`)
          : (g === "12" ? `NLd-12.D1.1` : `NLd-${g}.D1.1`);
      sanitizedAi = { code: fallbackAi };
    }

    const hasValidNlsCode = sanitizedNls.code !== "Không gán mã";
    const hasValidAiCode = sanitizedAi.code !== "Không gán mã";
    const integrationDecision = resolveVerifiedIntegrationDecision(
      requestedIntegrationDecision,
      hasValidNlsCode,
      hasValidAiCode,
    );
    const usesNls = integrationUsesNls(integrationDecision) || true;
    const usesAi = integrationUsesAi(integrationDecision) || true;
    const finalAiCode = sanitizedAi.code && sanitizedAi.code !== "Không gán mã" ? sanitizedAi.code : `NLc-${g}.C3.1`;
    const aiReferenceFields = getAiReferenceFields(finalAiCode, grade, suggestion?.aiTopic);
    const aiCompetencyName = normalizeAiCompetencyComponentName(
      suggestion?.aiCompetencyName || suggestion?.aiComponentName,
      finalAiCode,
    );
    const finalNlsCode = sanitizedNls.code && sanitizedNls.code !== "Không gán mã" ? sanitizedNls.code : "1.1.NCa";
    const aiSanitizerNote = usesAi ? sanitizedAi.note : undefined;
    const knownNlsIndicator = getKnownNlsIndicator(finalNlsCode) || getNlsIndicatorByCode(finalNlsCode);
    const yccdEvidence = suggestion?.yccdEvidence || suggestion?.aiYccd || suggestion?.reason || "Chưa có căn cứ YCCĐ riêng trong phản hồi AI.";
    const defaultAction = usesAi
      ? "Học sinh thực hiện nhiệm vụ học tập có sử dụng AI dưới sự hướng dẫn của giáo viên."
      : "Học sinh thực hiện thao tác số và tạo sản phẩm số đáp ứng YCCĐ môn học.";
    const action = suggestion?.action || (usesAi ? suggestion?.aiStudentBehavior : suggestion?.nlsStudentBehavior) || defaultAction;
    return {
      ...suggestion,
      integrationDecision: usesNls && usesAi ? "NLS và NL AI" : usesNls ? "Chỉ NLS" : "Chỉ NL AI",
      suggestedNLS: finalNlsCode,
      nlsCodeVerified: true,
      nlsCompetencyName: (knownNlsIndicator as any)?.competencyName || (knownNlsIndicator as any)?.componentName || "Khai thác và ứng dụng công nghệ số",
      nlsIndicatorDescription: (knownNlsIndicator as any)?.indicatorText || (knownNlsIndicator as any)?.description || "Hành vi năng lực số mức Nâng cao cho THPT",
      nlsStudentBehavior: suggestion?.nlsStudentBehavior || action,
      nlsProduct: suggestion?.nlsProduct || suggestion?.product || "Sản phẩm số hoặc bằng chứng thao tác của học sinh.",
      nlsCriteria: suggestion?.nlsCriteria || suggestion?.criteria || "Hoàn thành đúng thao tác số, sản phẩm đáp ứng YCCĐ và có thể quan sát/đánh giá.",
      integrationLevel: suggestion?.integrationLevel || "Mức vừa",
      devicePlan: suggestion?.devicePlan || "Phương án B/C; có phiếu hoặc ảnh chụp màn hình thay thế khi thiếu Internet.",
      yccdEvidence,
      suggestedAI: finalAiCode,
      aiCompetencyName: aiCompetencyName || "NLc - Các kĩ thuật và ứng dụng AI",
      aiGrade: usesAi ? aiReferenceFields.grade : g,
      aiTopic: usesAi ? aiReferenceFields.topic : "C3",
      aiIndicatorCode: usesAi ? (aiReferenceFields.indicatorCode || finalAiCode) : `NLc-${g}.C3.1`,
      aiStudentBehavior: suggestion?.aiStudentBehavior || action,
      aiYccd: suggestion?.aiYccd || yccdEvidence,
      aiProduct: suggestion?.aiProduct || suggestion?.product || "Sản phẩm học tập có sử dụng AI và được học sinh chỉnh sửa/kiểm chứng.",
      aiCriteria: suggestion?.aiCriteria || suggestion?.criteria || "Đúng kiến thức môn học; dùng AI đúng mục đích; biết kiểm chứng nguồn và giải thích cách điều chỉnh kết quả AI.",
      aiEvidence: suggestion?.aiEvidence || suggestion?.evidence || "Prompt đã dùng, nguồn kiểm chứng, bản chỉnh sửa của học sinh và sản phẩm cuối.",
      action,
      reason: appendSanitizerNote(
        appendSanitizerNote(suggestion?.reason, usesNls ? sanitizedNls.note : undefined),
        aiSanitizerNote,
      ),
      geoDataRequirement: buildGeoDataRequirement({ ...analysis, grade }, suggestion, sourceText),
    };
  });

  return {
    ...analysis,
    grade,
    aiSuggestions: sanitizedSuggestions,
  };
};
const normalizeCurriculumCompetencyData = (items: any[] = [], grade?: string) =>
  items.map((item) => {
    const safeCode = getSafeAiIndicatorCode(item.indicatorCode, grade);
    return {
      ...item,
      indicatorCode: safeCode,
      indicatorNote: safeCode
        ? "Mã AI đúng định dạng/lớp/chủ đề; vẫn phải đối chiếu nguyên văn YCCĐ trước khi dùng."
        : item.indicatorCode
          ? `Bỏ qua mã tạm/không hợp lệ "${item.indicatorCode}". Chỉ gán lại khi YCCĐ có điểm chạm rõ.`
          : undefined,
    };
  });

const formatSelectedIndicatorsForPrompt = (
  indicators: { code: string; description: string }[] | undefined,
  grade?: string,
) => {
  if (!indicators?.length) return "";
  const expectedNlsLevel = getExpectedNlsLevel(grade);
  const reviewedLines = indicators.map((indicator) => {
    const rawCode = String(indicator.code || "").trim();
    if (/^NL[abcd]$/i.test(rawCode)) {
      return `- Tham chiếu AI ${rawCode}: ${indicator.description}. Chưa có mã chi tiết; phải đối chiếu đúng lớp và nguyên văn YCCĐ.`;
    }
    if (AI_CODE_PATTERN.test(rawCode)) {
      const sanitized = sanitizeAiCodeForGrade(rawCode, grade);
      return sanitized.code === "Không gán mã"
        ? `- Bỏ mã AI ${rawCode}: ${sanitized.note}`
        : `- Mã AI đầu vào ${sanitized.code}: ${indicator.description}. Chỉ dùng khi bảng đối chiếu chính thức xác nhận đúng YCCĐ.`;
    }
    if (/^\d{1,2}\.[ABCD]\d+\.(?:MR\d+|\d+)$/i.test(rawCode)) {
      return `- Bỏ mã AI ${rawCode}: thiếu tiền tố thành phần NLa/NLb/NLc/NLd; không tự suy đoán tiền tố.`;
    }
    const sanitized = sanitizeNlsCodeForGrade(rawCode, grade);
    return sanitized.code === "Không gán mã"
      ? `- Bỏ mã NLS ${rawCode}: ${sanitized.note}`
      : `- Mã NLS ${sanitized.code}: ${indicator.description}`;
  });
  return `
LỆNH RÀ SOÁT MÃ NLS/NL AI ĐÃ CHỌN:
${reviewedLines.join("\n")}
- Mức NLS tham chiếu của lớp này: ${expectedNlsLevel || "chưa xác định"}.
- Chỉ sử dụng mục có chuỗi YCCĐ -> hành vi học sinh -> sản phẩm -> tiêu chí; mã không khớp phải ghi “Không gán mã”, không tự sửa.
`;
};
const getCompetencyGuardrails = (subject: string, grade?: string, yccd?: string) => {
  const currentGrade = extractGradeNumber(grade);
  const allowedThemes = AI_THEMES_BY_THPT_GRADE[currentGrade];
  const expectedNlsLevel = getExpectedNlsLevel(grade);
  const gradeRule = expectedNlsLevel
    ? `- Lớp ${currentGrade}: mức NLS tham chiếu ${expectedNlsLevel}; mã NL AI phải đúng lớp ${currentGrade}. ${allowedThemes ? `Chỉ chọn chủ đề phù hợp YCCĐ trong các chủ đề: ${allowedThemes.join(", ")}.` : "Khi có điểm chạm AI rõ, phải xác định thành phần, chủ đề và sinh mã đầy đủ theo YCCĐ/hành vi học sinh; nếu không có điểm chạm thì không tích hợp NL AI."}`
    : `- Chưa xác định được lớp/mức NLS từ đầu vào: chỉ mô tả biểu hiện và ghi “Cần đối chiếu mã”, không tự gán mức hoặc mã.`;
  const subjectRule = getSubjectCompetencyRule(subject);
  return `
${LOCKED_NLS_AI_INTEGRATION_RULES}
${AI_COMPETENCY_ORDER_RULE}
RÀ SOÁT THEO LỚP VÀ MÔN ĐANG XỬ LÍ:
${gradeRule}
- Không coi mã tạm kiểu “10.A1.a” là mã AI hợp lệ; không trộn mã NLS với tham chiếu AI.
${subjectRule}
${yccd ? `YCCĐ đầu vào cần bám sát:\n${yccd}` : ""}
`;
};
const SOCIAL_INTEGRATION_GUIDELINES = `
Dưới đây là nhóm NỘI DUNG LỒNG GHÉP XÃ HỘI RIÊNG BIỆT để dùng khi giáo viên chọn; đây không phải yêu cầu của TT 02/2025 (TT 02 là Khung năng lực số cho người học):

LƯU Ý QUAN TRỌNG: Thông tư 02/2025/TT-BGDĐT quy định về Khung Năng lực số cho người học, còn các nội dung dưới đây là nhóm giáo dục tích hợp xã hội được giáo viên chọn thêm trong kế hoạch bài dạy.

1. Giáo dục Di sản văn hóa:
   - Mục tiêu: Bảo tồn, phát huy giá trị di sản văn hóa dân tộc và địa phương.
   - Nội dung: Khai thác tư liệu di sản, địa danh, nhân vật, lễ hội, phong tục, nghệ thuật và bảo tàng/số hóa di sản.

2. Phòng chống Ma túy & Thuốc lá:
   - Mục tiêu: Nâng cao nhận thức, hình thành kỹ năng phòng tránh hành vi nguy cơ.
   - Nội dung: Phân tích tác hại, tình huống từ chối, truyền thông học đường và trách nhiệm với sức khỏe cộng đồng.

3. Dân số & Phát triển bền vững:
   - Mục tiêu: Nhận thức mối quan hệ giữa dân số, chất lượng cuộc sống, bình đẳng giới và phát triển bền vững.
   - Nội dung: Phân tích dữ liệu dân cư, tác động của quy mô dân số đến chất lượng cuộc sống và an sinh xã hội.

4. Giáo dục Hòa nhập (Inclusive Education):
   - Căn cứ: Thông tư 03/2018/TT-BGDĐT về Giáo dục Hòa nhập.
   - Mục tiêu: Đảm bảo quyền được học tập của mọi học sinh, bao gồm học sinh khuyết tật hoặc có hoàn cảnh đặc biệt.
   - Nội dung: Thiết kế hoạt động linh hoạt, đa dạng hóa phương thức tiếp cận để mọi học sinh đều có thể tham gia.

5. Giáo dục phòng, chống tham nhũng:
   - Mục tiêu: Hình thành thái độ liêm chính, minh bạch, trách nhiệm và tôn trọng lợi ích chung.
   - Nội dung: Nhận diện hành vi thiếu trung thực, xung đột lợi ích và lựa chọn cách ứng xử phù hợp lứa tuổi trong các tình huống có liên hệ tự nhiên với YCCĐ.
`;

const CURRICULUM_DATA_GDDP = `
DỮ LIỆU BÀI HỌC GIÁO DỤC ĐỊA PHƯƠNG - THÀNH PHỐ HỒ CHÍ MINH:
- Lớp 10:
  * Chủ đề 1: Biến đổi khí hậu và phòng, chống thiên tai ở Thành phố Hồ Chí Minh (5 tiết)
  * Chủ đề 2: Đạo lí "Uống nước nhớ nguồn" qua các nghi lễ dân gian ở TP.HCM (5 tiết)
  * Chủ đề 3: Văn học dân gian Thành phố Hồ Chí Minh (6 tiết)
  * Chủ đề 4: Chân dung nhân vật nghệ thuật ở Thành phố Hồ Chí Minh (4 tiết)
  * Chủ đề 5: Ô nhiễm môi trường ở Thành phố Hồ Chí Minh (6 tiết)
  * Chủ đề 6: Định hướng nghề nghiệp (6 tiết)
- Lớp 11:
  * Chủ đề 1: Phát triển du lịch ở Thành phố Hồ Chí Minh
  * Chủ đề 2: Danh nhân lịch sử của Thành phố Hồ Chí Minh
  * Chủ đề 3: Văn học ở Thành phố Hồ Chí Minh trước năm 1975
  * Chủ đề 4: Âm nhạc trong đời sống hiện nay Thành phố Hồ Chí Minh
  * Chủ đề 5: Mĩ thuật bổ sung. Đặc trưng của một số công trình kiến trúc ở Thành phố Hồ Chí Minh
  * Chủ đề 6: Tác động của hoạt động kinh tế đến môi trường tự nhiên ở Thành phố Hồ Chí Minh
  * Chủ đề 7: Giáo dục STEM và định hướng nghề nghiệp trong kỉ nguyên mới
  * Chủ đề 8: Phong tục, luật tục và giáo dục pháp luật ở TP.HCM
- Lớp 12:
  * Chủ đề 1: Lao động, việc làm tại Thành phố Hồ Chí Minh
  * Chủ đề 2: Phát triển giao thông vận tải ở Thành phố Hồ Chí Minh
  * Chủ đề 3: Những thành tựu cơ bản và bài học kinh nghiệm trong công cuộc Đổi mới tại Thành phố Hồ Chí Minh (1991 - nay)
  * Chủ đề 4: Văn học ở Thành phố Hồ Chí Minh từ năm 1975
  * Chủ đề 5: Một số loại hình nghệ thuật ở Thành phố Hồ Chí Minh (Hát bội, Kịch nói, Đờn ca tài tử, Cải lương)
  * Chủ đề 6: Mĩ thuật ứng dụng hiện đại ở Thành phố Hồ Chí Minh (Đúc đồng, Điêu khắc đá, Tranh bích họa, Đồ gốm)
  * Chủ đề 7: Vai trò của lễ hội truyền thống tại Thành phố Hồ Chí Minh trong việc duy trì, phát huy các giá trị văn hóa dân tộc
  * Chủ đề 8: Ý tưởng khởi nghiệp cho học sinh tại Thành phố Hồ Chí Minh
`;

const CURRICULUM_DATA = `
DỮ LIỆU CHUẨN VỀ CHƯƠNG TRÌNH VÀ TÊN BÀI HỌC(THỰC HIỆN NGHIÊM TÚC):

LƯU Ý TỐI QUAN TRỌNG CHUNG MÔN ĐỊA LÍ (TẤT CẢ CÁC KHỐI LỚP): BẮT BUỘC tuân thủ tuyệt đối cấu trúc chương trình và tên bài học của BỘ SÁCH "KẾT NỐI TRI THỨC VỚI CUỘC SỐNG". TUYỆT ĐỐI KHÔNG DÙNG SÁCH CÁNH DIỀU HAY CHÂN TRỜI SÁNG TẠO.
1. GIÁO DỤC ĐỊA PHƯƠNG - THÀNH PHỐ HỒ CHÍ MINH:
- Lớp 10:
     * Chủ đề 1: Biến đổi khí hậu và phòng, chống thiên tai ở Thành phố Hồ Chí Minh(5 tiết)
  * Chủ đề 2: Đạo lí “Uống nước nhớ nguồn” qua các nghi lễ dân gian ở TP.HCM(5 tiết)
    * Chủ đề 3: Văn học dân gian Thành phố Hồ Chí Minh(6 tiết)
      * Chủ đề 4: Chân dung nhân vật nghệ thuật ở Thành phố Hồ Chí Minh(4 tiết)
        * Chủ đề 5: Ô nhiễm môi trường ở Thành phố Hồ Chí Minh(6 tiết)
          * Chủ đề 6: Định hướng nghề nghiệp(6 tiết)
            - Lớp 11:
     * Chủ đề 1: Phát triển du lịch ở Thành phố Hồ Chí Minh
  * Chủ đề 2: Danh nhân lịch sử của Thành phố Hồ Chí Minh
    * Chủ đề 3: Văn học ở Thành phố Hồ Chí Minh trước năm 1975
      * Chủ đề 4: Âm nhạc trong đời sống hiện nay Thành phố Hồ Chí Minh
        * Chủ đề 5: Mĩ thuật bổ sung.Đặc trưng của một số công trình kiến trúc ở Thành phố Hồ Chí Minh
          * Chủ đề 6: Tác động của hoạt động kinh tế đến môi trường tự nhiên ở Thành phố Hồ Chí Minh
            * Chủ đề 7: Giáo dục STEM và định hướng nghề nghiệp trong kỉ nguyên mới
              * Chủ đề 8: Phong tục, luật tục và giáo dục pháp luật ở Tp.Hồ Chí Minh
                - Lớp 12:
     * Chủ đề 1: Lao động, việc làm tại thành phố Hồ Chí Minh
  * Chủ đề 2: Phát triển giao thông vận tải ở Thành phố Hồ Chí Minh
    * Chủ đề 3: Những thành tựu cơ bản và bài học kinh nghiệm trong công cuộc Đổi mới tại Thành phố Hồ Chí Minh(1991 - nay)
      * Chủ đề 4: Văn học ở Thành phố Hồ Chí Minh từ năm 1975
        * Chủ đề 5: Một số loại hình nghệ thuật ở Thành phố Hồ Chí Minh(Hát bội, Kịch nói, Đờn ca tài tử, Cải lương)
          * Chủ đề 6: Mĩ thuật ứng dụng hiện đại ở Thành phố Hồ Chí Minh(Đúc đồng, Điêu khắc đá, Tranh bích họa, Đồ gốm)
            * Chủ đề 7: Vai trò của lễ hội truyền thống tại Thành phố Hồ Chí Minh trong việc duy trì, phát huy các giá trị văn hóa dân tộc
              * Chủ đề 8: Ý tưởng khởi nghiệp cho học sinh tại Thành phố Hồ Chí Minh

2. ĐỊA LÍ 10(Chương trình GDPT 2018):
   * Bài 1: Môn Địa lí với định hướng nghề nghiệp(1 tiết)
  * Bài 2: Sử dụng bản đồ(2 tiết)
    * Bài 3: Trái Đất.Thuyết kiến tạo mảng(2 tiết)
      * Bài 4: Hệ quả địa lí các chuyển động của Trái Đất(3 tiết)
        * Bài 5: Thạch quyển.Nội lực(3 tiết)
          * Bài 6: Ngoại lực(2 tiết)
            * Bài 7: Khí quyển.Nhiệt độ không khí(2 tiết)
              * Bài 8: Khí áp, gió và mưa(4 tiết)
                * Bài 9: Thực hành: Đọc bản đồ khí hậu(1 tiết)
                  * Bài 10: Thủy quyển.Nước trên lục địa(3 tiết)
                    * Bài 11: Nước biển và đại dương(2 tiết)
                      * Bài 12: Đất và sinh quyển(3 tiết)
                        * Bài 13: Thực hành: Phân tích phân bố đất và sinh vật(1 tiết)
                          * Bài 14: Vỏ địa lí.Quy luật thống nhất và hoàn chỉnh(1 tiết)
                            * Bài 15: Quy luật địa đới và phi địa đới(2 tiết)
                              * Bài 16: Dân số và gia tăng dân số(2 tiết)
                                * Bài 17: Phân bố dân cư và đô thị hóa(2 tiết)
                                  * Bài 18: Các nguồn lực phát triển kinh tế(1 tiết)
                                    * Bài 19: Cơ cấu nền kinh tế, GDP, GNI(2 tiết)
                                      * Bài 20: Vai trò, đặc điểm nông nghiệp... (1 tiết)
   * Bài 21: Địa lí các ngành nông nghiệp(4 tiết)
  * Bài 22: Tổ chức lãnh thổ nông nghiệp(1 tiết)
    * Bài 23: Vai trò, đặc điểm công nghiệp... (1 tiết)
   * Bài 24: Địa lí một số ngành công nghiệp(4 tiết)
  * Bài 25: Tổ chức lãnh thổ công nghiệp(1 tiết)
    * Bài 26: Vai trò, đặc điểm dịch vụ... (1 tiết)
   * Bài 27: Địa lí ngành GTVT và BCVT(4 tiết)
  * Bài 28: Thương mại, tài chính ngân hàng và du lịch(4 tiết)
    * Bài 29: Môi trường và tài nguyên thiên nhiên(1 tiết)
      * Bài 30: Phát triển bền vững và tăng trưởng xanh(1 tiết)

3. ĐỊA LÍ 11(Chương trình GDPT 2018):
   * Bài 1: Sự khác biệt về trình độ phát triển các nhóm nước(2 tiết)
  * Bài 2: Toàn cầu hóa, khu vực hóa kinh tế(2 tiết)
    * Bài 3: Một số tổ chức khu vực và quốc tế(1 tiết)
      * Bài 4: Thực hành: Tìm hiểu về toàn cầu hóa(1 tiết)
        * Bài 5: Một số vấn đề an ninh toàn cầu(1 tiết)
          * Bài 6: Thực hành: Viết báo cáo về nền kinh tế tri thức(1 tiết)
            * Bài 7: Vị trí, tự nhiên, dân cư, kinh tế Mỹ Latinh(5 tiết)
              * Bài 8: Thực hành: Viết báo cáo về kinh tế Brazil(1 tiết)
                * Bài 9: EU - Một liên kết kinh tế khu vực lớn(4 tiết)
                  * Bài 10: Thực hành: Viết báo cáo về công nghiệp Đức(1 tiết)
                    * Bài 11: Vị trí, tự nhiên, dân cư, kinh tế Đông Nam Á(4 tiết)
                      * Bài 12: Hiệp hội các quốc gia Đông Nam Á(ASEAN)(2 tiết)
                        * Bài 13: Thực hành: Tìm hiểu về du lịch và kinh tế đối ngoại ĐNA(1 tiết)
                          * Bài 14: Vị trí, tự nhiên, dân cư, kinh tế Tây Nam Á(5 tiết)
                            * Bài 15: Thực hành: Viết báo cáo về dầu mỏ Tây Nam Á(1 tiết)
                              * Bài 16: Vị trí, tự nhiên, dân cư Hoa Kỳ(3 tiết)
                                * Bài 17: Kinh tế Hoa Kỳ(2 tiết)
                                  * Bài 18: Thực hành: Tìm hiểu hoạt động XNK của Hoa Kỳ(1 tiết)
                                    * Bài 19: Vị trí, tự nhiên, dân cư Liên bang Nga(2 tiết)
                                      * Bài 20: Kinh tế Liên bang Nga(3 tiết)
                                        * Bài 21: Thực hành: Tìm hiểu tình hình kinh tế LB Nga(1 tiết)
                                          * Bài 22: Vị trí, tự nhiên, dân cư, kinh tế Nhật Bản(4 tiết)
                                            * Bài 23: Thực hành: Tìm hiểu về hoạt động kinh tế đối ngoại Nhật Bản(1 tiết)
                                              * Bài 24: Vị trí, tự nhiên, dân cư, kinh tế Trung Quốc(4 tiết)
                                                * Bài 25: Thực hành: Tìm hiểu về nông nghiệp Trung Quốc(1 tiết)
                                                  * Bài 26: Vị trí, tự nhiên, dân cư, kinh tế Australia(3 tiết)
                                                    * Bài 27: Thực hành: Tìm hiểu về sự thay đổi của kinh tế Australia(1 tiết)
                                                      * Bài 28: Vị trí, tự nhiên, dân cư, kinh tế Cộng hòa Nam Phi(3 tiết)
                                                        * Bài 29: Thực hành: Tìm hiểu về sản xuất cây công nghiệp cà phê(1 tiết)

4. ĐỊA LÍ 12(Chương trình GDPT 2018 - BÁM SÁT TÀI LIỆU):
   * Bài 1. Vị trí địa lí và phạm vi lãnh thổ(2 tiết)
  * Bài 2. Thiên nhiên nhiệt đới ẩm gió mùa và ảnh hưởng đến sản xuất, đời sống(3 tiết)
    * Bài 3. Sự phân hoá đa dạng của thiên nhiên(4 tiết)
      * Bài 4. Thực hành: Trình bày báo cáo về sự phân hoá tự nhiên Việt Nam(1 tiết)
        * Bài 5. Vấn đề sử dụng hợp lí tài nguyên thiên nhiên và bảo vệ môi trường(4 tiết)
          * Bài 6. Dân số, lao động và việc làm(4 tiết)
            * Bài 7. Đô thị hoá(1 tiết)
              * Ôn tập Giữa kì I(1 tiết)
                * Kiểm tra Giữa kì I(1 tiết)
                  * Bài 8. Thực hành: Viết báo cáo về dân số, lao động và việc làm, đô thị hoá(1 tiết)
                    * Bài 9. Chuyển dịch cơ cấu kinh tế(2 tiết)
                      * Bài 10. Vấn đề phát triển nông nghiệp, lâm nghiệp và thuỷ sản(5 tiết)
                        * Bài 11. Một số hình thức tổ chức lãnh thổ nông nghiệp(1 tiết)
                          * Bài 12. Thực hành: Vẽ biểu đồ, nhận xét và giải thích về tình hình phát triển và sự chuyển dịch cơ cấu của ngành nông nghiệp, lâm nghiệp và thuỷ sản(1 tiết)
                            * Bài 13. Vấn đề phát triển công nghiệp(3 tiết)
                              * Ôn tập Cuối kì I(1 tiết)
                                * Kiểm tra Cuối kì I(1 tiết)
                                  * Bài 14. Một số hình thức tổ chức lãnh thổ công nghiệp(1 tiết)
                                    * Bài 15. Thực hành: Vẽ biểu đồ, nhận xét và giải thích tình hình phát triển các ngành công nghiệp ở nước ta(1 tiết)
                                      * Bài 16. Giao thông vận tải và bưu chính viễn thông(3 tiết)
                                        * Bài 17. Thương mại và du lịch(2 tiết)
                                          * Bài 18. Thực hành: Tìm hiểu thực tế về một số hoạt động và sản phẩm dịch vụ của địa phương(1 tiết)
                                            * Bài 19. Khai thác thế mạnh ở Trung du và miền núi phía Bắc(2 tiết)
                                              * Bài 20. Phát triển kinh tế - xã hội ở Đồng bằng sông Hồng(3 tiết)
                                                * Bài 21. Phát triển kinh tế - xã hội ở Bắc Trung Bộ(2 tiết)
                                                  * Ôn tập Giữa kì II(1 tiết)
                                                    * Kiểm tra Giữa kì II(1 tiết)
                                                      * Bài 22 + 23. Phát triển kinh tế - xã hội ở Nam Trung Bộ(5 tiết)
                                                        * Bài 24. Phát triển kinh tế - xã hội ở Đông Nam Bộ(2 tiết)
                                                          * Bài 25. Sử dụng hợp lí tự nhiên để phát triển kinh tế ở Đồng bằng sông Cửu Long(2 tiết)
                                                            * Bài 26. Thực hành: Tìm hiểu ảnh hưởng của biến đổi khí hậu đối với Đồng bằng sông Cửu Long và các giải pháp ứng phó(1 tiết)
                                                              * Bài 28. Phát triển kinh tế và đảm bảo an ninh quốc phòng ở Biển Đông và các đảo, quần đảo(2 tiết)
                                                                * Bài 29. Thực hành: Viết và trình bày báo cáo tuyên truyền về bảo vệ chủ quyền biển đảo của Việt Nam(1 tiết)
                                                                  * Bài 30. Thực hành: Tìm hiểu địa lí địa phương(2 tiết)
                                                                    * Ôn tập Cuối kì II(1 tiết)
                                                                      * Kiểm tra Cuối kì II(1 tiết)
                                                                        * Chuyên đề 1: Thiên tai và biện pháp phòng chống(10 tiết)
                                                                          * Chuyên đề 2: Phát triển vùng(15 tiết)
                                                                            * Chuyên đề 3: Phát triển làng nghề(10 tiết)
                                                                              `;

const FORMATTING_INSTRUCTIONS = `
YÊU CẦU ĐỊNH DẠNG VÀ TRÌNH BÀY (THỰC THI NGHIÊM NGẶT):
1. Đối với Công thức (Toán, Vật lí, Hóa học, Sinh học):
- Khi có công thức, BẮT BUỘC ghi thành dòng riêng theo mẫu: [Công thức: biểu thức]. Ví dụ: [Công thức: S = a × b], [Công thức: x^2 + y^2 = r^2], [Công thức: d = S / t].
- Không để công thức trộn lẫn trong câu dài. Mỗi công thức phải có tên/ý nghĩa ngay trước hoặc ngay sau dòng [Công thức: ...].
- Có thể dùng ký hiệu ^ cho số mũ, _ cho chỉ số, / cho phân số đơn, √(...) cho căn bậc hai. Không dùng cú pháp LaTeX thô như \\frac, \\sqrt, $...$ trong đầu ra cuối cùng.
- Phương trình hóa học: ghi ký hiệu nguyên tố và chỉ số theo dạng dễ đọc trong [Công thức: ...] (VD: [Công thức: 2H2 + O2 → 2H2O]).
2. Đối với Hình vẽ, Biểu đồ và Bản đồ (MÔ TẢ CHI TIẾT ĐỂ HỆ THỐNG TỰ ĐỘNG BẢN VẼ):
- Khi cần vẽ hình vẽ, bản đồ, biểu đồ hay sơ đồ minh họa cho bài học hoặc hoạt động, bạn BẮT BUỘC phải viết kẹp trong các thẻ dưới đây:
  + Bản đồ địa lý: [Bản đồ: Tên tiêu đề nội dung bản đồ cần vẽ]
  + Biểu đồ / Đồ thị số liệu: [Biểu đồ: Tên tiêu đề nội dung biểu đồ/đồ thị]
  + Sơ đồ tư duy / Sơ đồ khối ý niệm: [Sơ đồ: Tên tiêu đề nội dung sơ đồ]
  + Mô hình / Hình vẽ kỹ thuật / Thiết bị thực nghiệm: [Hình vẽ: Tên tiêu đề nội dung hình vẽ/thiết bị]
- Không dùng kiểu định dạng nào khác ngoài 4 thẻ [Bản đồ: ...], [Biểu đồ: ...], [Sơ đồ: ...], [Hình vẽ: ...] để mô tả hình ảnh.
3. Đối với Bảng biểu:
- Sử dụng định dạng bảng chuẩn Markdown.
`;

const LESSON_PLAN_STRICT_GUIDELINES = `
# QUY TẮC THỰC THI "KỊCH BẢN CHI TIẾT"(CV 5512 + QĐ 2422)

1. BÁM SÁT HỌC LIỆU: Trích xuất 100% kiến thức từ tài liệu/đề bài cung cấp. Chỉ bổ sung NLS/NL AI tại điểm chạm đã chọn và mô phỏng trực quan thật sự cần thiết.
2. PHẦN III. TIẾN TRÌNH DẠY HỌC PHẢI ĐÚNG KHUNG CV 5512:
- BẮT BUỘC trả về đúng 4 phần tử trong mảng activities, đúng thứ tự và đúng nhóm tên:
  (1) Hoạt động 1. KHỞI ĐỘNG
  (2) Hoạt động 2. HÌNH THÀNH KIẾN THỨC MỚI
  (3) Hoạt động 3. LUYỆN TẬP
  (4) Hoạt động 4. VẬN DỤNG
- Có thể thêm tên sáng tạo sau dấu hai chấm, nhưng không được thay mất 4 tên chuẩn trên. Ví dụ: "Hoạt động 1. KHỞI ĐỘNG: Giải mã tình huống mở đầu".
- MỖI hoạt động BẮT BUỘC có đủ 4 mục: a) Mục tiêu; b) Nội dung; c) Sản phẩm; d) Tổ chức thực hiện.
- MỖI hoạt động PHẢI có thêm trường studentNotes: "Nội dung ghi bài của HS". Đây là phần kiến thức cốt lõi HS ghi vào vở sau khi GV chốt, không được bỏ trống hoặc thay bằng nhiệm vụ hoạt động.
- Nếu bài có nhiều tiết, mỗi hoạt động phải có periodLabel rõ ràng (ví dụ "Tiết 1", "Tiết 2", "Tiết 3-4") và nội dung/procedure phải chia mạch lạc theo tiết.
- Mục procedure trong MỖI hoạt động BẮT BUỘC có đúng 4 phần tử theo thứ tự:
  Bước 1: Chuyển giao nhiệm vụ
  Bước 2: Thực hiện nhiệm vụ
  Bước 3: Báo cáo, thảo luận
  Bước 4: Kết luận, nhận định

3. YÊU CẦU CHI TIẾT CHO 4 MỤC CỦA MỖI HOẠT ĐỘNG:
a) Mục tiêu: ghi rõ học sinh cần đạt gì về kiến thức, năng lực, phẩm chất/NLS/NL AI nếu có.
b) Nội dung: nêu nhiệm vụ cụ thể, học liệu cụ thể, câu hỏi cụ thể, dữ liệu/bảng/hình/công thức cần khai thác.
Nội dung ghi bài của HS (studentNotes): ghi thành các ý kiến thức cốt lõi, ngắn gọn, đúng SGK/tài liệu gốc; đây là phần HS chép vào vở, không phải một nhiệm vụ.
c) Sản phẩm: mô tả sản phẩm cụ thể, không ghi chung chung là "vở ghi"; phải nêu dạng sản phẩm, tiêu chí và bằng chứng học tập.
d) Tổ chức thực hiện: mô tả kịch bản GV-HS chi tiết trong đúng 4 bước:
  - Bước 1: Chuyển giao nhiệm vụ: GV giao nhiệm vụ/câu hỏi cụ thể, nêu học liệu, phiếu học tập/dữ liệu, cách chia nhóm.
  - Bước 2: Thực hiện nhiệm vụ: HS làm việc cá nhân/nhóm, xử lí dữ liệu, đọc bản đồ/bảng/công thức/hình; GV quan sát, hỗ trợ bằng câu hỏi gợi mở.
  - Bước 3: Báo cáo, thảo luận: HS trình bày, nhóm khác nhận xét/phản biện theo tiêu chí; nêu cách GV điều phối.
  - Bước 4: Kết luận, nhận định: GV chuẩn hóa kiến thức bằng ý chính rõ ràng; phần chốt bắt buộc bọc trong <bold>...</bold>.

🚨 ĐẶC BIỆT: TÍCH HỢP NLS/NL AI CHỈ ĐÁNH DẤU BẰNG MÀU ĐỎ
Nếu hoạt động có tích hợp NLS hoặc NL AI, KHÔNG tạo bảng riêng, KHÔNG tạo hoạt động "Giáo dục AI" tách khỏi giáo án gốc. Chỉ bổ sung/hiệu chỉnh đúng vị trí được đề cập trong hoạt động đã có.
Toàn bộ cụm nội dung tích hợp NLS/NL AI phải bọc trong thẻ <ai>...</ai> để giao diện và DOCX hiển thị màu đỏ; phần không tích hợp giữ màu chữ thường.
Trước khi nêu mã chỉ báo năng lực AI, bắt buộc ghi tên thành phần năng lực AI. Khi hoạt động có NL AI, phải mã hóa cụ thể đúng lớp/chủ đề/YCCĐ theo mẫu NLa-12.A1.1; nếu không đủ điểm chạm thì không tích hợp, không thay bằng mô tả chung chung.
Trong hoạt động có NL AI, mô tả công cụ, prompt, cách kiểm chứng và sản phẩm ngay tại bước tương ứng. Hoạt động Chỉ NLS chỉ mô tả thao tác số, sản phẩm và tiêu chí NLS; không thêm prompt AI.
`;

const PRIMARY_LESSON_PLAN_GUIDELINES = `
# QUY TẮC KẾ HOẠCH BÀI DẠY TIỂU HỌC (CV 2345/BGDĐT-GDTH)
1. Trình bày đúng kế hoạch bài dạy tiểu học: yêu cầu cần đạt; đồ dùng dạy học; các hoạt động dạy học chủ yếu; điều chỉnh sau bài dạy khi cần. Không ghi nhãn “chuẩn CV 5512”.
2. Tổ chức tiến trình theo mạch phù hợp bài học như mở đầu, hình thành kiến thức/kĩ năng, luyện tập/thực hành, vận dụng/trải nghiệm; được kết hợp hoặc tách nhiệm vụ theo môn và số tiết, không ép đủ đúng bốn hoạt động nếu YCCĐ không cần.
3. Mỗi hoạt động nêu ngắn gọn mục tiêu, nội dung, sản phẩm và cách tổ chức; phân biệt rõ việc của giáo viên và học sinh. Không ép mỗi hoạt động thành bốn bước CV 5512.
4. NLS/NL AI chỉ xuất hiện tại hoạt động có hành vi học sinh và sản phẩm phù hợp. Hoạt động Chỉ NLS không thêm prompt/chatbot; hoạt động có NL AI phải phù hợp lứa tuổi, có kiểm chứng và phương án không Internet.
5. Mã NLS lấy đúng bảng mã và mức lớp. Với NL AI, khi YCCĐ có điểm chạm phải gắn mã đầy đủ đúng lớp/chủ đề theo mẫu NLa-12.A1.1; nếu không đủ căn cứ thì không tích hợp.
6. Nội dung tích hợp cô đọng, bọc <ai>...</ai> đúng phần bổ sung; không tạo hoạt động AI riêng và không lặp lý thuyết pháp lí trong tiến trình.
`;

const UPGRADE_IN_PLACE_GUIDELINES = `
# QUY TẮC NÂNG CẤP TẠI CHỖ — KHÔNG TÁI CẤU TRÚC GIÁO ÁN GỐC
1. Nhận diện và giữ nguyên khung đang có: CV 2345 đối với tiểu học, CV 5512 đối với THCS/THPT hoặc mẫu riêng hợp lệ của đơn vị. Không ép giáo án gốc thành đúng 4 hoạt động, không đổi tên/số thứ tự và không gộp các hoạt động.
2. Chỉ bổ sung tại hoạt động có trong danh sách điểm chạm đã duyệt. Hoạt động nào tích hợp thì nội dung NLS/NL AI nằm ngay trong mục tiêu, nội dung, sản phẩm và bước tổ chức tương ứng của hoạt động đó; không tạo phần hướng dẫn tích hợp chung.
3. Tuân thủ integrationDecision của từng hoạt động: Chỉ NLS thì không thêm chatbot, prompt hoặc mã NL AI; Chỉ NL AI thì không gán mã NLS; NLS và NL AI phải có hai hành vi/bằng chứng phân biệt.
4. Viết cô đọng: mục tiêu tối đa 1 câu; nhiệm vụ tối đa 1 câu; sản phẩm tối đa 1 câu; mỗi bước tổ chức chỉ thêm 1 câu hành động quan sát được. Không chép lại lý thuyết TT 02, QĐ 2422 hoặc bảng mã vào tiến trình.
5. Chỉ giữ tích hợp khi có mã hợp lệ: NLS phải có trong bảng mã đã cài và đúng mức lớp; NL AI phải là mã đầy đủ đúng thành phần, lớp, chủ đề và chỉ báo. Nếu một năng lực thiếu mã hoặc mã không hợp lệ, hạ quyết định xuống năng lực còn lại có mã; nếu không còn năng lực hợp lệ thì loại gợi ý. Không chèn ghi chú “Cần đối chiếu mã” vào giáo án và không tự sửa một mã đầu vào sai.
6. Chỉ bọc <ai>...</ai> quanh phần chữ mới bổ sung. Nội dung gốc và hoạt động không tích hợp giữ nguyên.
`;

export interface LessonPlanInput {
  subject: string;
  grade: string;
  topic: string;
  duration: string;
  contextStudents?: string;
  contextSchool?: string;
  objectivesKnowledge?: string;
  objectivesCompetency?: string;
  objectivesQuality?: string;
  additionalNotes?: string;
  useLaTeX?: boolean;
  detailDrawings?: boolean;
  existingRawText?: string;
  existingPdfBase64?: string;
  aiIntegrationOptions?: any[];
  socialIntegrations?: string[];
  customSocialIntegration?: string;
  indicatorCode?: string;
  selectedNlsIndicators?: { code: string; description: string }[];
}

export const suggestNlsIndicators = async (
  topic: string,
  objectives: string,
  grade: string,
  config: { apiKey: string; aiModel: string }
) => {
  const ai = new GoogleGenAI({ apiKey: config.apiKey });
  const competencyGuardrails = getCompetencyGuardrails("môn học đang xét", grade, objectives);
  const prompt = `Bạn là chuyên gia rà soát cơ hội tích hợp NLS/NL AI trong kế hoạch bài dạy.
- Tên bài học: ${topic}
- Khối lớp: ${grade}
- Mục tiêu/Yêu cầu cần đạt: ${objectives}

${competencyGuardrails}

Nhiệm vụ:
- Rà toàn bộ YCCĐ nhưng chỉ trả về từ 0 đến 3 chỉ báo/tham chiếu phù hợp nhất; trả [] nếu không đủ điểm chạm.
- Mã NLS phải đúng mức lớp, có trong danh mục CB1–NC1 đã cài sẵn và có hành vi/sản phẩm rõ. Mã không tồn tại trong Bảng mã NLS phải loại bỏ, không tự suy diễn hoặc tạo mới.
- Với AI, nếu YCCĐ có điểm chạm rõ thì bắt buộc trả mã đầy đủ dạng NLa-${extractGradeNumber(grade)}.A1.1, đúng thành phần, lớp, chủ đề và số chỉ báo; không trả riêng NLa/NLb/NLc/NLd và không ghi “Cần đối chiếu mã AI”.
- Không đề xuất vì giáo viên dùng công cụ; học sinh phải là chủ thể thực hiện.

Trả về duy nhất JSON array, mỗi object gồm:
- "code": mã NLS đã kiểm tra hoặc mã NL AI đầy đủ như NLa-${extractGradeNumber(grade)}.A1.1.
- "rationale": dưới 35 từ, nêu YCCĐ, hành vi học sinh và bằng chứng.`;

  const result = await ai.models.generateContent({ model: config.aiModel, contents: prompt });
  const text = stripMarkdownJson(result.text ?? "");
  try {
    const parsed = JSON.parse(text) as { code: string; rationale: string }[];
    if (!Array.isArray(parsed)) return [];
    const cleaned = parsed.flatMap((item) => {
      const rawCode = String(item?.code || "").trim();
      if (AI_CODE_PATTERN.test(rawCode)) {
        const sanitized = sanitizeAiCodeForGrade(rawCode, grade);
        return sanitized.code === "Không gán mã"
          ? []
          : [{ code: sanitized.code, rationale: item.rationale || "Phù hợp YCCĐ AI và hành vi học sinh trong bài học." }];
      }
      const numericAiMatch = rawCode.match(/^(\d{1,2})\.([ABCD]\d+)\.(MR\d+|\d+)$/i);
      if (numericAiMatch) {
        const component = `NL${numericAiMatch[2][0].toLowerCase()}`;
        const sanitized = sanitizeAiCodeForGrade(`${component}- ${rawCode}`, grade, component);
        return sanitized.code === "Không gán mã"
          ? []
          : [{ code: sanitized.code, rationale: item.rationale || "Phù hợp YCCĐ AI và hành vi học sinh trong bài học." }];
      }
      const sanitized = sanitizeNlsCodeForGrade(rawCode, grade);
      if (sanitized.code === "Không gán mã") return [];
      return [{
        code: sanitized.code,
        rationale: item.rationale || "Phù hợp hành vi số và sản phẩm học tập trong YCCĐ.",
      }];
    });
    return cleaned.slice(0, 3);
  } catch (err) {
    console.error("Failed to parse suggested indicators JSON", text);
    throw new Error("Lỗi khi AI đề xuất chỉ báo.");
  }
};
export const analyzeExistingPlan = async (
  fileText: string,
  pdfBase64?: string,
  textbookImages?: { mimeType: string; data: string }[],
  pl1Data?: string
) => {
  const hasImages = textbookImages && textbookImages.length > 0;
  const detectedGrade = detectGradeFromText(fileText, pl1Data);
  const competencyGuardrails = getCompetencyGuardrails("môn học trong giáo án", detectedGrade);
  const detectedGradeInstruction = detectedGrade
    ? `\nLỚP ĐÃ PHÁT HIỆN TỪ GIÁO ÁN GỐC: ${detectedGrade}. Mọi mã NL AI phải đúng lớp ${detectedGrade}. Khi hoạt động có điểm chạm NL AI rõ, bắt buộc mã hóa cụ thể theo mẫu NLa-${detectedGrade}.A1.1; không được trả về “Cần đối chiếu mã AI”.`
    : `\nPhải trích xuất chính xác lớp trước khi mã hóa. Chỉ khi không thể xác định lớp hoặc YCCĐ mới được ghi “Cần đối chiếu mã”; không dùng trạng thái này để thay cho việc rà soát.`;

  // Build the textbook image section of the prompt
  const textbookSection = hasImages
    ? `\n\n--- TRANG SÁCH GIÁO KHOA MỚI (${textbookImages!.length} ảnh) ---\nBên cạnh giáo án cũ, hãy phân tích các ảnh chụp trang sách giáo khoa mới được đính kèm và:
A. Xác định các kiến thức/hoạt động/nội dung MỚI xuất hiện trong sách giáo khoa mà GIÁO ÁN CŨ CÒN THIẾU.
B. Đề xuất thêm những điểm cần bổ sung vào trường "newContentFromTextbook" (mảng chuỗi) trong JSON đầu ra.
C. Chỉ đề xuất nội dung xã hội (Di sản, Dân số, Phòng chống Ma túy/Thuốc lá) khi giáo viên đã chọn; không coi đây là yêu cầu của TT 02/2025.`
    : "";

  const pl1Section = pl1Data
    ? `\n\n--- LỆNH TỐI CẤP ĐỒNG BỘ TỪ KHTCM (PL1) ---\nDưới đây là Kế hoạch Tổ chuyên môn (PL1) được tải lên:
${pl1Data.substring(0, 5000)}

LỆNH BẮT BUỘC: Hãy đối chiếu Tên bài học của Giáo án với PL1 ở trên. Tìm ra chính xác dòng chứa bài học này trong PL1. Chỉ trích xuất mã NLS/NL AI từ PL1 nếu mã đó khớp đúng lớp của giáo án và có căn cứ YCCĐ. Nếu PL1 chứa mã sai lớp hoặc mã tạm, phải ghi "Không gán mã" và nêu lý do, không được bê nguyên mã sai.`
    : "";

  const jsonFormat = `{
  "subject": "Tên môn",
  "grade": "Khối lớp",
  "topic": "Tên bài",
  "duration": "Thời lượng",
  "contextStudents": "Đặc điểm học sinh",
  "contextSchool": "Điều kiện CSVC",
  "objectivesKnowledge": "Tóm tắt mục tiêu kiến thức",
  "objectivesCompetency": "Tóm tắt mục tiêu năng lực",
  "objectivesQuality": "Tóm tắt phẩm chất",
  "newContentFromTextbook": ["Nội dung mới từ SGK còn thiếu trong giáo án cũ (nếu có ảnh SGK)"],
  "socialSuggestions": [
    {
      "theme": "Tên chủ đề (Di sản / Dân số / Ma túy & Thuốc lá / Hòa nhập)",
      "activityName": "Hoạt động đề xuất lồng ghép",
      "content": "Nội dung cụ thể cần tích hợp vào bài học"
    }
  ],
  "aiSuggestions": [
    {
      "activityName": "Tên hoạt động gợi ý",
      "targetSection": "Mục con chính xác trong hoạt động: Nội dung / Thực hiện nhiệm vụ / Sản phẩm / Đánh giá",
      "targetContent": "Chép nguyên văn liên tục 8-25 từ từ đúng hoạt động trong giáo án gốc làm điểm neo chèn; giữ nguyên chữ và không diễn giải lại",
      "integrationDecision": "Chỉ NLS / Chỉ NL AI / NLS và NL AI",
      "suggestedNLS": "Mã NLS TT 02/CV 3456 đúng cấp/lớp; nếu không đủ căn cứ ghi 'Không gán mã - lý do: ...'",
      "nlsCompetencyName": "Tên năng lực thành phần NLS",
      "nlsStudentBehavior": "Hành vi số quan sát được của học sinh",
      "nlsProduct": "Sản phẩm/bằng chứng NLS",
      "nlsCriteria": "Tiêu chí đánh giá NLS",
      "suggestedAI": "Mã NL AI đầy đủ được mã hóa từ YCCĐ và hành vi học sinh theo đúng lớp, ví dụ 'NLa-12.A1.1'",
      "aiCompetencyName": "Tên thành phần năng lực AI trước khi ghi mã, ví dụ: NLa - Tư duy lấy con người làm trung tâm",
      "aiTopic": "Chủ đề AI đúng thành phần và khối lớp, ví dụ A1",
      "aiStudentBehavior": "Hành vi học sinh có thể quan sát được khi dùng AI",
      "aiYccd": "Yêu cầu cần đạt AI bám sát YCCĐ môn học",
      "aiProduct": "Sản phẩm học tập cần tạo ra",
      "aiCriteria": "Tiêu chí đánh giá sản phẩm/hành vi AI",
      "aiEvidence": "Minh chứng cần thu thập",
      "yccdEvidence": "YCCĐ/hoạt động học tập làm căn cứ để gán mã NLS/NL AI",
      "geoDataRequirement": {
        "dataTable": "Riêng môn Địa lí: yêu cầu bảng số liệu cụ thể hoặc bảng khung để HS điền từ nguồn chính thống",
        "sampleTableMarkdown": "Bảng Markdown có cột Đối tượng/Thời điểm, Chỉ tiêu, Giá trị, Nguồn kiểm chứng",
        "chart": "Thẻ biểu đồ bắt buộc theo mẫu [Biểu đồ: ...] nếu hoạt động có số liệu",
        "dataSource": "Nguồn số liệu kiểm chứng",
        "studentTask": "Nhiệm vụ HS xử lí bảng số liệu và biểu đồ"
      },
      "integrationLevel": "Mức nhẹ / Mức vừa / Mức sâu",
      "devicePlan": "Phương án A/B/C/D, có phương án ngoại tuyến",
      "reason": "Lý do phù hợp",
      "action": "HS thực hiện hành vi gì theo loại tích hợp đã chọn?"
    }
  ]
}`;

  let prompt: any;
  if (pdfBase64) {
    const textParts: any[] = [
      `Đóng vai trò chuyên gia giáo dục phân tích Kế hoạch bài dạy đính kèm dưới dạng PDF.
Hãy rà soát và cho tôi biết:
1. Thông tin chung của bài học (Môn, Lớp, Tên bài, Thời lượng, Đặc điểm học sinh, Điều kiện CSVC, Các mục tiêu hiện tại).
2. Các hoạt động cốt yếu trong giáo án (Mở đầu, Hình thành kiến thức, Luyện tập, Vận dụng).
3. Trọng tâm: Rà soát cơ hội NLS theo TT 02 và NL AI theo QĐ 2422. Chỉ đưa vào aiSuggestions tối đa 6 điểm chạm có giá trị sư phạm rõ; nếu không có trả []. Với bài nhiều tiết, số mã theo số hành vi/YCCĐ AI độc lập chứ không theo số tiết: cùng hành vi và minh chứng có thể dùng một mã; hành vi hoặc sản phẩm/tiêu chí khác nhau phải có gợi ý và mã riêng, kèm Tiết trong activityName/targetSection để chèn đúng vị trí. Với từng hoạt động, bắt buộc chọn đúng một integrationDecision: Chỉ NLS, Chỉ NL AI hoặc NLS và NL AI. Không ép tích hợp cả hai. Mỗi năng lực được chọn phải có chuỗi YCCĐ -> hành vi HS -> sản phẩm -> tiêu chí; trường của năng lực không được chọn ghi rõ Không tích hợp. NLS đúng mức lớp. Với hoạt động có NL AI, bắt buộc xác định thành phần, chủ đề và mã cụ thể dạng NLa-12.A1.1 theo đúng lớp/YCCĐ; không ghi chung chung “Cần đối chiếu mã AI”. Mỗi activityName chỉ xuất hiện một lần; nếu cùng hoạt động có cả hai năng lực, dùng “NLS và NL AI” trong một gợi ý. Vẫn trả đủ trường theo JSON để hệ thống hậu kiểm.${detectedGradeInstruction}${AI_COMPETENCY_ORDER_RULE}${textbookSection}${pl1Section}
4. RIÊNG MÔN ĐỊA LÍ: Nếu bài/hoạt động có bảng số liệu, biểu đồ, AQI, tài nguyên, dân số, kinh tế, khí hậu, diện tích, sản lượng, GRDP hoặc yêu cầu nhận xét - giải thích số liệu, trường geoDataRequirement BẮT BUỘC có bảng số liệu và biểu đồ. Không được chỉ ghi chung chung "phân tích dữ liệu"; phải nêu bảng, nguồn kiểm chứng, loại biểu đồ và nhiệm vụ HS.

${competencyGuardrails}

Định dạng đầu ra JSON bắt buộc:
${jsonFormat}`,
      { inlineData: { mimeType: "application/pdf", data: pdfBase64 } }
    ];
    // Append textbook images if provided
    if (hasImages) {
      textbookImages!.forEach(img => {
        textParts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
      });
    }
    prompt = textParts;
  } else {
    const textParts: any[] = [
      `Đóng vai trò chuyên gia giáo dục phân tích Kế hoạch bài dạy (Giáo án) của Giáo viên.
Dưới đây là nội dung văn bản bóc tách từ Giáo án của giáo viên.

Hãy rà soát và cho tôi biết:
1. Thông tin chung của bài học (Môn, Lớp, Tên bài, Thời lượng, Đặc điểm học sinh, Điều kiện CSVC, Các mục tiêu hiện tại).
2. Các hoạt động cốt yếu trong giáo án (Mở đầu, Hình thành kiến thức, Luyện tập, Vận dụng).
3. Trọng tâm: Rà soát cơ hội NLS theo TT 02 và NL AI theo QĐ 2422. Chỉ đưa vào aiSuggestions tối đa 6 điểm chạm có giá trị sư phạm rõ; nếu không có trả []. Với bài nhiều tiết, số mã theo số hành vi/YCCĐ AI độc lập chứ không theo số tiết: cùng hành vi và minh chứng có thể dùng một mã; hành vi hoặc sản phẩm/tiêu chí khác nhau phải có gợi ý và mã riêng, kèm Tiết trong activityName/targetSection để chèn đúng vị trí. Với từng hoạt động, bắt buộc chọn đúng một integrationDecision: Chỉ NLS, Chỉ NL AI hoặc NLS và NL AI. Không ép tích hợp cả hai. Mỗi năng lực được chọn phải có chuỗi YCCĐ -> hành vi HS -> sản phẩm -> tiêu chí; trường của năng lực không được chọn ghi rõ Không tích hợp. NLS đúng mức lớp. Với hoạt động có NL AI, bắt buộc xác định thành phần, chủ đề và mã cụ thể dạng NLa-12.A1.1 theo đúng lớp/YCCĐ; không ghi chung chung “Cần đối chiếu mã AI”. Mỗi activityName chỉ xuất hiện một lần; nếu cùng hoạt động có cả hai năng lực, dùng “NLS và NL AI” trong một gợi ý. Vẫn trả đủ trường theo JSON để hệ thống hậu kiểm.${detectedGradeInstruction}${AI_COMPETENCY_ORDER_RULE}${textbookSection}${pl1Section}
4. RIÊNG MÔN ĐỊA LÍ: Nếu bài/hoạt động có bảng số liệu, biểu đồ, AQI, tài nguyên, dân số, kinh tế, khí hậu, diện tích, sản lượng, GRDP hoặc yêu cầu nhận xét - giải thích số liệu, trường geoDataRequirement BẮT BUỘC có bảng số liệu và biểu đồ. Không được chỉ ghi chung chung "phân tích dữ liệu"; phải nêu bảng, nguồn kiểm chứng, loại biểu đồ và nhiệm vụ HS.

${competencyGuardrails}

VĂN BẢN GIÁO ÁN:
${fileText.substring(0, 60000)}

Định dạng đầu ra JSON bắt buộc:
${jsonFormat}`
    ];
    // Append textbook images if provided
    if (hasImages) {
      textbookImages!.forEach(img => {
        textParts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
      });
    }
    prompt = textParts.length === 1 ? textParts[0] : textParts;
  }

  try {
    const analysis = await callGeminiWithFallback(prompt, {
      type: Type.OBJECT,
      properties: {
        subject: { type: Type.STRING },
        grade: { type: Type.STRING },
        topic: { type: Type.STRING },
        duration: { type: Type.STRING },
        contextStudents: { type: Type.STRING },
        contextSchool: { type: Type.STRING },
        objectivesKnowledge: { type: Type.STRING },
        objectivesCompetency: { type: Type.STRING },
        objectivesQuality: { type: Type.STRING },
        newContentFromTextbook: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        },
        socialSuggestions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              theme: { type: Type.STRING },
              activityName: { type: Type.STRING },
              content: { type: Type.STRING }
            },
            required: ["theme", "activityName", "content"]
          }
        },
        aiSuggestions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              activityName: { type: Type.STRING },
              targetSection: { type: Type.STRING },
              targetContent: { type: Type.STRING },
              integrationDecision: { type: Type.STRING },
              suggestedNLS: { type: Type.STRING },
              nlsCompetencyName: { type: Type.STRING },
              nlsStudentBehavior: { type: Type.STRING },
              nlsProduct: { type: Type.STRING },
              nlsCriteria: { type: Type.STRING },
              suggestedAI: { type: Type.STRING, description: "Nếu integrationDecision có NL AI: bắt buộc là một mã đầy đủ dạng NLa-12.A1.1 đúng lớp/YCCĐ; không trả ghi chú hoặc Cần đối chiếu. Nếu không tích hợp: ghi Không tích hợp NL AI." },
              aiCompetencyName: { type: Type.STRING, description: "Tên đầy đủ của thành phần khớp mã: NLa/NLb/NLc/NLd và tên thành phần tương ứng." },
              aiTopic: { type: Type.STRING, description: "Chủ đề AI khớp thành phần và mã đầy đủ, ví dụ A1." },
              aiStudentBehavior: { type: Type.STRING },
              aiYccd: { type: Type.STRING },
              aiProduct: { type: Type.STRING },
              aiCriteria: { type: Type.STRING },
              aiEvidence: { type: Type.STRING },
              yccdEvidence: { type: Type.STRING },
              geoDataRequirement: {
                type: Type.OBJECT,
                properties: {
                  dataTable: { type: Type.STRING },
                  sampleTableMarkdown: { type: Type.STRING },
                  chart: { type: Type.STRING },
                  dataSource: { type: Type.STRING },
                  studentTask: { type: Type.STRING }
                }
              },
              integrationLevel: { type: Type.STRING },
              devicePlan: { type: Type.STRING },
              reason: { type: Type.STRING },
              action: { type: Type.STRING }
            },
            required: ["activityName", "targetSection", "targetContent", "integrationDecision", "suggestedNLS", "nlsCompetencyName", "nlsStudentBehavior", "nlsProduct", "nlsCriteria", "suggestedAI", "aiCompetencyName", "aiTopic", "aiStudentBehavior", "aiYccd", "aiProduct", "aiCriteria", "aiEvidence", "yccdEvidence", "integrationLevel", "devicePlan", "reason", "action"]
          }
        }
      },
      required: ["subject", "grade", "topic", "duration", "aiSuggestions"]
    });
    return sanitizeAnalysisResultCompetencies(analysis, detectedGrade, `${fileText}\n${pl1Data || ""}`);
  } catch (err) {
    console.error("Error analyzing plan:", err);
    throw err;
  }
};

export const generateDirectSnippets = async (
  subject: string,
  grade: string,
  topic: string,
  aiSuggestions: any[]
) => {
  const isEnglish = subject.toLowerCase().includes("tiếng anh") || subject.toLowerCase().includes("english");
  const primaryFramework = isPrimaryGrade(grade);
  const englishConstraint = isEnglish ? `LỆNH TỐI CẤP (NGÔN NGỮ): BẮT BUỘC SỬ DỤNG 100% TIẾNG ANH (ENGLISH) CHO TOÀN BỘ NỘI DUNG. KHÔNG ĐƯỢC CHỨA BẤT KỲ TỪ TIẾNG VIỆT NÀO.` : ``;
  const competencyGuardrails = getCompetencyGuardrails(subject, grade);
  const sanitizedSuggestions = (aiSuggestions || []).map((suggestion) => {
    const requestedIntegrationDecision = normalizeIntegrationDecision(suggestion);
    const authorizedNlsCodes = suggestion?.nlsCodeVerified ? collectAuthorizedNlsCodes(grade, suggestion?.suggestedNLS) : new Set<string>();
    const sanitizedNls = sanitizeNlsCodeForGrade(suggestion?.suggestedNLS, grade, authorizedNlsCodes);
    const sanitizedAi = sanitizeAiCodeForGrade(suggestion?.suggestedAI, grade, suggestion?.aiCompetencyName || suggestion?.aiComponentName);
    const hasValidNlsCode = sanitizedNls.code !== "Không gán mã";
    const hasValidAiCode = sanitizedAi.code !== "Không gán mã";
    const integrationDecision = resolveVerifiedIntegrationDecision(
      requestedIntegrationDecision,
      hasValidNlsCode,
      hasValidAiCode,
    );
    const usesNls = integrationUsesNls(integrationDecision);
    const usesAi = integrationUsesAi(integrationDecision);
    const finalNlsCode = usesNls ? sanitizedNls.code : "Không tích hợp NLS";
    const knownNlsIndicator = getKnownNlsIndicator(finalNlsCode);
    const finalAiCode = usesAi ? sanitizedAi.code : "Không tích hợp NL AI";
    const aiReferenceFields = getAiReferenceFields(finalAiCode, grade, suggestion?.aiTopic);
    const aiCompetencyName = normalizeAiCompetencyComponentName(
      suggestion?.aiCompetencyName || suggestion?.aiComponentName,
      finalAiCode,
    );
    const yccdEvidence = suggestion?.yccdEvidence || suggestion?.aiYccd || suggestion?.reason || "Chưa có căn cứ YCCĐ riêng trong phản hồi AI.";
    const defaultAction = usesAi
      ? "Học sinh thực hiện nhiệm vụ học tập có sử dụng AI dưới sự hướng dẫn của giáo viên."
      : "Học sinh thực hiện thao tác số và tạo sản phẩm số đáp ứng YCCĐ môn học.";
    const action = suggestion?.action || (usesAi ? suggestion?.aiStudentBehavior : suggestion?.nlsStudentBehavior) || defaultAction;
    return {
      ...suggestion,
      integrationDecision,
      suggestedNLS: finalNlsCode,
      nlsCompetencyName: usesNls ? knownNlsIndicator?.componentName || `Năng lực số theo chỉ báo ${finalNlsCode}` : "",
      nlsIndicatorDescription: usesNls ? knownNlsIndicator?.description || `Hành vi năng lực số theo chỉ báo ${finalNlsCode}` : "",
      suggestedAI: finalAiCode,
      aiCompetencyName: usesAi ? aiCompetencyName : "",
      aiGrade: usesAi ? aiReferenceFields.grade : "",
      aiTopic: usesAi ? aiReferenceFields.topic : "",
      aiIndicatorCode: usesAi ? aiReferenceFields.indicatorCode : "",
      aiStudentBehavior: usesAi ? suggestion?.aiStudentBehavior || action : "",
      aiYccd: usesAi ? suggestion?.aiYccd || yccdEvidence : "",
      aiProduct: usesAi ? suggestion?.aiProduct || suggestion?.product || "Sản phẩm học tập có sử dụng AI và được học sinh chỉnh sửa/kiểm chứng." : "",
      aiCriteria: usesAi ? suggestion?.aiCriteria || suggestion?.criteria || "Đúng kiến thức môn học; dùng AI đúng mục đích; biết kiểm chứng nguồn và giải thích cách điều chỉnh kết quả AI." : "",
      aiEvidence: usesAi ? suggestion?.aiEvidence || suggestion?.evidence || "Prompt đã dùng, nguồn kiểm chứng, bản chỉnh sửa của học sinh và sản phẩm cuối." : "",
      nlsStudentBehavior: usesNls ? suggestion?.nlsStudentBehavior || action : "",
      nlsProduct: usesNls ? suggestion?.nlsProduct || suggestion?.product || "Sản phẩm số hoặc bằng chứng thao tác của học sinh." : "",
      nlsCriteria: usesNls ? suggestion?.nlsCriteria || suggestion?.criteria || "Sản phẩm đáp ứng YCCĐ và thể hiện đúng thao tác số." : "",
      yccdEvidence,
      action,
      reason: appendSanitizerNote(
        appendSanitizerNote(suggestion?.reason, usesNls ? sanitizedNls.note : undefined),
        usesAi ? sanitizedAi.note : undefined,
      ),
      geoDataRequirement: suggestion?.geoDataRequirement || buildGeoDataRequirement({ subject, grade, topic }, suggestion),
    };
  })
    .filter((suggestion) => suggestion.integrationDecision !== "Không tích hợp")
    .filter((suggestion, index, all) => all.findIndex((item) => normalizeViText(item.activityName) === normalizeViText(suggestion.activityName)) === index);
  const hasGeoDataRequirement = sanitizedSuggestions.some((suggestion) => suggestion?.geoDataRequirement);

  const prompt = `Bạn là chuyên gia thiết kế hoạt động học theo ${primaryFramework ? "Công văn 2345/BGDĐT-GDTH" : "Công văn 5512/BGDĐT-GDTrH"} và tích hợp NLS/NL AI cho học sinh.
Thông tin bài học: Môn ${subject}, Lớp ${grade}, Bài: ${topic}.
Dưới đây là các gợi ý tích hợp NLS/NL AI đã được phê duyệt:
${JSON.stringify(sanitizedSuggestions, null, 2)}

${competencyGuardrails}

Nhiệm vụ: Với MỖI gợi ý, chỉ soạn PHẦN BỔ SUNG NGẮN đặt ngay trong đúng hoạt động của file DOCX gốc. Không viết lại giáo án, không tóm tắt giáo án, không tạo một khối "hướng dẫn tích hợp" dùng chung cho nhiều mục và không lặp lại lý thuyết về NLS/NL AI.

Yêu cầu trình bày khoa học, đúng cấu trúc hoạt động học:
1. activityName phải chép NGUYÊN VĂN tên hoạt động trong gợi ý để hệ thống tìm đúng vị trí chèn.
2. objective: 1 câu, tối đa 25 từ, nêu kết quả học tập quan sát được.
3. content: 1 câu, tối đa 35 từ, nêu đúng nhiệm vụ số hoặc nhiệm vụ AI theo integrationDecision; không biến hoạt động Chỉ NLS thành hoạt động AI.
4. prompt: tối đa 40 từ; chỉ viết câu lệnh mẫu khi integrationDecision có NL AI; hoạt động Chỉ NLS phải để trống.
5. product: 1 câu, tối đa 25 từ, nêu một sản phẩm/minh chứng cụ thể.
6. procedure: ${primaryFramework ? "4 câu ngắn theo tiến trình giao nhiệm vụ → HS thực hiện → chia sẻ/đánh giá → GV chốt; không gắn nhãn bước CV 5512" : "đúng 4 câu theo thứ tự Chuyển giao nhiệm vụ → Thực hiện nhiệm vụ → Báo cáo, thảo luận → Kết luận, nhận định"}; mỗi câu tối đa 30 từ và mô tả hành động GV/HS.
7. assessment: 1 câu, tối đa 30 từ, nêu tiêu chí đánh giá quan sát được.
8. Không tự viết mã NLS/NL AI trong các trường JSON. Hệ thống sẽ gắn mã đã duyệt NGAY SAU nội dung tích hợp trong đúng targetSection/targetContent của activityName; tuyệt đối không đặt một dòng “Mã năng lực” riêng ở cuối hoạt động và không chuyển mã sang hoạt động khác.
${hasGeoDataRequirement ? `9. RIÊNG MÔN ĐỊA LÍ: Nếu gợi ý có geoDataRequirement, content/procedure phải yêu cầu HS xử lí đúng bảng số liệu, nguồn và loại biểu đồ đã nêu. Không chép lại toàn bộ bảng vào nhiều trường.` : ""}

${englishConstraint}

TRẢ VỀ ĐÚNG ĐỊNH DẠNG JSON MẢNG:
[
  {
    "activityName": "Tên hoạt động",
    "objective": "Kết quả học tập quan sát được",
    "content": "Nhiệm vụ tích hợp cụ thể",
    "prompt": "Câu lệnh mẫu ngắn hoặc chuỗi rỗng",
    "product": "Sản phẩm học tập",
    "procedure": ["Chuyển giao...", "Thực hiện...", "Báo cáo, thảo luận...", "Kết luận, nhận định..."],
    "assessment": "Tiêu chí đánh giá quan sát được"
  }
]`;

  try {
    const generated = await callGeminiWithFallback(prompt, {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          activityName: { type: Type.STRING },
          objective: { type: Type.STRING },
          content: { type: Type.STRING },
          prompt: { type: Type.STRING },
          product: { type: Type.STRING },
          procedure: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          assessment: { type: Type.STRING }
        },
        required: ["activityName", "objective", "content", "product", "procedure", "assessment"]
      }
    });

    const compact = (value: any, maxLength: number) => {
      const normalized = String(value || "")
        .replace(/<\/?(?:ai|bold)>/gi, "")
        .replace(/\*\*/g, "")
        .replace(/\s+/g, " ")
        .trim();
      if (normalized.length <= maxLength) return normalized;
      const shortened = normalized.slice(0, maxLength + 1).replace(/\s+\S*$/, "").replace(/[,:;\-–—]+$/, "").trim();
      return `${shortened || normalized.slice(0, maxLength).trim()}…`;
    };
    const normalizeActivity = (value: any) => normalizeViText(String(value || "")).replace(/[^a-z0-9 ]/g, "");
    const generatedItems = Array.isArray(generated) ? generated : [];
    const usedGeneratedIndexes = new Set<number>();

    return sanitizedSuggestions.map((suggestion, suggestionIndex) => {
      const sourceName = String(suggestion?.activityName || `Hoạt động ${suggestionIndex + 1}`);
      const sourceKey = normalizeActivity(sourceName);
      const integrationDecision = normalizeIntegrationDecision(suggestion);
      const usesNls = integrationUsesNls(integrationDecision);
      const usesAi = integrationUsesAi(integrationDecision);
      let generatedIndex = generatedItems.findIndex((item: any, index: number) => {
        if (usedGeneratedIndexes.has(index)) return false;
        const itemKey = normalizeActivity(item?.activityName);
        return itemKey && sourceKey && (itemKey.includes(sourceKey) || sourceKey.includes(itemKey));
      });
      if (generatedIndex < 0 && generatedItems[suggestionIndex] && !usedGeneratedIndexes.has(suggestionIndex)) {
        generatedIndex = suggestionIndex;
      }
      if (generatedIndex >= 0) usedGeneratedIndexes.add(generatedIndex);
      const item = generatedIndex >= 0 ? generatedItems[generatedIndex] : {};

      const objective = compact(item?.objective || suggestion?.yccdEvidence || (usesAi ? suggestion?.aiYccd : suggestion?.nlsStudentBehavior), 210);
      const content = compact(item?.content || suggestion?.action || (usesAi ? suggestion?.aiStudentBehavior : suggestion?.nlsStudentBehavior), 260);
      const promptExample = usesAi ? compact(item?.prompt, 230) : "";
      const product = compact(item?.product || (usesAi ? suggestion?.aiProduct : suggestion?.nlsProduct), 210);
      const assessment = compact(item?.assessment || (usesAi ? suggestion?.aiCriteria : suggestion?.nlsCriteria), 240);
      const procedures = (Array.isArray(item?.procedure) ? item.procedure : [])
        .map((step: any) => compact(step, 240))
        .filter(Boolean)
        .slice(0, 4);
      const fallbackProcedures = isEnglish
        ? usesAi
          ? [
            "Teacher assigns the AI-supported task; students confirm the expected product.",
            "Students use the prompt, compare the AI response with the learning source, and revise it.",
            "Students present the product and explain what they accepted, rejected, or corrected.",
            "Teacher validates subject knowledge and gives feedback on responsible AI use."
          ]
          : [
            "Teacher assigns the digital task; students confirm the expected product.",
            "Students use the selected digital tool to process information and create the product.",
            "Students present the product and explain the digital steps they performed.",
            "Teacher validates subject knowledge and assesses the observable digital behavior."
          ]
        : usesAi
          ? [
            "GV chuyển giao nhiệm vụ có sử dụng AI; HS xác nhận yêu cầu và sản phẩm cần hoàn thành.",
            "HS dùng prompt, đối chiếu kết quả AI với học liệu và chỉnh sửa thông tin chưa chính xác.",
            "HS báo cáo sản phẩm, nêu rõ nội dung đã chấp nhận, loại bỏ hoặc điều chỉnh từ kết quả AI.",
            "GV chuẩn hóa kiến thức và nhận xét cách sử dụng AI có trách nhiệm."
          ]
          : [
            "GV chuyển giao nhiệm vụ số; HS xác nhận yêu cầu và sản phẩm cần hoàn thành.",
            "HS sử dụng công cụ số đã chọn để xử lí thông tin và tạo sản phẩm.",
            "HS báo cáo sản phẩm và trình bày các thao tác số đã thực hiện.",
            "GV chuẩn hóa kiến thức và đánh giá hành vi số quan sát được."
          ];
      while (procedures.length < 4) procedures.push(fallbackProcedures[procedures.length]);

      const codeParts: string[] = [];
      if (usesNls) {
        const nlsCode = compact(suggestion?.suggestedNLS || "Không gán mã", 90);
        const nlsName = compact(suggestion?.nlsCompetencyName || "Cần đối chiếu tên năng lực thành phần", 110);
        codeParts.push(`Mã chỉ báo NLS: ${nlsCode}; Thành phần NLS: ${nlsName}`);
      }
      if (usesAi) {
        const aiName = compact(suggestion?.aiCompetencyName || "", 110);
        const aiGrade = compact(suggestion?.aiGrade || grade || "", 40);
        const aiTopic = compact(suggestion?.aiTopic || "", 70);
        const aiIndicatorCode = compact(suggestion?.aiIndicatorCode || suggestion?.suggestedAI || "", 90);
        codeParts.push(`Thành phần NL AI: ${aiName}; Khối lớp: ${aiGrade}; Chủ đề: ${aiTopic}; Mã chỉ báo NL AI: ${aiIndicatorCode}`);
      }
      const integrationLevel = compact(suggestion?.integrationLevel || "Mức vừa", 40);
      const devicePlan = compact(suggestion?.devicePlan || "Phương án B/C; có học liệu ngoại tuyến khi thiếu Internet", 150);
      const labels = isEnglish
        ? {
          objective: "a) Integrated objective",
          content: "b) Integrated content",
          prompt: "Suggested prompt",
          product: "c) Product",
          procedure: "d) Implementation",
          steps: primaryFramework ? ["Assign task", "Student work", "Share and assess", "Teacher conclusion"] : ["Assign task", "Perform task", "Report and discuss", "Conclude and assess"],
          assessment: "Assessment",
          codes: "Competency codes"
        }
        : {
          objective: "a) Mục tiêu tích hợp",
          content: "b) Nội dung tích hợp",
          prompt: "Prompt gợi ý",
          product: "c) Sản phẩm",
          procedure: "d) Tổ chức thực hiện",
          steps: primaryFramework ? ["Giao nhiệm vụ", "Học sinh thực hiện", "Chia sẻ, đánh giá", "Giáo viên chốt"] : ["Chuyển giao nhiệm vụ", "Thực hiện nhiệm vụ", "Báo cáo, thảo luận", "Kết luận, nhận định"],
          assessment: "Đánh giá",
          codes: "Mã năng lực"
        };

      const taggedContent = codeParts.length
        ? `${content} — [${labels.codes}: ${codeParts.join("; ")}]`
        : content;

      return {
        activityName: sourceName,
        targetSection: String(suggestion?.targetSection || "Nội dung").trim(),
        targetText: String(suggestion?.targetContent || "").trim(),
        text: [
          `${labels.objective}: ${objective}`,
          `${labels.content}: ${taggedContent}`,
          `- ${isEnglish ? "Level/device plan" : "Mức độ/phương án thiết bị"}: ${integrationLevel}; ${devicePlan}`,
          promptExample ? `- ${labels.prompt}: ${promptExample}` : "",
          `${labels.product}: ${product}`,
          `${labels.procedure}:`,
          ...procedures.map((step: string, index: number) => `- ${labels.steps[index]}: ${step}`),
          `- ${labels.assessment}: ${assessment}`
        ].filter(Boolean).join("\n")
      };
    });
  } catch (err) {
    console.error("Error generating snippets:", err);
    throw err;
  }
};

/**
 * Chuẩn hóa và khắc phục sự cố bóc tách JSON danh sách bài học
 * Hỗ trợ bóc tách mảng JSON, JSON bị cắt cụt (truncated), markdown fences, và regex từng object
 */
export const robustParseCurriculumJson = (rawText: string): any[] | null => {
  if (!rawText || typeof rawText !== 'string') return null;

  let text = rawText.trim();
  // Loại bỏ markdown code block nếu có
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  }

  const normalizeItem = (item: any) => {
    if (!item || typeof item !== 'object') return null;
    const name = String(
      item.lessonName || item.lessonContent || item.lesson || item.topic || item.name || item.title || item.tenBai || item.ten_bai || ''
    ).trim();

    // Bỏ qua các hàng tiêu đề vô nghĩa
    if (!name || /^(stt|tên bài|bài học|chủ đề|tuần|tiết|yêu cầu cần đạt|nội dung)$/i.test(name)) {
      return null;
    }

    const periods = typeof item.periods === 'number'
      ? item.periods
      : parseInt(String(item.periods || item.soTiet || item.so_tiet || item.duration || '1').replace(/[^\d]/g, ''), 10) || 1;

    const timing = String(item.timing || item.time || item.tuan || item.week || '').trim();
    const yccd = String(item.yccd || item.lessonGoal || item.mucTieu || item.yeuCauCanDat || item.requirements || '').trim();

    return {
      lessonName: name,
      lessonContent: name,
      topic: name,
      lesson: name,
      periods,
      timing: timing || 'Tuần 1',
      time: timing || 'Tuần 1',
      yccd,
      lessonGoal: yccd,
    };
  };

  const sanitizeAndFilter = (list: any[]): any[] | null => {
    if (!Array.isArray(list)) return null;
    const normalized = list.map(normalizeItem).filter(Boolean);
    return normalized.length > 0 ? normalized : null;
  };

  // 1. Thử parse trực tiếp
  try {
    const direct = JSON.parse(text);
    if (Array.isArray(direct)) {
      const res = sanitizeAndFilter(direct);
      if (res) return res;
    }
    if (direct && typeof direct === 'object') {
      for (const k of Object.keys(direct)) {
        if (Array.isArray(direct[k])) {
          const res = sanitizeAndFilter(direct[k]);
          if (res) return res;
        }
      }
    }
  } catch {
    // Tiếp tục các phương án phục hồi
  }

  // 2. Tìm khối [ ... ] hoàn chỉnh bằng regex
  const fullArrayMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (fullArrayMatch) {
    try {
      const arr = JSON.parse(fullArrayMatch[0]);
      const res = sanitizeAndFilter(arr);
      if (res) return res;
    } catch {
      // Tiếp tục phục hồi mảng bị cắt cụt
    }
  }

  // 3. Phục hồi mảng JSON bị cắt cụt (truncated response)
  const firstBracket = text.indexOf('[');
  const lastBrace = text.lastIndexOf('}');
  if (firstBracket !== -1 && lastBrace > firstBracket) {
    let candidate = text.substring(firstBracket, lastBrace + 1) + ']';
    // Xóa dấu phẩy thừa trước dấu đóng ngoặc vuông nếu có
    candidate = candidate.replace(/,\s*\]$/, ']');
    try {
      const arr = JSON.parse(candidate);
      const res = sanitizeAndFilter(arr);
      if (res) return res;
    } catch {
      // Thử xử lý unescaped control characters
      try {
        const cleaned = candidate.replace(/[\x00-\x1F\x7F-\x9F]/g, ' ');
        const arr = JSON.parse(cleaned);
        const res = sanitizeAndFilter(arr);
        if (res) return res;
      } catch {}
    }
  }

  // 4. Trích xuất từng object JSON riêng lẻ bằng regex
  const regexObjects: any[] = [];
  const objectRegex = /\{[^{}]*"(?:lessonName|lesson|lessonContent|topic|name|title|tenBai)"[^{}]*\}/g;
  let match: RegExpExecArray | null;
  while ((match = objectRegex.exec(text)) !== null) {
    try {
      const obj = JSON.parse(match[0]);
      const item = normalizeItem(obj);
      if (item) regexObjects.push(item);
    } catch {
      // Bỏ qua object lỗi cú pháp
    }
  }
  if (regexObjects.length > 0) {
    return regexObjects;
  }

  // 5. Quét đối tượng mở rộng nhiều dòng với nested string/escaped quotes
  const broadObjectRegex = /\{(?:[^{}"]|"(?:\\.|[^"\\])*")*\}/g;
  while ((match = broadObjectRegex.exec(text)) !== null) {
    try {
      const obj = JSON.parse(match[0]);
      const item = normalizeItem(obj);
      if (item && !regexObjects.some(r => r.lessonName === item.lessonName && r.timing === item.timing)) {
        regexObjects.push(item);
      }
    } catch {}
  }
  if (regexObjects.length > 0) {
    return regexObjects;
  }

  return null;
};

export const parseCurriculumAppendix = async (rawText: string, pdfBase64?: string) => {
  const apiKey = localStorage.getItem('GEMINI_API_KEY');
  if (!apiKey) throw new Error('API_KEY_REQUIRED');
  const startModel = localStorage.getItem('GEMINI_MODEL') || 'gemini-3.5-flash';
  const modelsToTry = getFallbackModels(startModel);

  const instruction = `Bạn là chuyên gia bóc tách phân phối chương trình giáo dục phổ thông (CT GDPT 2018).

NHIỆM VỤ: Bóc tách toàn bộ danh sách các bài học / tiết dạy / chủ đề / bài kiểm tra từ tài liệu được cung cấp.

QUY TẮC BẮT BUỘC:
1. BẮT BUỘC bóc tách TẤT CẢ các bài học / tiết dạy theo thứ tự từ đầu đến cuối năm học (HK1 và HK2). KHÔNG ĐƯỢC bỏ sót bài nào.
2. Mỗi tiết học hoặc bài học là 1 object riêng biệt trong JSON array.
3. Giữ nguyên tên bài học chính xác theo gốc (kể cả tiếng Việt hay tiếng Anh, ví dụ: "Unit 1: LIFE STORIES WE ADMIRE - Getting started").
4. "periods": Số tiết (dạng số nguyên, ví dụ 1, 2).
5. "timing": Tuần dạy hoặc thời điểm (ví dụ: "Tuần 1", "Tuần 2", ...).
6. "yccd": Yêu cầu cần đạt / mục tiêu của bài học. Nếu trong tài liệu gốc quá dài, hãy tóm tắt cô đọng 1-2 câu trọng tâm nhất để đảm bảo phản hồi ngắn gọn và trọn vẹn 100% tất cả các bài học trong năm.
7. Bỏ qua các tiêu đề hành chính (quốc hiệu, tên trường, lời mở đầu, chữ ký).

Trả về mảng JSON thuần túy theo đúng JSON Schema đã khai báo.`;

  let parts: any[];
  if (pdfBase64) {
    parts = [
      { text: instruction + '\n\nHãy phân tích file PDF đính kèm và trích xuất toàn bộ danh sách bài học theo phân phối chương trình.' },
      { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } }
    ];
  } else {
    // Truyền tối đa 150.000 ký tự để không bỏ sót học kỳ 2 của các môn có PPCT dài
    parts = [{ text: instruction + `\n\nVĂN BẢN GỐC PHÂN PHỐI CHƯƠNG TRÌNH: \n"""\n${rawText.substring(0, 150000)}\n"""` }];
  }

  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'ARRAY' as any,
        items: {
          type: 'OBJECT' as any,
          properties: {
            lessonName: { type: 'STRING' as any },
            periods: { type: 'INTEGER' as any },
            timing: { type: 'STRING' as any },
            yccd: { type: 'STRING' as any }
          },
          required: ['lessonName', 'periods', 'timing']
        }
      },
      maxOutputTokens: 65536,
      temperature: 0.1,
    },
  };

  for (let i = 0; i < modelsToTry.length; i++) {
    const currentModel = modelsToTry[i];
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        if (res.status === 429 || errText.includes('RESOURCE_EXHAUSTED')) throw new Error('QUOTA_EXHAUSTED');
        if (res.status === 401 || res.status === 403) throw new Error('API_KEY_INVALID');
        throw new Error(`HTTP ${res.status}: ${errText}`);
      }

      const json = await res.json();
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('AI trả về phản hồi rỗng khi phân tích phụ lục.');

      const parsed = robustParseCurriculumJson(text);

      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error(`Không trích xuất được bài học nào. AI trả về: ${text.substring(0, 200)}`);
      }
      return parsed;
    } catch (err: any) {
      console.error(`[parseCurriculum] Lỗi với model ${currentModel}:`, err);
      const isApiKeyInvalid = err.message?.startsWith('API_KEY_INVALID') || err.message?.includes('401');
      const isQuota = err.message?.includes('QUOTA_EXHAUSTED');
      const isLast = i === modelsToTry.length - 1;
      if (isApiKeyInvalid) throw new Error('API_KEY_INVALID');
      if (isLast) {
        if (isQuota) throw new Error('QUOTA_EXHAUSTED');
        throw err;
      }
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw new Error('Tất cả models đều thất bại.');
};


export const generateLessonPlan = async (input: LessonPlanInput) => {
  const formattingNeed = input.useLaTeX || input.detailDrawings || needsScientificFormatting(input.subject);
  const primaryFramework = isPrimaryGrade(input.grade);
  const lessonFrameworkLabel = primaryFramework ? "CV 2345/BGDĐT-GDTH" : "CV 5512/BGDĐT-GDTrH";
  const socialIntegrationPrompt = buildSocialIntegrationSelectionPrompt(input.socialIntegrations);
  const lessonPlanGuidelines = primaryFramework ? PRIMARY_LESSON_PLAN_GUIDELINES : LESSON_PLAN_STRICT_GUIDELINES;
  const activityFrameworkInstruction = primaryFramework
    ? "Tổ chức các hoạt động dạy học chủ yếu theo mạch phù hợp YCCĐ tiểu học; không ép bốn hoạt động hoặc bốn bước CV 5512."
    : "Phân bổ bốn nhóm hoạt động CV 5512: Khởi động; Hình thành kiến thức mới; Luyện tập; Vận dụng. Mỗi hoạt động có bốn bước tổ chức theo hướng dẫn.";
  const englishConstraint = (input.subject === "Tiếng Anh" || input.subject.toLowerCase().includes("english")) ? "\\nLỆNH ĐẶC BIỆT TỐI QUAN TRỌNG: Môn học là Tiếng Anh nên TOÀN BỘ nội dung giáo án (kịch bản GV-HS, mục tiêu, nội dung...) PHẢI ĐƯỢC VIẾT 100% BẰNG TIẾNG ANH (ENGLISH). ĐẶC BIỆT, KHI NỘI DUNG TÍCH HỢP NĂNG LỰC SỐ (NLS) VÀ NĂNG LỰC AI (NLAI) ĐƯỢC KHỞI TẠO, CHÚNG CŨNG BẮT BUỘC PHẢI ĐƯỢC VIẾT BẰNG TIẾNG ANH." : "";
  const lessonYccd = [input.objectivesKnowledge, input.objectivesCompetency, input.objectivesQuality].filter(Boolean).join("\n");
  const competencyGuardrails = getCompetencyGuardrails(input.subject, input.grade, lessonYccd);
  const safeIndicatorCode = getSafeAiIndicatorCode(input.indicatorCode, input.grade);
  const selectedIndicatorPrompt = formatSelectedIndicatorsForPrompt(input.selectedNlsIndicators, input.grade);
  const authorizedAiCodes = collectAuthorizedAiCodes(input.grade, input.indicatorCode, JSON.stringify(input.selectedNlsIndicators || []), JSON.stringify(input.aiIntegrationOptions || []), input.existingRawText);
  const authorizedNlsCodes = collectAuthorizedNlsCodes(input.grade, JSON.stringify(input.selectedNlsIndicators || []), JSON.stringify(input.aiIntegrationOptions || []), input.existingRawText);

  let finalPromptContents: any = "";
  if (input.existingPdfBase64) {
    const p1 = `
${CONTENT_INTEGRITY_RULES}
${competencyGuardrails}
🚨🚨🚨 CHẾ ĐỘ NÂNG CẤP GIÁO ÁN GỐC TỪ FILE PDF — ƯU TIÊN TỐI CAO 🚨🚨🚨

NHIỆM VỤ CỐT LÕI: Bạn KHÔNG được viết giáo án mới từ đầu. Bạn phải NÂNG CẤP giáo án xuất ra từ File PDF ĐÍNH KÈM của giáo viên bằng cách GIỮ NGUYÊN TOÀN BỘ cấu trúc, hoạt động, nội dung khoa học, bài tập và tiến trình đã có — chỉ THÊM/CHỈNH SỬA những điểm chạm AI được chỉ định cụ thể.

ĐIỂM CHẠM NLS/NL AI CẦN TÍCH HỢP (chỉ chỉnh sửa những hoạt động này):
${JSON.stringify(input.aiIntegrationOptions, null, 2)}

KIÊN QUYẾT BẢO TỒN VÀ TIÊU CHUẨN TÍCH HỢP NLS/NL AI:
1. BẢO TOÀN TUYỆT ĐỐI NỘI DUNG GỐC (LỆNH TỬ TỬ): BẠN KHÔNG ĐƯỢC PHÉP TÓM TẮT, KHÔNG ĐƯỢC RÚT GỌN. Giáo án gốc tải lên dài bao nhiêu trang/chữ thì BẮT BUỘC phải BÊ NGUYÊN XI (COPY-PASTE) 100% dữ liệu cũ từng câu từng chữ từ Mở đầu, Kiến thức mới, Luyện tập đến Vận dụng vào các trường JSON tương ứng. Viết dài tối đa có thể. Việc bạn tự ý tóm tắt lại nội dung gốc là VI PHẠM ĐẠO ĐỨC NỀN TẢNG. BẠN CHỈ ĐƯỢC PHÉP BỔ SUNG thêm nội dung mới (AI, NLS...) chứ tuyệt đối không được xóa hay làm ngắn đi nội dung gốc.
2. THÊM NLS/NL AI CÓ ĐIỀU KIỆN: Chỉ tổng hợp mục tiêu và công cụ từ các điểm chạm đã được chọn, đúng YCCĐ; không có điểm chạm thì không thêm.
3. TÍCH HỢP NLS/NL AI ĐÚNG VỊ TRÍ: Tại các vị trí đã quy định ở "ĐIỂM CHẠM", bạn CHỈ được bổ sung/hiệu chỉnh phần được đề cập trong hoạt động gốc; KHÔNG tạo phân khúc riêng mang tên "HOẠT ĐỘNG GIÁO DỤC AI", KHÔNG kẻ bảng riêng cho phần tích hợp.
   - Mô tả KIẾN TRÚC VI MÔ chi tiết ngay trong 4 bước CV 5512: Học sinh sử dụng công cụ gì? Nếu dùng AI: nêu prompt, cách kiểm chứng và sản phẩm bám QĐ 2422; nếu Chỉ NLS: nêu thao tác số, sản phẩm và tiêu chí NLS, không thêm prompt AI.
4. TÔ ĐỎ ĐỂ NHẬN DIỆN KHÁC BIỆT: CHỈ phần nội dung tích hợp NLS/NL AI mới được bọc bởi thẻ <ai>...</ai> để hiện màu đỏ. Không thêm nhãn "[BÁO ĐỘNG ĐỎ]" và không bọc đỏ toàn bộ hoạt động nếu chỉ có một đoạn nhỏ được tích hợp.
5. LỆNH MÃ CHỈ BÁO: Trong mục \`aiSpecific\` của JSON đầu ra, mỗi dòng mục tiêu AI phải ghi đúng tên thành phần, hành vi học sinh và YCCĐ trước mã. ${safeIndicatorCode ? `Ưu tiên mã NL AI hợp lệ từ hệ thống: (${safeIndicatorCode}) khi khớp YCCĐ.` : `Nếu hoạt động có điểm chạm NL AI rõ, bắt buộc chọn thành phần/chủ đề và sinh một mã đầy đủ theo đúng lớp, YCCĐ và hành vi, ví dụ NLa-12.A1.1; không ghi mã thành phần đơn lẻ hoặc “Cần đối chiếu mã AI”. Nếu không có điểm chạm thì ghi “Không tích hợp NL AI”.`}.
${AI_COMPETENCY_ORDER_RULE}
${selectedIndicatorPrompt}
${input.additionalNotes ? `\nGHI CHÚ TÍCH HỢP BẮT BUỘC TỪ GIÁO VIÊN/APP:\n${input.additionalNotes}\nLỆNH: Phân bổ nội dung theo đúng chức năng, không sao chép nguyên khối: mục tiêu ghi kết quả ngắn; tiến trình mô tả tại đúng hoạt động; đánh giá chỉ ghi tiêu chí/minh chứng tương ứng.` : ""}
${englishConstraint}
${formattingNeed ? FORMATTING_INSTRUCTIONS : ""}
${UPGRADE_IN_PLACE_GUIDELINES}
${isGeographyLikeSubject(input.subject) ? GEOGRAPHY_AI_RULES : ""}
${socialIntegrationPrompt}
${SOCIAL_INTEGRATION_GUIDELINES}
`;
    finalPromptContents = [
      p1,
      {
        inlineData: {
          mimeType: "application/pdf",
          data: input.existingPdfBase64
        }
      }
    ];
  } else {
    finalPromptContents = input.existingRawText
      ? `
${CONTENT_INTEGRITY_RULES}
${competencyGuardrails}
🚨🚨🚨 CHẾ ĐỘ NÂNG CẤP GIÁO ÁN GỐC — ƯU TIÊN TỐI CAO 🚨🚨🚨

NHIỆM VỤ CỐT LÕI: Bạn KHÔNG được viết giáo án mới từ đầu. Bạn phải NÂNG CẤP giáo án gốc sau đây của giáo viên bằng cách GIỮ NGUYÊN TOÀN BỘ cấu trúc, hoạt động, nội dung khoa học, bài tập và tiến trình đã có — chỉ THÊM / CHỈNH SỬA những điểm chạm AI được chỉ định cụ thể.

VĂN BẢN GIÁO ÁN GỐC CỦA GIÁO VIÊN(BẮT BUỘC BẢO TOÀN):
"""
${input.existingRawText.substring(0, 60000)}
"""

ĐIỂM CHẠM NLS/NL AI CẦN TÍCH HỢP(chỉ chỉnh sửa những hoạt động này):
${JSON.stringify(input.aiIntegrationOptions, null, 2)}

KIÊN QUYẾT BẢO TỒN VÀ TIÊU CHUẨN TÍCH HỢP NLS/NL AI:
1. BẢO TOÀN TUYỆT ĐỐI NỘI DUNG GỐC (LỆNH TỬ TỬ): BẠN KHÔNG ĐƯỢC PHÉP TÓM TẮT, KHÔNG ĐƯỢC RÚT GỌN. Giáo án gốc tải lên dài bao nhiêu trang/chữ thì BẮT BUỘC phải BÊ NGUYÊN XI (COPY-PASTE) 100% dữ liệu cũ từng câu từng chữ từ Mở đầu, Kiến thức mới, Luyện tập đến Vận dụng vào các trường JSON tương ứng. Viết dài tối đa có thể. Việc bạn tự ý tóm tắt lại nội dung gốc là VI PHẠM ĐẠO ĐỨC NỀN TẢNG. BẠN CHỈ ĐƯỢC PHÉP BỔ SUNG thêm nội dung mới (AI, NLS...) chứ tuyệt đối không được xóa hay làm ngắn đi nội dung gốc.
2. THÊM NLS/NL AI CÓ ĐIỀU KIỆN: Chỉ tổng hợp mục tiêu và công cụ từ các điểm chạm đã được chọn, đúng YCCĐ; không có điểm chạm thì không thêm.
3. TÍCH HỢP NLS/NL AI ĐÚNG VỊ TRÍ: Tại các vị trí đã quy định ở "ĐIỂM CHẠM", bạn CHỈ được bổ sung/hiệu chỉnh phần được đề cập trong hoạt động gốc; KHÔNG tạo phân khúc riêng mang tên "HOẠT ĐỘNG GIÁO DỤC AI", KHÔNG kẻ bảng riêng cho phần tích hợp.
   - Mô tả KIẾN TRÚC VI MÔ chi tiết ngay trong 4 bước CV 5512: Học sinh sử dụng công cụ gì? Nếu dùng AI: nêu prompt, cách kiểm chứng và sản phẩm bám QĐ 2422; nếu Chỉ NLS: nêu thao tác số, sản phẩm và tiêu chí NLS, không thêm prompt AI.
4. TÔ ĐỎ ĐỂ NHẬN DIỆN KHÁC BIỆT: CHỈ phần nội dung tích hợp NLS/NL AI mới được bọc bởi thẻ <ai>...</ai> để hiện màu đỏ. Không thêm nhãn "[BÁO ĐỘNG ĐỎ]" và không bọc đỏ toàn bộ hoạt động nếu chỉ có một đoạn nhỏ được tích hợp.
5. LỆNH MÃ CHỈ BÁO: Trong mục \`aiSpecific\` của JSON đầu ra, mỗi dòng mục tiêu AI phải ghi đúng tên thành phần, hành vi học sinh và YCCĐ trước mã. ${safeIndicatorCode ? `Ưu tiên mã NL AI hợp lệ từ hệ thống: (${safeIndicatorCode}) khi khớp YCCĐ.` : `Nếu hoạt động có điểm chạm NL AI rõ, bắt buộc chọn thành phần/chủ đề và sinh một mã đầy đủ theo đúng lớp, YCCĐ và hành vi, ví dụ NLa-12.A1.1; không ghi mã thành phần đơn lẻ hoặc “Cần đối chiếu mã AI”. Nếu không có điểm chạm thì ghi “Không tích hợp NL AI”.`}.
${AI_COMPETENCY_ORDER_RULE}
${selectedIndicatorPrompt}
${input.additionalNotes ? `\nGHI CHÚ TÍCH HỢP BẮT BUỘC TỪ GIÁO VIÊN/APP:\n${input.additionalNotes}\nLỆNH: Phân bổ nội dung theo đúng chức năng, không sao chép nguyên khối: mục tiêu ghi kết quả ngắn; tiến trình mô tả tại đúng hoạt động; đánh giá chỉ ghi tiêu chí/minh chứng tương ứng.` : ""}
${englishConstraint}
${formattingNeed ? FORMATTING_INSTRUCTIONS : ""}
${UPGRADE_IN_PLACE_GUIDELINES}
${isGeographyLikeSubject(input.subject) ? GEOGRAPHY_AI_RULES : ""}
${socialIntegrationPrompt}
${SOCIAL_INTEGRATION_GUIDELINES}
` : "";
  }

  const basePrompt = `
    Vai trò: Bạn là chuyên gia thiết kế kế hoạch bài dạy theo CT GDPT 2018, ${lessonFrameworkLabel}, TT 02/2025/TT-BGDĐT và QĐ 2422/QĐ-BGDĐT.
    Hãy soạn Kế hoạch bài dạy khoa học, đủ dùng, mô tả rõ hành động GV-HS nhưng không diễn giải dài dòng cho:
    Môn học: ${input.subject}
    Tên bài dạy: ${input.topic}
    Lớp: ${input.grade} - Thời lượng: ${input.duration}
    Hoàn cảnh học sinh: ${input.contextStudents || "Học sinh có khả năng tiếp thu trung bình - khá"}
    Điều kiện trường lớp: ${input.contextSchool || "Lớp học có máy chiếu và kết nối internet cơ bản"}
    ${input.objectivesKnowledge ? `Mục tiêu kiến thức yêu cầu: ${input.objectivesKnowledge}` : ""}
    ${input.objectivesCompetency ? `Mục tiêu năng lực yêu cầu: ${input.objectivesCompetency}` : ""}
    ${input.objectivesQuality ? `Mục tiêu phẩm chất yêu cầu: ${input.objectivesQuality}` : ""}
    ${input.additionalNotes ? `GHI CHÚ TÍCH HỢP BẮT BUỘC TỪ GIÁO VIÊN/APP:\n${input.additionalNotes}\nLỆNH: Phân bổ nội dung theo đúng chức năng, không sao chép nguyên khối: mục tiêu ghi kết quả ngắn; tiến trình mô tả tại đúng hoạt động; đánh giá chỉ ghi tiêu chí/minh chứng tương ứng.` : ""}
    Lưu ý riêng về độ tuổi(Nếu là khối 6, 7, 8, 9): Giáo án CẦN TĂNG CƯỜNG thực hành, thao tác trực quan, và trò chơi hóa(gamification).Hạn chế những câu hỏi thảo luận mang tính triết học nặng nề của cấp 3.

    ${AI_SUBJECT_GUIDELINES}
    ${SOCIAL_INTEGRATION_GUIDELINES}
    ${socialIntegrationPrompt}
    ${competencyGuardrails}
    THAM CHIẾU QĐ 2422: ưu tiên lớp + chủ đề + nguyên văn YCCĐ. Chỉ dùng mã chi tiết khi bảng đối chiếu đầu vào đã cung cấp và khớp YCCĐ; không tự tạo số thứ tự từ ví dụ.
      ${safeIndicatorCode ? `\nMÃ NL AI HỢP LỆ TỪ HỆ THỐNG: ${safeIndicatorCode}. Chỉ khai báo trong mục "Năng lực AI đặc thù" nếu chứng minh được mã này bám sát YCCĐ môn học.` : ""}
      ${selectedIndicatorPrompt}
    ${AI_COMPETENCY_ORDER_RULE}
    ${CURRICULUM_DATA}
    ${formattingNeed ? FORMATTING_INSTRUCTIONS : ""}
    ${englishConstraint}

    YÊU CẦU NỘI DUNG NGHIÊM NGẶT (KHUNG ${lessonFrameworkLabel}, TT 02 VÀ QĐ 2422):

    QUY TẮC THỰC THI NGHIÊM NGẶT(CRITICAL RULES):
    1. KIỂM TRA ĐIỀU KIỆN TÍCH HỢP:
    - ${safeIndicatorCode ? "Có mã NL AI hợp lệ từ hệ thống. Phải kiểm tra lại YCCĐ trước khi tích hợp vào đúng hoạt động gốc; nếu không có điểm chạm thật sự thì nêu lý do không gán." : "Tự động đánh giá nội dung bài học để xem có khả năng tích hợp AI hay không. Nếu không tích hợp thì để trống mục Năng lực AI. Nếu có tích hợp thì chỉ bổ sung vào đúng hoạt động gốc, không tạo hoạt động AI riêng."}
    2. MÔ TẢ CÔNG CỤ SỐ/AI: Chỉ tại hoạt động có tích hợp, nêu công cụ phù hợp lứa tuổi và phương án ngoại tuyến; không mặc định mọi phần mềm là AI.
    3. GẮN MÃ/THAM CHIẾU: Khi có điểm chạm NL AI, ghi đúng tên thành phần -> hành vi học sinh -> YCCĐ AI -> một mã đầy đủ đúng lớp ${input.grade}, chủ đề và số chỉ báo, ví dụ NLa-12.A1.1. Mã phải được chọn từ YCCĐ/hành vi của chính hoạt động; không ghi chung chung “Cần đối chiếu mã AI”. Không có điểm chạm thì không tích hợp NL AI.
    4. ĐÁNH DẤU MÀU ĐỎ: Chỉ sử dụng thẻ <ai>...</ai> cho đúng đoạn nội dung có tích hợp NLS/NL AI để đoạn đó hiện màu đỏ. Không dùng nhãn "[BÁO ĐỘNG ĐỎ]" và không kẻ bảng riêng cho phần tích hợp.

    I.MỤC TIÊU:
    - Kiến thức: Nêu rõ kiến thức cốt lõi theo YCCĐ môn học và ${lessonFrameworkLabel}.
    - Năng lực:
    + Đặc thù môn học: Theo chương trình 2018.
      + Năng lực số: Chỉ ghi năng lực có hành vi và sản phẩm của học sinh; dùng mức tham chiếu đúng lớp theo bộ quy tắc khóa, tối đa 1-2 mã cho một hoạt động.
      + Năng lực AI đặc thù(Chỉ thêm nếu Có tích hợp AI): Chỉ trả về mảng string, mỗi chuỗi trình bày đúng thứ tự: Tên thành phần năng lực AI -> hành vi học sinh -> yêu cầu cần đạt AI -> mã NL AI -> sản phẩm -> tiêu chí -> minh chứng. ${safeIndicatorCode ? `(Mã hệ thống hợp lệ cần xem xét: ${safeIndicatorCode})` : `(Không tự bịa mã; nếu thiếu căn cứ thì để trống/ghi "Không tích hợp")`}.
      + Năng lực chung: Tự chủ, tự học; Giao tiếp...
    - Phẩm chất: Bám CT GDPT 2018 và khung ${lessonFrameworkLabel}.

    II. THIẾT BỊ/ĐỒ DÙNG DẠY HỌC VÀ HỌC LIỆU: Bám ${lessonFrameworkLabel}; chỉ thêm công cụ số/AI khi hoạt động đã chọn cần dùng.

      III.TIẾN TRÌNH DẠY HỌC(CHI TIẾT):
    ${lessonPlanGuidelines}

    ${activityFrameworkInstruction}
    LƯU Ý: Chỉ lồng ghép NLS/NL AI vào đúng hoạt động có điểm chạm; không tạo hoạt động AI riêng và không thêm mã vào hoạt động không tích hợp.

      IV.KẾ HOẠCH ĐÁNH GIÁ:
    Nếu có hoạt động AI, thiết kế tiêu chí đánh giá hành vi kiểm chứng, chỉnh sửa và sử dụng an toàn ngay cho sản phẩm đó. Chỉ tạo câu hỏi/quiz khi phù hợp YCCĐ và thời lượng, không bắt buộc cho mọi bài.

      V.PHỤ LỤC:
    Mỗi hoạt động AI chỉ kèm tối đa 1 prompt mẫu ngắn; không có hoạt động AI thì để mảng prompts rỗng.

    Định dạng đầu ra: JSON.
  `;

  try {
    const generated = await callGeminiWithFallback(finalPromptContents || basePrompt, {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        objectives: {
          type: Type.OBJECT,
          properties: {
            knowledge: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Mục tiêu về kiến thức" },
            subjectSpecific: { type: Type.ARRAY, items: { type: Type.STRING } },
            digitalSpecific: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Mục tiêu Năng lực số" },
            aiSpecific: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Mục tiêu NL AI nếu có điểm chạm. Mỗi chuỗi ghi: tên thành phần -> hành vi HS -> YCCĐ AI -> một mã đầy đủ dạng NLa-12.A1.1 đúng lớp/chủ đề/chỉ báo -> sản phẩm -> tiêu chí -> minh chứng. Không có điểm chạm thì trả mảng rỗng." },
            general: { type: Type.ARRAY, items: { type: Type.STRING } },
            qualities: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["knowledge", "subjectSpecific", "digitalSpecific", "aiSpecific", "general", "qualities"],
        },
        materials: {
          type: Type.OBJECT,
          properties: {
            traditional: { type: Type.ARRAY, items: { type: Type.STRING } },
            digitalAndAI: {
              type: Type.OBJECT,
              properties: {
                implementationMethod: { type: Type.STRING, description: "Phương án triển khai" },
                specificTools: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Học liệu/công cụ cụ thể" },
              },
              required: ["implementationMethod", "specificTools"],
            },
          },
          required: ["traditional", "digitalAndAI"],
        },
        activities: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: primaryFramework ? "Tên hoạt động dạy học chủ yếu theo CV 2345 và YCCĐ tiểu học; không gắn nhãn CV 5512." : "Tên hoạt động đúng nhóm CV 5512: Khởi động, Hình thành kiến thức mới, Luyện tập hoặc Vận dụng." },
              periodLabel: { type: Type.STRING, description: "Nhãn tiết học nếu bài có nhiều tiết, ví dụ: Tiết 1, Tiết 2, Tiết 3-4. Nếu bài 1 tiết có thể ghi Tiết 1." },
              objective: { type: Type.STRING, description: "a) Mục tiêu của hoạt động: phải rõ học sinh đạt gì, không viết chung chung." },
              content: { type: Type.STRING, description: "b) Nội dung hoạt động: nhiệm vụ, học liệu, câu hỏi, bảng/hình/công thức cần khai thác." },
              studentNotes: { type: Type.STRING, description: "Nội dung ghi bài của HS: các ý kiến thức cốt lõi học sinh ghi vào vở sau khi GV chốt. Không ghi nhiệm vụ, không ghi sản phẩm chung chung; phải bám SGK/tài liệu gốc." },
              product: { type: Type.STRING, description: "c) Sản phẩm: sản phẩm học tập cụ thể, tiêu chí rõ, không ghi chung chung." },
              procedure: {
                type: Type.ARRAY,
                description: "d) Tổ chức thực hiện. BẮT BUỘC đúng 4 bước: Chuyển giao nhiệm vụ; Thực hiện nhiệm vụ; Báo cáo, thảo luận; Kết luận, nhận định.",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    stepName: { type: Type.STRING, description: "Tên bước (Bắt buộc theo thứ tự: Bước 1: Chuyển giao nhiệm vụ; Bước 2: Thực hiện nhiệm vụ; Bước 3: Báo cáo, thảo luận; Bước 4: Kết luận, nhận định)" },
                    teacherStudentActivities: { type: Type.STRING, description: "Kịch bản GV-HS SIÊU CHI TIẾT. NẾU LÀ NÂNG CẤP GIÁO ÁN, BẮT BUỘC COPY-PASTE 100% TOÀN BỘ NỘI DUNG TỪ BẢN GỐC (dài bao nhiêu chép bấy nhiêu, TUYỆT ĐỐI KHÔNG TÓM TẮT). Phần nội dung chốt kiến thức/kết luận của giáo viên PHẢI được bọc trong thẻ <bold>...</bold> để in đậm. Chỉ phần nội dung tích hợp NLS/NL AI đã được đối chiếu (hành vi, prompt nếu có, tiêu chí, mã/tham chiếu) mới bọc trong thẻ <ai>...</ai> để bôi đỏ." },
                    expectedProduct: { type: Type.STRING, description: "Dự kiến sản phẩm (Chi tiết kết quả mong đợi)" },
                  },
                  required: ["stepName", "teacherStudentActivities", "expectedProduct"],
                },
              },
            },
            required: ["name", "periodLabel", "objective", "content", "studentNotes", "product", "procedure"],
          },
        },
        assessment: { type: Type.ARRAY, items: { type: Type.STRING } },
        appendix: {
          type: Type.OBJECT,
          properties: {
            prompts: { type: Type.ARRAY, items: { type: Type.STRING } },
            checklist: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["prompts", "checklist"],
        },
        aiUsageLog: {
          type: Type.ARRAY,
          description: "PHIẾU SỬ DỤNG AI (Mục 7 — dành cho Học sinh). Tạo một phiếu cho MỖI hoạt động có tích hợp AI trong bài. AI CHỈ điền trước ① (câu lệnh Prompt mẫu GV gợi ý) và ② (nguồn kiểm chứng GV cung cấp). Các ô ③④⑤ dành cho học sinh và GV tự điền tay khi in phiếu — KHÔNG điền vào schema.",
          items: {
            type: Type.OBJECT,
            properties: {
              activityName: { type: Type.STRING, description: "Tên hoạt động trong bài có tích hợp AI" },
              aiPromptUsed: { type: Type.STRING, description: "① GV gợi ý: Mẫu câu lệnh Prompt cụ thể, chi tiết mà học sinh sẽ nhập vào công cụ AI (ChatGPT, Gemini...) để thực hiện nhiệm vụ học tập. Viết hoàn chỉnh như một câu lệnh thực tế." },
              verificationSource: { type: Type.STRING, description: "② GV cung cấp: Nguồn tài liệu chính thống học sinh dùng để kiểm chứng kết quả AI (VD: SGK trang..., tài liệu chính phủ, atlas...). Ghi rõ tên tài liệu, trang số." },
            },
            required: ["activityName", "aiPromptUsed", "verificationSource"],
          }
        },
      },
      required: ["title", "objectives", "materials", "activities", "assessment", "appendix"],
    });
    return sanitizeCompetencyCodesDeep(generated, input.grade, authorizedAiCodes, authorizedNlsCodes);
  } catch (error) {
    console.error("Error generating lesson plan:", error);
    throw error;
  }
};

export const generateEducationalPlan = async (subject: string, grade: string, province?: string, referencePlan?: any[], options?: { useLaTeX?: boolean, detailDrawings?: boolean, customCurriculumData?: any[], curriculumDbData?: any[], socialIntegrations?: string[] }) => {
  const formattingNeed = options?.useLaTeX || options?.detailDrawings || needsScientificFormatting(subject);
  const englishConstraint = (subject === "Tiếng Anh" || subject.toLowerCase().includes("english")) ? "\\nLỆNH ĐẶC BIỆT TỐI QUAN TRỌNG: Môn học là Tiếng Anh nên TOÀN BỘ nội dung kế hoạch giáo dục PHẢI ĐƯỢC VIẾT 100% BẰNG TIẾNG ANH (ENGLISH). ĐẶC BIỆT, KHI NỘI DUNG TÍCH HỢP NĂNG LỰC SỐ (NLS) VÀ NĂNG LỰC AI (NLAI) ĐƯỢC KHỞI TẠO, CHÚNG CŨNG BẮT BUỘC PHẢI ĐƯỢC VIẾT BẰNG TIẾNG ANH." : "";
  const competencyGuardrails = getCompetencyGuardrails(subject, grade);
  const normalizedCurriculumDbData = options?.curriculumDbData ? normalizeCurriculumCompetencyData(options.curriculumDbData, grade) : undefined;
  const socialSelectionPrompt = buildSocialIntegrationSelectionPrompt(options?.socialIntegrations);

  const curriculumConstraint = options?.customCurriculumData
    ? `DỮ LIỆU BÀI HỌC BẮT BUỘC TỪ PHỤ LỤC DO GIÁO VIÊN CUNG CẤP:
${JSON.stringify(options.customCurriculumData, null, 2)}
LỆNH VỀ TÊN BÀI HỌC TỐI CAO: TUYỆT ĐỐI tuân thủ danh sách tên bài học và số tiết trong mảng dữ liệu trên.KHÔNG SỬ DỤNG DỮ LIỆU MẶC ĐỊNH KHÁC.`
    : normalizedCurriculumDbData ? `DỮ LIỆU BÀI HỌC TỪ HỆ THỐNG:
${JSON.stringify(normalizedCurriculumDbData.map(l => ({ topic: l.topic, indicatorCode: l.indicatorCode, indicatorNote: l.indicatorNote })), null, 2)}
LỆNH TỐI CẤP: Bạn BẮT BUỘC dùng chính xác danh sách bài học. Trước mã AI phải ghi đúng tên thành phần, hành vi học sinh và YCCĐ. Nếu indicatorCode hợp lệ và khớp YCCĐ thì dùng chính xác mã đó; nếu thiếu mã nhưng bài có điểm chạm NL AI rõ thì phải chọn thành phần/chủ đề và sinh một mã đầy đủ đúng lớp/YCCĐ, ví dụ NLa-12.A1.1. Không ghi “Cần đối chiếu mã AI”; không có điểm chạm thì ghi “Không tích hợp NL AI”.`
      : CURRICULUM_DATA;

  const referenceRows = Array.isArray(referencePlan)
    ? referencePlan.map((i, index) => ({
        stt: index + 1,
        thoi_gian: i.time || i.timing || "",
        thu_tu_tiet: i.order || "",
        bai_hoc: i.lessonContent || i.lesson || i.topic || i.lessonName || i.title || "",
        so_tiet: i.periods || "",
        yccd_CT2018: i.lessonGoal || i.yccd || [i.objectivesKnowledge, i.objectivesCompetency, i.objectivesQuality].filter(Boolean).join("; "),
        nls_TT02_CV3456: i.digitalCompetencyTT02 || i.digitalCompetency || i.nls || "",
        nl_ai_2422: i.aiCompetency2422Integrated || i.aiCompetency2422 || i.ai || i.nlai || "",
        noi_dung_giao_duc_tich_hop: i.socialIntegration || i.integratedEducation || i.social || "",
        ghi_chu_dong_bo: i.sourceStatus || ""
      }))
    : [];

  const educationalPlanAuthorizedAiCodes = collectAuthorizedAiCodes(grade, JSON.stringify(referenceRows), JSON.stringify(options?.customCurriculumData || []), JSON.stringify(normalizedCurriculumDbData || []));
  const educationalPlanAuthorizedNlsCodes = collectAuthorizedNlsCodes(grade, JSON.stringify(referenceRows), JSON.stringify(options?.customCurriculumData || []), JSON.stringify(normalizedCurriculumDbData || []));

  const referencePrompt = referenceRows.length
    ? `DỰA TRÊN KẾ HOẠCH TỔ CHUYÊN MÔN SAU ĐÂY ĐỂ ĐỒNG NHẤT NỘI DUNG(BẮT BUỘC):
       ${JSON.stringify(referenceRows, null, 2)}

       Yêu cầu bắt buộc:
       - Phải tạo ĐÚNG ${referenceRows.length} dòng PL3, tương ứng từng dòng PL1 theo đúng thứ tự. Không bỏ dòng, không gộp dòng, không tự rút gọn.
       - Phải giữ nguyên tên bài học, số tiết, thời điểm, YCCĐ CT 2018, nội dung giáo dục tích hợp, NLS TT02/CV3456 và NL AI 2422 đã có trong PL1.
       - PL3 chỉ được khai triển thêm thiết bị, học liệu, địa điểm và phương án tổ chức; không thay thế hoặc làm mất dữ liệu PL1.
       - KHÔNG chép lại nội dung giáo dục tích hợp, mã/nội dung NLS, NL AI hoặc YCCĐ vào digitalToolsAndAI.method/tools. Nội dung giáo dục tích hợp chỉ ghi tại socialIntegration; mã NLS/NL AI chỉ ghi tại digitalCompetency.
       - Nếu một ô PL1 ghi "Không tích hợp - lý do: ..." thì phải giữ đủ lý do đó trong PL3.`
    : "";

  const prompt = `
    ${CONTENT_INTEGRITY_RULES}

    Hãy đóng vai chuyên gia giáo dục phổ thông tại Việt Nam. Xây dựng "Khung kế hoạch giáo dục của giáo viên"(Phân phối chương trình cả năm) cho:
    - Môn: ${subject}
    - Lớp: ${grade}
    ${subject === "Giáo dục địa phương" && province ? `- Địa phương (Tỉnh/Thành phố): ${province}` : ""}

    ${referencePrompt}

    ${AI_SUBJECT_GUIDELINES}
    ${SOCIAL_INTEGRATION_GUIDELINES}
    ${competencyGuardrails}
    ${AI_COMPETENCY_ORDER_RULE}
    ${socialSelectionPrompt}
    ${curriculumConstraint}
    ${formattingNeed ? FORMATTING_INSTRUCTIONS : ""}
    ${englishConstraint}

    YÊU CẦU QUAN TRỌNG VỀ ĐỘ CHÍNH XÁC:
    1. TUÂN THỦ CHƯƠNG TRÌNH GDPT 2018 VÀ SÁCH KNTT:
    - LƯU Ý MÔN ĐỊA LÍ VÀ CÁC MÔN CÒN LẠI: Nội dung, trật tự và tên bài học BẮT BUỘC PHẢI KHỚP TUYỆT ĐỐI VỚI BỘ SÁCH "KẾT NỐI TRI THỨC VỚI CUỘC SỐNG" của NXB Giáo dục Việt Nam. Đảm bảo đầy đủ các đơn vị kiến thức, không được thiếu bài. TUYỆT ĐỐI KHÔNG sử dụng cấu trúc của Cánh Diều hay Chân trời sáng tạo.
    - ĐỐI VỚI MÔN GIÁO DỤC ĐỊA PHƯƠNG: Chỉ trong trường hợp này mới sử dụng nội dung đặc thù của ${province}.

    ${curriculumConstraint}
    ${referenceRows.length ? "LƯU Ý ĐỒNG NHẤT PL3 TỪ PL1: PL1 ở trên là nguồn dữ liệu ưu tiên cao nhất. Dữ liệu chương trình mặc định chỉ dùng để kiểm tra và bù ô trống, tuyệt đối không được làm mất hoặc thay thế dòng PL1." : ""}

    2. Cấu trúc bảng Phân phối chương trình:
    - Thứ tự tiết: Số thứ tự tiết học.
       - Bài học: Tên bài học theo chương trình.
       - Số tiết: Số lượng tiết dành cho bài học đó.
       - Thời điểm: Tuần hoặc tháng thực hiện(Ví dụ: Tuần 1).
       - Thiết bị dạy học: Các thiết bị truyền thống cần thiết.
       - Công cụ số và AI (trường dữ liệu bắt buộc, nội dung có điều kiện): chỉ nêu công cụ khi hoạt động thật sự cần; nếu không dùng ghi “Không sử dụng - không cần cho YCCĐ này”:
    + Phương án triển khai: Sử dụng tình huống giả định, nghiên cứu tình huống(case study) hay có công cụ AI trực tiếp.
         + Học liệu / công cụ cụ thể: Các bài báo, video phân tích, các bộ dữ liệu giả định, hoặc tên phần mềm / nền tảng AI sẽ sử dụng.
         + KHÔNG ghi lại mã NLS, mã NL AI, YCCĐ, TT 02/CV 3456 hoặc QĐ 2422 trong phần Công cụ số và AI. Những nội dung này chỉ nằm ở cột "Định hướng năng lực số/AI".
       - Địa điểm dạy học: Lớp học, phòng máy tính, thư viện...
    - Định hướng năng lực số/AI: Ghi cô đọng theo chuỗi YCCĐ -> hành vi HS -> sản phẩm -> tiêu chí -> mã/tham chiếu. Mã NLS theo đúng mức lớp. Với NL AI, khi có điểm chạm rõ phải ghi đúng tên thành phần và một mã đầy đủ theo lớp/chủ đề/chỉ báo, ví dụ NLa-12.A1.1; mã phải bám YCCĐ và hành vi của bài, không ghi chung chung “Cần đối chiếu mã AI”.
       - ĐỊNH DẠNG VĂN BẢN(RẤT QUAN TRỌNG): TUYỆT ĐỐI KHÔNG SỬ DỤNG MÃ LATEX($...$, \sin, \cos) trong bảng này.Các công thức toán / lý / hóa phải chuyển thành text thường dễ đọc nhất(vd: y = sin x).
    - Nội dung giáo dục tích hợp/lồng ghép (socialIntegration): Chỉ ghi khi bài có điểm chạm tự nhiên; bắt buộc theo chuỗi Chủ đề -> Căn cứ YCCĐ -> Hành vi học sinh -> Sản phẩm -> Tiêu chí/minh chứng. Không phù hợp thì để chuỗi rỗng.

    2. NGUYÊN TẮC TÍCH HỢP THEO BỘ QUY TẮC KHÓA:
    - Rà soát toàn bộ bài học trong chương trình.
       - KHÔNG tích hợp dàn trải hoặc khiên cưỡng.Chỉ thực hiện khi có "điểm chạm" logic và tự nhiên giữa kiến thức môn học và năng lực AI.
       - Nếu bài không phù hợp, tại digitalCompetency ghi “Không tích hợp - lý do: ...”; không ép dùng công cụ số/AI.

    3. Định dạng đầu ra: Trình bày dưới dạng JSON Array các đối tượng.
    ${referenceRows.length ? `LỆNH KIỂM ĐẾM PL1 -> PL3: JSON Array đầu ra bắt buộc có đúng ${referenceRows.length} object, không ít hơn. Mỗi object PL3 phải chứa đủ dữ liệu đồng bộ từ object PL1 cùng vị trí, gồm cả noi_dung_giao_duc_tich_hop.` : ""}
  `;

  try {
    const response = await callGeminiWithFallback(prompt, {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          order: { type: Type.STRING, description: "Thứ tự tiết" },
          lesson: { type: Type.STRING, description: "Bài học" },
          periods: { type: Type.STRING, description: "Số tiết" },
          timing: { type: Type.STRING, description: "Thời điểm" },
          equipment: { type: Type.STRING, description: "Thiết bị dạy học truyền thống" },
          digitalToolsAndAI: {
            type: Type.OBJECT,
            properties: {
              method: { type: Type.STRING, description: "Phương án triển khai (Tình huống giả định/Case study/AI trực tiếp)" },
              tools: { type: Type.STRING, description: "Học liệu / Công cụ cụ thể" },
            },
            required: ["method", "tools"],
          },
          location: { type: Type.STRING, description: "Địa điểm dạy học" },
          digitalCompetency: { type: Type.STRING, description: "Định hướng năng lực số (AI)" },
          socialIntegration: { type: Type.STRING, description: "Nội dung giáo dục tích hợp/lồng ghép đúng vị trí" },
        },
        required: ["order", "lesson", "periods", "timing", "equipment", "digitalToolsAndAI", "location", "digitalCompetency", "socialIntegration"],
      },
    });

    // Robust array extraction
    let parsed = response;
    if (parsed && !Array.isArray(parsed) && typeof parsed === 'object') {
      const keys = Object.keys(parsed);
      for (const k of keys) {
        if (Array.isArray(parsed[k])) {
          parsed = parsed[k];
          break;
        }
      }
    }

    if (!Array.isArray(parsed)) {
      console.error("AI returned non-array for educational plan:", parsed);
      return []; // Return empty array to avoid crash
    }

    return sanitizeGeneratedCompetencyRows(parsed, grade, educationalPlanAuthorizedAiCodes, educationalPlanAuthorizedNlsCodes);
  } catch (error) {
    console.error("Error generating educational plan:", error);
    throw error;
  }
};

export const generateDepartmentPlan = async (subject: string, grade: string, province?: string, options?: { useLaTeX?: boolean, detailDrawings?: boolean, customCurriculumData?: any[], curriculumDbData?: any[], socialIntegrations?: string[] }) => {
  const formattingNeed = options?.useLaTeX || options?.detailDrawings || needsScientificFormatting(subject);
  const englishConstraint = (subject === "Tiếng Anh" || subject.toLowerCase().includes("english")) ? "\\nLỆNH ĐẶC BIỆT TỐI QUAN TRỌNG: Môn học là Tiếng Anh nên TOÀN BỘ nội dung kế hoạch giáo dục PHẢI ĐƯỢC VIẾT 100% BẰNG TIẾNG ANH (ENGLISH). ĐẶC BIỆT, KHI NỘI DUNG TÍCH HỢP NĂNG LỰC SỐ (NLS) VÀ NĂNG LỰC AI (NLAI) ĐƯỢC KHỞI TẠO, CHÚNG CŨNG BẮT BUỘC PHẢI ĐƯỢC VIẾT BẰNG TIẾNG ANH." : "";
  const competencyGuardrails = getCompetencyGuardrails(subject, grade);
  const geographyCurriculum = getGeographyCurriculumByGrade(grade);
  const socialSelectionPrompt = buildSocialIntegrationSelectionPrompt(options?.socialIntegrations);
  const departmentAuthorizedAiCodes = collectAuthorizedAiCodes(grade, JSON.stringify(options?.customCurriculumData || []), JSON.stringify(options?.curriculumDbData || []));
  const departmentAuthorizedNlsCodes = collectAuthorizedNlsCodes(grade, JSON.stringify(options?.customCurriculumData || []), JSON.stringify(options?.curriculumDbData || []));
  const isGeographyThptBatch = isStandaloneGeographySubject(subject) && ["10", "11", "12"].includes(String(grade).trim()) && !options?.customCurriculumData && geographyCurriculum.length > 0;

  // ===== BATCH PROCESSING FOR CUSTOM CURRICULUM DATA (USER UPLOADED) =====
  if (Array.isArray(options?.customCurriculumData) && options.customCurriculumData.length > 0) {
    const customList = options.customCurriculumData;
    const CUSTOM_BATCH_SIZE = 16;
    const allBatchResults: any[] = [];
    let weekCounter = 1;

    for (let bIdx = 0; bIdx < customList.length; bIdx += CUSTOM_BATCH_SIZE) {
      const batch = customList.slice(bIdx, bIdx + CUSTOM_BATCH_SIZE);
      const batchNum = Math.floor(bIdx / CUSTOM_BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(customList.length / CUSTOM_BATCH_SIZE);

      const bLines = [
        CONTENT_INTEGRITY_RULES,
        "",
        `Bạn là Chuyên gia xây dựng Kế hoạch giáo dục Tổ chuyên môn tích hợp AI cho môn: ${subject}, lớp: ${grade}.`,
        "",
        AI_SUBJECT_GUIDELINES,
        SOCIAL_INTEGRATION_GUIDELINES,
        socialSelectionPrompt,
        competencyGuardrails,
        AI_COMPETENCY_ORDER_RULE,
        "",
        `DANH SÁCH ${batch.length} BÀI HỌC BẮT BUỘC TỪ PHỤ LỤC GỐC DO GIÁO VIÊN CUNG CẤP (Lô ${batchNum}/${totalBatches}, bắt đầu từ Tuần ${weekCounter}):`,
        JSON.stringify(batch, null, 2),
        "",
        "YÊU CẦU TUYỆT ĐỐI BẮT BUỘC:",
        `1. TẠO ĐÚNG ĐỦ ${batch.length} HÀNG cho ${batch.length} bài học trên. KHÔNG ĐƯỢC BỎ SÓT BÀI NÀO.`,
        "2. lessonGoal: SAO CHÉP Y NGUYÊN 100% nội dung YCCĐ từ dữ liệu trên. TUYỆT ĐỐI KHÔNG tóm tắt hay cắt xén.",
        "3. TÍCH HỢP NLS và NL AI chi khi YCCĐ của bài có điểm chạm rõ ràng. Mỗi ô BẮT BUỘC ghi đầy đủ chi tiết:",
        "   - digitalCompetencyTT02 (NLS):",
        "     Mã chỉ báo NLS: [Mã chuẩn TT02]; Thành phần NLS: [Tên thành phần]",
        "     - YCCĐ NLS: [Nội dung YCCĐ cụ thể]",
        "     - Hành vi HS: [Hành vi thao tác số cụ thể]",
        "     - Sản phẩm đầu ra: [Sản phẩm số cụ thể]",
        "   - aiCompetency2422Integrated (NL AI):",
        "     Thành phần NL AI: NL[a/b/c/d] - [Tên thành phần]; Khối lớp: [Lớp]; Chủ đề: [Mã chủ đề]; Mã chỉ báo NL AI: [Mã chuẩn QĐ 2422]",
        "     - Yêu cầu cần đạt AI: [Nội dung YCCĐ chuẩn theo QĐ 2422]",
        "     - Hành vi học sinh: [Hành vi tương tác/prompt/kiểm chứng của HS]",
        "     - Sản phẩm đầu ra: [Sản phẩm học tập cụ thể]",
        "     - Tiêu chí đánh giá: [Tiêu chí đánh giá & minh chứng kiểm chứng]",
        "   - Chủ đề A -> NLa (Tư duy lấy con người làm trung tâm)",
        "   - Chủ đề B -> NLb (Đạo đức AI, an toàn, pháp luật và trách nhiệm)",
        "   - Chủ đề C -> NLc (Các kĩ thuật và ứng dụng AI)",
        "   - Chủ đề D -> NLd (Thiết kế, thử nghiệm và cải tiến hệ thống AI)",
        `4. Phân bổ thời gian bắt đầu từ Tuần ${weekCounter}.`,
        "5. socialIntegration: chỉ ghi đúng bài có điểm chạm; bài không phù hợp thì để chuỗi rỗng.",
        "",
        `Đầu ra: JSON Array gồm đúng ${batch.length} object với các trường: time, lessonContent, periods, lessonGoal, socialIntegration, digitalCompetencyTT02, aiCompetency2422Integrated.`
      ];
      const batchPrompt = bLines.join("\n");

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
                aiCompetency2422Integrated: { type: 'STRING' as any },
                socialIntegration: { type: 'STRING' as any }
              },
              required: ['time', 'lessonContent', 'periods', 'lessonGoal', 'socialIntegration', 'digitalCompetencyTT02', 'aiCompetency2422Integrated'],
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
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${bModels[mi]}:generateContent?key=${bApiKey}`;
          const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(batchBody) });
          if (!res.ok) {
            const errText = await res.text();
            if (res.status === 429) throw new Error('QUOTA_EXHAUSTED');
            if (res.status === 401 || res.status === 403) throw new Error('API_KEY_INVALID');
            throw new Error(`HTTP ${res.status}: ${errText}`);
          }
          const bjson = await res.json();
          const btext = bjson?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!btext) throw new Error('Empty batch response');
          let bparsed: any = null;
          let bstripped = stripMarkdownJson(btext);
          try { bparsed = JSON.parse(bstripped); } catch {
            try {
              const ob = (bstripped.match(/{/g)||[]).length, cb = (bstripped.match(/}/g)||[]).length;
              const oa = (bstripped.match(/\[/g)||[]).length, ca = (bstripped.match(/]/g)||[]).length;
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
    if (allBatchResults.length > 0) return sanitizeGeneratedCompetencyRows(allBatchResults, grade, departmentAuthorizedAiCodes, departmentAuthorizedNlsCodes);
  }
  // ===== END BATCH PROCESSING FOR CUSTOM CURRICULUM DATA =====

  // ===== BATCH PROCESSING FOR DIA LI THPT (prevents output token truncation) =====
  if (isGeographyThptBatch) {
    const GEO_BATCH_SIZE = 22;
    const allBatchResults: any[] = [];
    let weekCounter = 1;
    const geoRulesForBatch = `${GEOGRAPHY_AI_RULES}\n${competencyGuardrails}`;

    for (let bIdx = 0; bIdx < geographyCurriculum.length; bIdx += GEO_BATCH_SIZE) {
      const batch = geographyCurriculum.slice(bIdx, bIdx + GEO_BATCH_SIZE);
      const batchNum = Math.floor(bIdx / GEO_BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(geographyCurriculum.length / GEO_BATCH_SIZE);

      const bLines = [
        CONTENT_INTEGRITY_RULES,
        "",
        "Ban la Chuyen gia xay dung Ke hoach giao duc To chuyen mon tich hop AI cho mon: Dia li, lop: " + grade + ".",
        'TUYET DOI: Dung bo sach "Ket noi tri thuc voi cuoc song". KHONG dung sach Canh Dieu hay Chan Troi Sang Tao.',
        "",
        AI_SUBJECT_GUIDELINES,
        SOCIAL_INTEGRATION_GUIDELINES,
        socialSelectionPrompt,
        geoRulesForBatch,
        "",
        "DANH SACH " + batch.length + " BAI HOC CAN TAO (Lo " + batchNum + "/" + totalBatches + ", bat dau Tuan " + weekCounter + "):",
        JSON.stringify(batch, null, 2),
        "",
        "YEU CAU TUYET DOI BAT BUOC:",
        "1. TAO DUNG DU " + batch.length + " HANG cho " + batch.length + " bai tren. KHONG DUOC BO SOT BAI NAO.",
        "2. lessonGoal: SAO CHEP Y NGUYEN 100% noi dung yccd tu du lieu tren. TUYET DOI KHONG tom tat hay cat xen.",
        "3. TICH HOP NLS va NL AI chi khi YCCD cua bai co diem cham ro rang. Neu khong du can cu, ghi 'Khong tich hop - ly do: ...' hoac 'Khong gan ma - ly do: ...'. KHONG duoc ghi cut 'Khong'.",
        "4. digitalCompetencyTT02: Bắt buộc ghi đủ 4 mục chi tiết: Mã chỉ báo NLS, Thành phần NLS, - YCCĐ NLS: ..., - Hành vi HS: ..., - Sản phẩm đầu ra: ...",
        "5. aiCompetency2422Integrated: Bắt buộc ghi đủ 5 mục chi tiết: Thành phần NL AI: NL[a/b/c/d] - [Tên]; Khối lớp: [Lớp]; Chủ đề: [Mã]; Mã chỉ báo NL AI: [Mã chuẩn]\n- Yêu cầu cần đạt AI: [YCCĐ]\n- Hành vi học sinh: [Hành vi cụ thể]\n- Sản phẩm đầu ra: [Sản phẩm]\n- Tiêu chí đánh giá: [Tiêu chí & kiểm chứng]",
        AI_COMPETENCY_ORDER_RULE,
        "   - Mach A: Tu duy lay con nguoi lam trung tam | Mach B: Dao duc & trach nhiem | Mach C: Ky thuat & ung dung | Mach D: Giai quyet van de",
        "6. Phan bo thoi gian bat dau tu Tuan " + weekCounter + ".",
        "7. socialIntegration: chi ghi dung bai co diem cham; theo thu tu Chu de -> Can cu YCCD -> Hanh vi HS -> San pham -> Tieu chi/minh chung. Bai khong phu hop thi de chuoi rong.",
        "",
        "Dau ra: JSON Array gom dung " + batch.length + " object voi cac truong: time, lessonContent, periods, lessonGoal, socialIntegration, digitalCompetencyTT02, aiCompetency2422Integrated."
      ];
      const batchPrompt = bLines.join("\n");

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
                aiCompetency2422Integrated: { type: 'STRING' as any },
                socialIntegration: { type: 'STRING' as any }
              },
              required: ['time', 'lessonContent', 'periods', 'lessonGoal', 'socialIntegration', 'digitalCompetencyTT02', 'aiCompetency2422Integrated'],
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
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${bModels[mi]}:generateContent?key=${bApiKey}`;
          const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(batchBody) });
          if (!res.ok) {
            const errText = await res.text();
            if (res.status === 429) throw new Error('QUOTA_EXHAUSTED');
            if (res.status === 401 || res.status === 403) throw new Error('API_KEY_INVALID');
            throw new Error(`HTTP ${res.status}: ${errText}`);
          }
          const bjson = await res.json();
          const btext = bjson?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!btext) throw new Error('Empty batch response');
          let bparsed: any = null;
          let bstripped = stripMarkdownJson(btext);
          try { bparsed = JSON.parse(bstripped); } catch {
            try {
              const ob = (bstripped.match(/{/g)||[]).length, cb = (bstripped.match(/}/g)||[]).length;
              const oa = (bstripped.match(/\[/g)||[]).length, ca = (bstripped.match(/]/g)||[]).length;
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
    if (allBatchResults.length > 0) return sanitizeGeneratedCompetencyRows(allBatchResults, grade, departmentAuthorizedAiCodes, departmentAuthorizedNlsCodes);
  }
  // ===== END BATCH PROCESSING FOR DIA LI THPT =====

    const overrideCurriculumDbData = isStandaloneGeographySubject(subject) && geographyCurriculum.length > 0 ? undefined : options?.curriculumDbData;
    const normalizedOverrideCurriculumDbData = overrideCurriculumDbData ? normalizeCurriculumCompetencyData(overrideCurriculumDbData, grade) : undefined;
    const systemCurriculum = normalizedOverrideCurriculumDbData ? `DỮ LIỆU BÀI HỌC TỪ HỆ THỐNG:
${JSON.stringify(normalizedOverrideCurriculumDbData.map(l => ({ topic: l.topic, indicatorCode: l.indicatorCode, indicatorNote: l.indicatorNote, yccd: [l.objectivesKnowledge, l.objectivesCompetency, l.objectivesQuality].filter(Boolean).join("; ") })), null, 2)}
LỆNH TỐI CẤP: Bạn BẮT BUỘC phải tạo KHTCM chứa toàn bộ danh sách bài học trên. Tại cột "Yêu cầu cần đạt CT 2018" (lessonGoal), BẮT BUỘC lấy nội dung "yccd" tương ứng. Tại cột "Yêu cầu cần đạt 2422" (aiCompetency2422), trước mã AI phải ghi đúng tên thành phần, hành vi học sinh và YCCĐ. Nếu indicatorCode hợp lệ và khớp YCCĐ thì dùng chính xác mã đó; nếu thiếu mã nhưng có điểm chạm NL AI rõ thì phải chọn thành phần/chủ đề và sinh mã đầy đủ đúng lớp/YCCĐ, ví dụ NLa-12.A1.1. Không ghi “Cần đối chiếu mã AI”; không có điểm chạm thì ghi “Không tích hợp NL AI”.
LƯU Ý VỀ DỮ LIỆU CÒN THIẾU: Không tự bổ sung tên bài, YCCĐ hoặc mã để đủ 35 tuần khi nguồn chưa cung cấp. Chỉ tạo các dòng có trong dữ liệu; nếu thiếu nguồn chính thức phải báo “Chưa đủ nguồn chính thức” thay vì suy đoán.` : "";

    let defaultCurriculum = "";
    if (subject === "Giáo dục địa phương") {
        defaultCurriculum = CURRICULUM_DATA_GDDP;
    } else if (isStandaloneGeographySubject(subject) && geographyCurriculum.length > 0) {
        defaultCurriculum = `MỤC LỤC VÀ YÊU CẦU CẦN ĐẠT (YCCĐ) CHÍNH XÁC TỪNG BÀI - ĐỊA LÍ ${grade} KẾT NỐI TRI THỨC VỚI CUỘC SỐNG:\n${JSON.stringify(geographyCurriculum, null, 2)}`;
    }

    const curriculumConstraint = options?.customCurriculumData
    ? `DỮ LIỆU BÀI HỌC BẮT BUỘC TỪ PHỤ LỤC DO GIÁO VIÊN CUNG CẤP:
${JSON.stringify(options.customCurriculumData, null, 2)}
LỆNH VỀ TÊN BÀI HỌC TỐI CAO: TUYỆT ĐỐI tuân thủ danh sách tên bài học và số tiết trong mảng dữ liệu trên. Phải sinh KHTCM cho TOÀN BỘ các bài học được mô tả trong mảng này. KHÔNG SỬ DỤNG DỮ LIỆU CHƯƠNG TRÌNH MẶC ĐỊNH KHÁC.
LƯU Ý VỀ YÊU CẦU CẦN ĐẠT: Nếu trong mảng dữ liệu trên có chứa thuộc tính "yccd" (Yêu cầu cần đạt), bạn BẮT BUỘC phải sao chép Y NGUYÊN nội dung "yccd" đó vào cột Yêu cầu cần đạt CT 2018 (lessonGoal), TUYỆT ĐỐI KHÔNG ĐƯỢC TỰ Ý RÚT GỌN HAY CẮT XÉN.`
    : `${systemCurriculum}\n\nDANH SÁCH BÀI HỌC BỔ SUNG TỪ HỆ THỐNG:\n${defaultCurriculum}`;
    const geographyRules = isGeographyLikeSubject(subject) ? GEOGRAPHY_AI_RULES : "";

  const prompt = `
    ${CONTENT_INTEGRITY_RULES}
    ${competencyGuardrails}

    Bạn là một Chuyên gia xây dựng chương trình giáo dục.Hãy giúp tôi lập Kế hoạch giáo dục tổ chuyên môn tích hợp nội dung giáo dục AI cho môn: ${subject}, lớp: ${grade}${subject === "Giáo dục địa phương" && province ? `, tại địa phương: ${province}` : ""}.

    YÊU CẦU QUAN TRỌNG VỀ TÊN BÀI HỌC VÀ CHƯƠNG TRÌNH:
    1. Nếu là môn "Giáo dục địa phương": Phải bám sát chương trình của ${province}.
    2. ĐỐI VỚI MÔN ĐỊA LÍ VÀ CÁC MÔN KHÁC: TUYỆT ĐỐI BẮT BUỘC tuân thủ danh mục bài học và đơn vị kiến thức của BỘ SÁCH "KẾT NỐI TRI THỨC VỚI CUỘC SỐNG". KHÔNG ĐƯỢC TỰ BỊA RA BÀI HỌC HAY SỬ DỤNG BỘ SÁCH KHÁC. ĐẢM BẢO ĐỦ SỐ BÀI TRONG SGK KNTT.

    ${AI_SUBJECT_GUIDELINES}
    ${SOCIAL_INTEGRATION_GUIDELINES}
    ${socialSelectionPrompt}
    ${curriculumConstraint}
    ${geographyRules}
    ${AI_COMPETENCY_ORDER_RULE}

    ${formattingNeed ? FORMATTING_INSTRUCTIONS : ""}
    ${englishConstraint}

    Nhiệm vụ cụ thể:
    1. Rà soát toàn bộ dữ liệu nguồn: không bỏ sót, gộp hoặc tự thêm bài/chuyên đề/kiểm tra. Chỉ lập đủ 35 tuần khi nguồn chính thức đã cung cấp đủ; không tự bịa dòng để lấp lịch.
    1b. KHÔNG ĐƯỢC ĐỂ THIẾU TRƯỜNG: Mỗi dòng bắt buộc có đủ 7 trường time, lessonContent, periods, lessonGoal, socialIntegration, digitalCompetencyTT02, aiCompetency2422Integrated. Riêng socialIntegration được để chuỗi rỗng khi không có điểm chạm; NLS/NL AI không phù hợp phải ghi rõ lý do.
    2. TÍCH HỢP NLS VÀ NL AI THEO YCCĐ, KHÔNG GƯỢNG ÉP:
    - Chỉ tích hợp Năng lực số (NLS) và Năng lực AI (NL AI) khi YCCĐ của bài có thao tác phù hợp: khai thác dữ liệu, kiểm chứng nguồn, tạo sản phẩm số, phân tích biểu đồ/bản đồ/bảng số liệu, mô phỏng, thiết kế, đánh giá rủi ro...
    - Không đặt chỉ tiêu 95%/100% số bài. Nếu bài không có điểm chạm rõ, ghi "Không tích hợp - lý do: ..." hoặc "Không gán mã - lý do: ..." và nêu lý do ngắn.
    - Mỗi mã được đề xuất phải có chuỗi chứng minh: YCCĐ -> thao tác học sinh -> công cụ/dữ liệu -> sản phẩm/minh chứng -> mã.
    3. Ánh xạ Năng lực:
    - Thời gian (time): Ước lượng thời gian thực hiện (Ví dụ: Học kì I, Tháng 9, Tuần 1...).
       - Nội dung (lessonContent): Tên bài học, chủ đề, chuyên đề hoặc tên bài kiểm tra. Phải lấy từ danh sách gốc.
       - Số tiết (periods): Số lượng tiết học của bài học.
       - Yêu cầu cần đạt CT 2018 (lessonGoal): BẮT BUỘC SAO CHÉP Y NGUYÊN 100% nội dung "yccd" (hoặc "YCCĐ") được cung cấp trong danh sách gốc cho từng bài học/chuyên đề/kiểm tra tương ứng. BẠN KHÔNG ĐƯỢC PHÉP TÓM TẮT HAY CẮT XÉN YCCĐ GỐC!
       - Năng lực số (digitalCompetencyTT02): dùng mức tham chiếu đúng lớp theo bộ quy tắc khóa; mỗi dòng chỉ 1-2 mã có hành vi và minh chứng. Không phù hợp thì ghi “Không tích hợp - lý do: ...”.
       - Mục tiêu & YCCĐ 2422 Tích hợp GD AI (aiCompetency2422Integrated): Trước khi ghi mã/tham chiếu AI phải ghi tên thành phần; bám đúng lớp, chủ đề và nguyên văn YCCĐ QĐ 2422. Nội dung bắt buộc theo thứ tự: Tên thành phần năng lực AI -> hành vi học sinh -> yêu cầu cần đạt AI -> mã NL AI -> sản phẩm -> tiêu chí -> minh chứng. Với bài có indicatorCode hợp lệ từ hệ thống, vẫn phải kiểm tra YCCĐ trước khi dùng. Với bài tự đề xuất, không bịa mã; nếu thiếu căn cứ ghi "Không tích hợp/Không gán mã - lý do: ..." kèm lý do cụ thể, không ghi cụt "Không".

       - Nội dung giáo dục tích hợp/lồng ghép (socialIntegration): Chỉ chọn trong danh mục giáo viên đã chọn và chỉ đặt ở bài có điểm chạm tự nhiên; ghi Chủ đề -> Căn cứ YCCĐ -> Hành vi học sinh -> Sản phẩm -> Tiêu chí/minh chứng. Không phù hợp thì để chuỗi rỗng.
       - Mạch nội dung AI:
    - ĐỊNH DẠNG VĂN BẢN (RẤT QUAN TRỌNG): TUYỆT ĐỐI KHÔNG SỬ DỤNG MÃ LATEX($...$, \\sin, \\cos) HOẶC CÁC KÝ HIỆU ĐẶC BIỆT KÍCH ỨNG LỖI. Các công thức toán/lý/hóa phải được viết dưới dạng văn bản thường.
           * NLa(A): Tư duy lấy con người làm trung tâm.
           * NLb(B): Đạo đức và trách nhiệm xã hội.
           * NLc(C): Kỹ thuật và ứng dụng.
           * NLd(D): Giải quyết vấn đề và thiết kế hệ thống.
       * Lưu ý: Đối với các môn ngoài Tin học, ưu tiên trọng tâm vào NLa và NLb.
    4. Xây dựng kế hoạch: Đảm bảo nội dung tích hợp không làm thay đổi nội dung cốt lõi của môn học.

    Định dạng đầu ra: JSON Array các đối tượng với các trường sau:
    - time: Thời gian (Ví dụ: "Học kì I", "Tháng 9").
    - lessonContent: Nội dung bài học (Tên bài học hoặc nội dung trọng tâm).
    - periods: Số tiết (Ví dụ: "2", "1").
    - lessonGoal: Yêu cầu cần đạt CT 2018.
    - digitalCompetencyTT02: Năng lực số TT 02 (Mã và YCCĐ). Ghi "Không tích hợp - lý do: ..." nếu bài không phù hợp.
    - aiCompetency2422Integrated: Mục tiêu & YCCĐ 2422 Tích hợp GD AI. Kết hợp tên thành phần năng lực AI, hành vi học sinh, YCCĐ AI, mã/tham chiếu QĐ 2422, sản phẩm, tiêu chí và minh chứng theo đúng thứ tự. Ghi "Không tích hợp - lý do: ..." nếu bài không phù hợp.
    - socialIntegration: Nội dung giáo dục tích hợp/lồng ghép đúng vị trí; để chuỗi rỗng nếu không phù hợp.
  `;

  const apiKey = localStorage.getItem('GEMINI_API_KEY');
  if (!apiKey) throw new Error('API_KEY_REQUIRED');
  const startModel = localStorage.getItem('GEMINI_MODEL') || 'gemini-3.5-flash';
  const modelsToTry = getFallbackModels(startModel);

  const parts = [{ text: prompt }];
  const body = {
    contents: [{ role: 'user', parts }],
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
            aiCompetency2422Integrated: { type: 'STRING' as any },
            socialIntegration: { type: 'STRING' as any }
          },
          required: ['time', 'lessonContent', 'periods', 'lessonGoal', 'socialIntegration', 'digitalCompetencyTT02', 'aiCompetency2422Integrated'],
        },
      },
    },
  };

  for (let i = 0; i < modelsToTry.length; i++) {
    const currentModel = modelsToTry[i];
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        if (res.status === 429) throw new Error('QUOTA_EXHAUSTED');
        if (res.status === 401 || res.status === 403) throw new Error('API_KEY_INVALID');
        throw new Error(`HTTP ${res.status}: ${errText}`);
      }

      const json = await res.json();
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('AI trả về phản hồi rỗng khi sinh kế hoạch.');

      let parsed: any = null;
      let stripped = stripMarkdownJson(text);
      try {
        parsed = JSON.parse(stripped);
      } catch {
        // Fallback: try to repair truncated JSON arrays
        try {
          // 1. If it ends with an unclosed string, close it
          if (stripped.lastIndexOf('"') > stripped.lastIndexOf('}') && stripped.lastIndexOf('"') > stripped.lastIndexOf(']')) {
            // Count quotes to see if it's open
            const quoteCount = (stripped.match(/"/g) || []).length;
            if (quoteCount % 2 !== 0) {
              stripped += '"';
            }
          }
          // 2. Find unclosed objects/arrays
          const openBraces = (stripped.match(/\{/g) || []).length;
          const closeBraces = (stripped.match(/\}/g) || []).length;
          const openBrackets = (stripped.match(/\[/g) || []).length;
          const closeBrackets = (stripped.match(/\]/g) || []).length;

          for (let i = 0; i < openBraces - closeBraces; i++) stripped += '}';
          for (let i = 0; i < openBrackets - closeBrackets; i++) stripped += ']';

          parsed = JSON.parse(stripped);
        } catch { /* ignore */ }
      }
      if (parsed && !Array.isArray(parsed) && typeof parsed === 'object') {
        const keys = Object.keys(parsed);
        for (const k of keys) {
          if (Array.isArray(parsed[k])) { parsed = parsed[k]; break; }
        }
      }
      if (!Array.isArray(parsed)) {
        const match = text.match(/\[[\s\S]*\]/);
        if (match) try { parsed = JSON.parse(stripMarkdownJson(match[0])); } catch { /* ignore */ }
      }

      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error(`Không trích xuất được kế hoạch. AI trả về: ${text.substring(0, 200)}`);
      }
      return sanitizeGeneratedCompetencyRows(parsed, grade, departmentAuthorizedAiCodes, departmentAuthorizedNlsCodes);

    } catch (err: any) {
      console.error(`[generateDepartmentPlan] Lỗi với model ${currentModel}:`, err);
      const isApiKeyInvalid = err.message?.startsWith('API_KEY_INVALID') || err.message?.includes('401');
      const isQuota = err.message?.includes('QUOTA_EXHAUSTED');
      const isJsonError = err.message?.includes('Không trích xuất được kế hoạch');
      const isLast = i === modelsToTry.length - 1;

      if (isApiKeyInvalid) throw new Error('API_KEY_INVALID');
      if (isJsonError) throw err; // Ngừng ngay nếu AI trả về JSON lỗi/cắt cụt, chuyển model yếu hơn không giải quyết được

      if (isLast) {
        if (isQuota) throw new Error('QUOTA_EXHAUSTED');
        throw err;
      }
      await new Promise(r => setTimeout(r, 1500));
    }
  }
  throw new Error('Tất cả models đều thất bại.');
};

export const generateCompetencyEvaluation = async (lessonPlan: any) => {
  const objectives = lessonPlan?.objectives || {};
  const preservedLessonText = typeof lessonPlan?.preservedLessonText === "string"
    ? lessonPlan.preservedLessonText.slice(0, 18000)
    : "";
  const preservationContext = preservedLessonText
    ? `
    TOÀN VĂN GIÁO ÁN GỐC ĐÃ NÂNG CẤP (bản đọc từ DOCX đã bảo toàn):
    """
    ${preservedLessonText}
    """

    Báo cáo bảo toàn DOCX: ${JSON.stringify(lessonPlan?.preservationReport || {})}
    Ghi chú bắt buộc: Thiết kế đánh giá dựa trên nội dung giáo án DOCX gốc đã được chèn trực tiếp. Không viết lại giáo án, không thay thế giáo án, không rút gọn hoặc bỏ sót nội dung gốc. Nếu giáo án có bảng số liệu, biểu đồ, bản đồ, hình vẽ, công thức hoặc dữ liệu môn học, hãy khai thác chúng trong câu hỏi/rubrics khi phù hợp.
    `
    : "";
  const prompt = `
    Dựa trên Kế hoạch bài dạy (KHBD) sau đây, hãy thiết kế một “Hệ thống đánh giá năng lực” theo Quyết định 2422/QĐ-BGDĐT (CV 5588/BGDĐT-GDPT) và Chương trình GDPT 2018.

    Tên bài: ${lessonPlan?.title || "Giáo án đã nâng cấp"}
    Môn học: ${lessonPlan?.subject || ""}
    Lớp: ${lessonPlan?.grade || ""}
    Mục tiêu kiến thức: ${JSON.stringify(objectives.knowledge || [])}
    Mục tiêu năng lực: ${JSON.stringify(objectives.subjectSpecific || [])}
    Mục tiêu AI: ${JSON.stringify(objectives.aiSpecific || [])}
    ${AI_COMPETENCY_ORDER_RULE}
    ${preservationContext}

    Yêu cầu hệ thống đánh giá bao gồm:
    1. TIÊU CHÍ ĐÁNH GIÁ (Rubrics): Thiết kế bảng Rubric cho ít nhất 3 năng lực cốt lõi được thể hiện trong bài dạy (bao gồm năng lực chung và năng lực đặc thù môn học/năng lực AI). Mỗi năng lực cần có các mức độ đạt được (VD: Mức 1: Chưa đạt; Mức 2: Đạt; Mức 3: Khá; Mức 4: Tốt).
    2. CÔNG CỤ ĐÁNH GIÁ THƯỜNG XUYÊN: Thiết kế bộ câu hỏi kiểm tra theo ĐÚNG ĐỊNH DẠNG ĐỀ THI TỐT NGHIỆP THPT 2025 gồm 3 phần:
       - Phần I: Trắc nghiệm khách quan nhiều lựa chọn (BẮT BUỘC TẠO ĐÚNG 12 CÂU). Mỗi câu 4 đáp án A,B,C,D, chỉ 1 đáp án đúng.
       - Phần II: Trắc nghiệm đúng/sai. Sinh 2-4 câu. Mỗi câu gồm 1 lời dẫn và 4 ý phát biểu A, B, C, D. Học sinh phải chọn Đúng hoặc Sai cho mỗi ý.
       - Phần III: Trả lời ngắn / Tính toán. Sinh 2-4 câu. (LƯU Ý: Với các môn Ngữ văn, Lịch sử, GD Kinh tế & Pháp luật, bỏ qua Phần III và tăng số lượng câu Phần II lên 4-6 câu).
       - Bảng kiểm (Checklists): Dùng trong quá trình dạy học để đánh giá tiến trình của học sinh.
    3. CÔNG CỤ ĐÁNH GIÁ ĐỊNH KỲ: Thiết kế một bài tập/dự án nhỏ hoặc câu hỏi tổng hợp nhằm đánh giá mức độ đạt được mục tiêu sau khi kết thúc bài học.
    4. HƯỚNG DẪN NHẬN XÉT: Các mẫu nhận xét tự luận phù hợp với từng mức độ năng lực.

    LƯU Ý: Phải có các tiêu chí cụ thể đánh giá "Năng lực AI" (NLa - NLd) đã được xác định trong bài dạy; trước khi ghi mã NL AI trong rubric/câu hỏi phải ghi tên thành phần năng lực AI.
    LƯU Ý QUAN TRỌNG VỀ NGÔN NGỮ: Bắt buộc kết quả trả về PHẢI ĐỒNG NHẤT 100% với ngôn ngữ của đầu vào. Nếu Tên bài hoặc mục tiêu được viết bằng Tiếng Anh, TOÀN BỘ nội dung Rubric, Câu hỏi, Checklists và Đánh giá phải được viết 100% bằng Tiếng Anh (English).
    LƯU Ý QUAN TRỌNG VỀ ĐỊNH DẠNG CÂU HỎI CÓ BẢNG / HÌNH ẢNH:
    - Nếu câu hỏi có chứa **Bảng số liệu**, TUYỆT ĐỐI KHÔNG dùng text hay markdown để mô phỏng bảng bên trong thuộc tính \`question\`. Thay vào đó, hãy bóc tách phần bảng đó và điền vào thuộc tính \`tableData\` (bao gồm \`headers\` và \`rows\`).
    - Nếu câu hỏi cần chứa **Hình ảnh** (như lược đồ, bản đồ, đồ thị), hãy thêm nội dung mô tả hình ảnh vào thuộc tính \`imagePlaceholder\` (ví dụ: "[Chèn bản đồ Việt Nam tại đây]"). KHÔNG dùng thẻ \`<img>\` hay \`![]()\` trong \`question\`.
    - Phần \`question\` CHỈ chứa văn bản câu dẫn đơn thuần.

    Định dạng đầu ra: JSON.
  `;

  try {
    return await callGeminiWithFallback(prompt, {
      type: Type.OBJECT,
      properties: {
        rubrics: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              competencyName: { type: Type.STRING, description: "Tên năng lực" },
              criteria: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Các tiêu chí thành phần" },
              levels: {
                type: Type.OBJECT,
                properties: {
                  level1: { type: Type.STRING, description: "Mức 1 (Chưa đạt)" },
                  level2: { type: Type.STRING, description: "Mức 2 (Đạt)" },
                  level3: { type: Type.STRING, description: "Mức 3 (Khá)" },
                  level4: { type: Type.STRING, description: "Mức 4 (Tốt)" },
                },
                required: ["level1", "level2", "level3", "level4"],
              },
            },
            required: ["competencyName", "criteria", "levels"],
          },
        },
        formativeAssessment: {
          type: Type.OBJECT,
          properties: {
            part1_multipleChoice: {
              type: Type.ARRAY,
              description: "Phần I: Đúng 12 câu trắc nghiệm nhiều lựa chọn",
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  answer: { type: Type.STRING },
                  tableData: {
                    type: Type.OBJECT,
                    description: "Bảng số liệu nếu câu hỏi yêu cầu (trống nếu không có)",
                    properties: {
                      headers: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Tiêu đề cột" },
                      rows: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { type: Type.STRING } }, description: "Mảng các hàng (mỗi hàng là mảng các ô dữ liệu)" },
                      caption: { type: Type.STRING, description: "Tên bảng số liệu (tùy chọn)" },
                      source: { type: Type.STRING, description: "Nguồn (tùy chọn)" }
                    },
                    required: ["headers", "rows"]
                  },
                  imagePlaceholder: { type: Type.STRING, description: "Ghi chú để giáo viên chèn ảnh (VD: '[Chèn biểu đồ X]') (trống nếu không có)" }
                },
                required: ["question", "options", "answer"],
              }
            },
            part2_trueFalse: {
              type: Type.ARRAY,
              description: "Phần II: Câu trắc nghiệm đúng sai (mỗi câu 4 ý A,B,C,D)",
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  statements: { type: Type.ARRAY, items: { type: Type.STRING }, description: "4 ý phát biểu A, B, C, D" },
                  answers: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Mảng 4 đáp án 'Đúng' hoặc 'Sai' tương ứng" },
                  tableData: {
                    type: Type.OBJECT,
                    description: "Bảng số liệu nếu câu hỏi yêu cầu (trống nếu không có)",
                    properties: {
                      headers: { type: Type.ARRAY, items: { type: Type.STRING } },
                      rows: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { type: Type.STRING } } },
                      caption: { type: Type.STRING },
                      source: { type: Type.STRING }
                    },
                    required: ["headers", "rows"]
                  },
                  imagePlaceholder: { type: Type.STRING, description: "Ghi chú để giáo viên chèn ảnh (trống nếu không có)" }
                },
                required: ["question", "statements", "answers"],
              }
            },
            part3_shortAnswer: {
              type: Type.ARRAY,
              description: "Phần III: Câu trắc nghiệm trả lời ngắn (Rỗng nếu môn học không phù hợp)",
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  answer: { type: Type.STRING },
                  tableData: {
                    type: Type.OBJECT,
                    description: "Bảng số liệu nếu câu hỏi yêu cầu (trống nếu không có)",
                    properties: {
                      headers: { type: Type.ARRAY, items: { type: Type.STRING } },
                      rows: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { type: Type.STRING } } },
                      caption: { type: Type.STRING },
                      source: { type: Type.STRING }
                    },
                    required: ["headers", "rows"]
                  },
                  imagePlaceholder: { type: Type.STRING, description: "Ghi chú để giáo viên chèn ảnh (trống nếu không có)" }
                },
                required: ["question", "answer"],
              }
            },
            checklists: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["part1_multipleChoice", "part2_trueFalse", "checklists"],
        },
        summativeAssessment: {
          type: Type.OBJECT,
          properties: {
            projectOrTest: { type: Type.STRING, description: "Bài tập/dự án tổng hợp" },
            requirements: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["projectOrTest", "requirements"],
        },
        feedbackSamples: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              level: { type: Type.STRING },
              sampleText: { type: Type.STRING },
            },
            required: ["level", "sampleText"],
          },
        },
      },
      required: ["rubrics", "formativeAssessment", "summativeAssessment", "feedbackSamples"],
    });
  } catch (error) {
    console.error("Error generating competency evaluation:", error);
    throw error;
  }
};

export const generateAiCompetencyFramework = async (input: {
  subject: string;
  grade: string;
  topic: string;
  requirementsText: string;
}, options: { apiKey?: string; aiModel?: string }) => {
  const model = getModel(options.apiKey, options.aiModel);
  const competencyGuardrails = getCompetencyGuardrails(input.subject, input.grade, input.requirementsText);
  const prompt = `Bạn là chuyên gia đối chiếu nội dung giáo dục AI theo Quyết định 2422/QĐ-BGDĐT (CV 5588/BGDĐT-GDPT).

${competencyGuardrails}

Nhiệm vụ:
1. Đọc toàn bộ YCCĐ đầu vào; chỉ tạo dòng cho YCCĐ có hành vi học sinh liên quan trực tiếp đến AI. Nếu không có, trả về [].
2. Xác định đúng thành phần NLa/NLb/NLc/NLd, chủ đề và YCCĐ AI của đúng lớp ${input.grade}; không biến một YCCĐ môn học thông thường thành năng lực AI.
3. Với mỗi YCCĐ AI đã xác định, bắt buộc đánh mã đầy đủ theo cấu trúc [NLa/NLb/NLc/NLd]- [Lớp].[Chủ đề].[Số thứ tự], ví dụ “NLa-${input.grade}.A1.1”.
4. Chữ cái thành phần phải khớp mạch chủ đề: NLa-A, NLb-B, NLc-C, NLd-D. Số thứ tự không thêm số 0 ở đầu và phải là mã có thật trong bảng QĐ 2422; không lặp một mã cho hai YCCĐ khác nhau.
5. Trình bày đúng thứ tự: tên thành phần -> khối lớp -> chủ đề -> mã chỉ báo -> hành vi học sinh -> YCCĐ AI -> sản phẩm -> tiêu chí -> minh chứng.
6. Mỗi dòng phải có hành vi quan sát được, sản phẩm, minh chứng, công cụ/phương án ngoại tuyến và tiêu chí đánh giá; AI không làm thay học sinh.

THÔNG TIN BÀI HỌC:
Môn: ${input.subject}
Lớp: ${input.grade}
Chủ đề/Bài: ${input.topic}
YCCĐ đầu vào:
"""
${input.requirementsText}
"""`;

  try {
    const response = await callGeminiWithFallback(prompt, {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          code: { type: Type.STRING, description: `Mã NL AI đầy đủ theo mẫu NLa-${input.grade}.A1.1` },
          content: { type: Type.STRING, description: "YCCĐ AI đúng lớp/chủ đề" },
          component: { type: Type.STRING, description: "NLa, NLb, NLc hoặc NLd" },
          level: { type: Type.STRING, description: "Mức nhẹ, mức vừa hoặc mức sâu" },
          product: { type: Type.STRING, description: "Sản phẩm học tập" },
          evidence: { type: Type.STRING, description: "Minh chứng đánh giá" },
          activities: { type: Type.STRING, description: "Hành vi và hoạt động học sinh" },
          tools: { type: Type.STRING, description: "Công cụ và phương án ngoại tuyến" },
          rubric: { type: Type.STRING, description: "Tiêu chí đo được" }
        },
        required: ["code", "content", "component", "level", "product", "evidence", "activities", "tools", "rubric"]
      }
    });
    const rows = Array.isArray(response) ? response : [];
    return rows.flatMap((row: any) => {
      const rawCode = String(row?.code || "").trim();
      const sanitized = sanitizeAiCodeForGrade(rawCode, input.grade, row?.component);
      if (sanitized.code === "Không gán mã") return [];
      return [{
        ...row,
        code: sanitized.code,
      }];
    });
  } catch (error) {
    console.error("Error generating AI Competency Framework:", error);
    throw error;
  }
};
export const analyzeLessonSource = async (
  fileBase64: string,
  mimeType: string,
  options: { apiKey?: string; aiModel?: string; rawText?: string } = {}
) => {
  const apiKey = options.apiKey || localStorage.getItem('GEMINI_API_KEY') || '';
  if (!apiKey) throw new Error('API_KEY_REQUIRED');
  const startModel = options.aiModel || localStorage.getItem('GEMINI_MODEL') || 'gemini-3.5-flash';
  const modelsToTry = getFallbackModels(startModel);

  const promptText = `Bạn là một Chuyên gia Giáo dục và Thị giác máy tính (Computer Vision).
Nhiệm vụ của bạn là đọc và phân tích tài liệu/ảnh (trang Sách giáo khoa/kế hoạch bài dạy) được cung cấp, sau đó trích xuất các thông tin cốt lõi để điền vào form tạo Kế hoạch bài dạy.

YÊU CẦU:
1. Trích xuất Tên bài học (hoặc nội dung trọng tâm).
2. Trích xuất chính xác các Yêu cầu cần đạt (Mục tiêu kiến thức, năng lực).
3. Đề xuất nhanh 2-3 phương pháp hoặc kỹ thuật dạy học tích cực phù hợp nhất với bài học này.

Trả về JSON hợp lệ: {"topic": "Tên bài học", "objectives": "Yêu cầu cần đạt...", "methodologies": "Phương pháp..."}`;

  const isRawText = Boolean(options.rawText) || mimeType === 'text/plain';

  for (let i = 0; i < modelsToTry.length; i++) {
    const currentModel = modelsToTry[i];
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`;
      const parts: any[] = isRawText
        ? [{ text: `${promptText}\n\nNỘI DUNG TÀI LIỆU:\n${options.rawText || fileBase64}` }]
        : [
            { inlineData: { data: fileBase64, mimeType } },
            { text: promptText }
          ];

      const body = {
        contents: [{
          role: 'user',
          parts
        }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              topic: { type: 'STRING' },
              objectives: { type: 'STRING' },
              methodologies: { type: 'STRING' }
            },
            required: ['topic', 'objectives', 'methodologies']
          }
        }
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        if (res.status === 429 || errText.includes('RESOURCE_EXHAUSTED')) throw new Error('QUOTA_EXHAUSTED');
        if (res.status === 503 || errText.toLowerCase().includes('overloaded') || errText.toLowerCase().includes('high demand')) throw new Error('MODEL_OVERLOADED');
        if (res.status === 401 || res.status === 403) throw new Error('API_KEY_INVALID');
        throw new Error(`HTTP ${res.status}: ${errText}`);
      }

      const json = await res.json();
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('AI trả về phản hồi rỗng.');
      return JSON.parse(stripMarkdownJson(text));

    } catch (err: any) {
      console.error(`[analyzeLessonSource] Lỗi với model ${currentModel}:`, err);
      const isApiKeyInvalid = err.message?.includes('API_KEY_INVALID') || err.message?.includes('401');
      const isOverloaded = err.message?.includes('MODEL_OVERLOADED') || err.message?.includes('503') || err.message?.toLowerCase().includes('high demand');
      const isQuota = err.message?.includes('QUOTA_EXHAUSTED');
      const isLast = i === modelsToTry.length - 1;

      if (isApiKeyInvalid) throw new Error('API Key không hợp lệ. Vui lòng kiểm tra lại Cài đặt.');
      if (isLast) {
        if (isQuota) throw new Error('API Key đã hết quota. Vui lòng thử lại vào ngày mai.');
        if (isOverloaded) throw new Error('Model AI đang quá tải. Vui lòng thử lại sau 30 giây.');
        throw err;
      }
      await new Promise(r => setTimeout(r, isOverloaded ? 500 : 1000));
    }
  }
  throw new Error('Tất cả models đều thất bại khi phân tích ảnh/PDF.');
};

export const evaluateLessonPlan = async (lessonPlanText: string, options: { apiKey?: string; aiModel?: string }) => {
  const model = getModel(options.apiKey, options.aiModel);
  const prompt = `Bạn là HỘI ĐỒNG AI PHẢN BIỆN gồm 3 chuyên gia hàng đầu.
Nhiệm vụ của bạn là đánh giá bản Kế hoạch bài dạy (KHBD) dưới đây.

BA VAI TRÒ CHUYÊN GIA:
1. Chuyên gia Giáo dục: Đánh giá việc đáp ứng Yêu cầu cần đạt cốt lõi, việc lựa chọn phương pháp/kỹ thuật dạy học tích cực có phù hợp không.
2. Chuyên gia Công nghệ số: Đánh giá việc lồng ghép Năng lực số (NLS) có tự nhiên và hiệu quả không.
3. Chuyên gia Phản biện AI: Kiểm định việc áp dụng Khung năng lực AI (QĐ 2422), kiểm tra xem các Prompt/công cụ đề xuất cho học sinh có thực tế không, có nguy cơ "ảo giác" (hallucination) hay lạm dụng AI thay vì tư duy không.

BẢN KHBD CẦN ĐÁNH GIÁ:
"""
${lessonPlanText}
"""

Hãy trả về kết quả đánh giá bằng JSON theo cấu trúc sau:
{
  "educationalExpert": {
    "strengths": "Ưu điểm về sư phạm...",
    "weaknesses": "Hạn chế...",
    "suggestions": "Đề xuất cải thiện..."
  },
  "digitalExpert": {
    "strengths": "Ưu điểm về công nghệ số...",
    "weaknesses": "Hạn chế...",
    "suggestions": "Đề xuất cải thiện..."
  },
  "aiExpert": {
    "strengths": "Ưu điểm về tích hợp AI 2422...",
    "weaknesses": "Hạn chế...",
    "suggestions": "Đề xuất cải thiện..."
  },
  "overallScore": 8.5
}
`;

  try {
    return await callGeminiWithFallback(prompt, {
      type: Type.OBJECT,
      properties: {
        educationalExpert: {
          type: Type.OBJECT,
          properties: { strengths: { type: Type.STRING }, weaknesses: { type: Type.STRING }, suggestions: { type: Type.STRING } },
          required: ["strengths", "weaknesses", "suggestions"]
        },
        digitalExpert: {
          type: Type.OBJECT,
          properties: { strengths: { type: Type.STRING }, weaknesses: { type: Type.STRING }, suggestions: { type: Type.STRING } },
          required: ["strengths", "weaknesses", "suggestions"]
        },
        aiExpert: {
          type: Type.OBJECT,
          properties: { strengths: { type: Type.STRING }, weaknesses: { type: Type.STRING }, suggestions: { type: Type.STRING } },
          required: ["strengths", "weaknesses", "suggestions"]
        },
        overallScore: { type: Type.NUMBER, description: "Điểm đánh giá chung trên thang điểm 10" }
      },
      required: ["educationalExpert", "digitalExpert", "aiExpert", "overallScore"]
    });
  } catch (error) {
    console.error("Error evaluating lesson plan:", error);
    throw error;
  }
};

export const generateEducationalActivitiesPlan = async (subject: string, grade: string, options?: { useLaTeX?: boolean, socialIntegrations?: string[] }) => {
  const englishConstraint = (subject === "Tiếng Anh" || subject.toLowerCase().includes("english")) ? "\\nLỆNH ĐẶC BIỆT TỐI QUAN TRỌNG: Môn học là Tiếng Anh nên TOÀN BỘ nội dung kế hoạch giáo dục PHẢI ĐƯỢC VIẾT 100% BẰNG TIẾNG ANH (ENGLISH)." : "";
  const competencyGuardrails = getCompetencyGuardrails(subject, grade);
  const socialSelectionPrompt = buildSocialIntegrationSelectionPrompt(options?.socialIntegrations);
  const prompt = `
    Bạn là chuyên gia xây dựng chương trình giáo dục. Hãy lập “Kế hoạch tổ chức các hoạt động giáo dục” (Phụ lục 2 - CV 5512) cho môn ${subject}, lớp ${grade}.

    ${competencyGuardrails}
    ${SOCIAL_INTEGRATION_GUIDELINES}
    ${socialSelectionPrompt}

    YÊU CẦU QUAN TRỌNG:
    1. Đề xuất từ 3 đến 5 hoạt động giáo dục đặc sắc, mang tính trải nghiệm, câu lạc bộ, tham quan, hoặc dự án liên môn phù hợp với môn học và lứa tuổi.
    2. Các hoạt động phải ĐA DẠNG: Có thể bao gồm Sinh hoạt dưới cờ, Sinh hoạt lớp, Câu lạc bộ, Hoạt động trải nghiệm ngoài nhà trường, Dự án học tập...
    3. TÍCH HỢP CÓ ĐIỀU KIỆN: Rà từng hoạt động và chọn Không tích hợp / NLS / NL AI / NLS và NL AI. Chỉ ghi năng lực khi học sinh trực tiếp thực hiện và có sản phẩm; giáo viên dùng công cụ không tạo năng lực cho học sinh.

    4. NỘI DUNG GIÁO DỤC TÍCH HỢP: Chỉ dùng nội dung giáo viên đã chọn, đặt tại đúng hoạt động có điểm chạm và không trộn vào cột NLS/NL AI.
    ${englishConstraint}

    Định dạng đầu ra: JSON Array các đối tượng với các trường sau:
    - theme: Chủ đề/Hoạt động.
    - requirements: Yêu cầu cần đạt.
    - periods: Số tiết.
    - timing: Thời điểm (VD: Tháng 10, Tuần 2...).
    - location: Địa điểm (VD: Sân trường, Phòng máy tính, Di tích lịch sử...).
    - host: Người chủ trì (VD: Giáo viên bộ môn, Đoàn TNCS...).
    - collaborator: Phối hợp (VD: GVCN, Phụ huynh...).
    - conditions: Điều kiện thực hiện (Cơ sở vật chất, kinh phí...).
    - aiIntegration: Viết tối đa 80 từ theo đúng thứ tự: quyết định tích hợp; căn cứ YCCĐ; NLS (mã-tên-hành vi-sản phẩm-tiêu chí); AI (thành phần-YCCĐ-mã/tham chiếu-sản phẩm-tiêu chí); mức độ; phương án thiết bị. Không có điểm chạm thì ghi “Không tích hợp - lý do: ...”.
    - socialIntegration: Ghi theo thứ tự Chủ đề -> Căn cứ YCCĐ -> Hành vi học sinh -> Sản phẩm -> Tiêu chí/minh chứng; để chuỗi rỗng nếu hoạt động không phù hợp.
  `;

  const apiKey = localStorage.getItem('GEMINI_API_KEY');
  if (!apiKey) throw new Error('API_KEY_REQUIRED');
  const startModel = localStorage.getItem('GEMINI_MODEL') || 'gemini-3.5-flash';
  const modelsToTry = getFallbackModels(startModel);

  const parts = [{ text: prompt }];
  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseMimeType: 'application/json',
      maxOutputTokens: 8192,
      temperature: 0.7,
      responseSchema: {
        type: 'ARRAY' as any,
        items: {
          type: 'OBJECT' as any,
          properties: {
            theme: { type: 'STRING' as any },
            requirements: { type: 'STRING' as any },
            periods: { type: 'STRING' as any },
            timing: { type: 'STRING' as any },
            location: { type: 'STRING' as any },
            host: { type: 'STRING' as any },
            collaborator: { type: 'STRING' as any },
            conditions: { type: 'STRING' as any },
            aiIntegration: { type: 'STRING' as any },
            socialIntegration: { type: 'STRING' as any },
          },
          required: ['theme', 'requirements', 'periods', 'timing', 'location', 'host', 'collaborator', 'conditions', 'socialIntegration', 'aiIntegration'],
        },
      },
    },
  };

  for (let i = 0; i < modelsToTry.length; i++) {
    const currentModel = modelsToTry[i];
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`;
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) {
        if (res.status === 429) throw new Error('QUOTA_EXHAUSTED');
        if (res.status === 401 || res.status === 403) throw new Error('API_KEY_INVALID');
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      }
      const json = await res.json();
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('AI trả về rỗng.');

      let parsed = JSON.parse(stripMarkdownJson(text));
      if (parsed && !Array.isArray(parsed) && typeof parsed === 'object') {
        const keys = Object.keys(parsed);
        for (const k of keys) {
          if (Array.isArray(parsed[k])) { parsed = parsed[k]; break; }
        }
      }
      if (!Array.isArray(parsed)) throw new Error('Not an array');
      return sanitizeGeneratedCompetencyRows(parsed, grade);
    } catch (err: any) {
      if (i === modelsToTry.length - 1) throw err;
    }
  }
};

export type SuDiaSkillDomain = "history" | "geography";
export type SuDiaSkillKind =
  | "history-quiz"
  | "history-slides"
  | "history-exam"
  | "history-timeline"
  | "geo-map"
  | "geo-chart"
  | "geo-table"
  | "geo-formula"
  | "geo-slides"
  | "geo-exam";

export interface SuDiaSkillInput {
  kind: SuDiaSkillKind;
  domain: SuDiaSkillDomain;
  subject: string;
  grade: string;
  topic: string;
  province?: string;
  lessonGoal?: string;
  sourceText?: string;
  questionCount?: number;
}

export const generateSuDiaSkill = async (input: SuDiaSkillInput) => {
  const kindLabels: Record<SuDiaSkillKind, string> = {
    "history-quiz": "Quiz Lịch sử tương tác",
    "history-slides": "Bộ slide PPTX môn Lịch sử",
    "history-exam": "Đề kiểm tra môn Lịch sử theo ma trận",
    "history-timeline": "Dòng thời gian và phân tích tư liệu Lịch sử",
    "geo-map": "Phân tích bản đồ/GIS môn Địa lí",
    "geo-chart": "Phân tích và tạo biểu đồ Địa lí",
    "geo-table": "Xử lí bảng số liệu Địa lí",
    "geo-formula": "Công thức và bài tập tính toán Địa lí",
    "geo-slides": "Bộ slide PPTX môn Địa lí",
    "geo-exam": "Đề kiểm tra môn Địa lí theo ma trận"
  };
  const domainLabel = input.domain === "history" ? "Lịch sử" : "Địa lí";
  const competencyGuardrails = getCompetencyGuardrails(domainLabel, input.grade, input.lessonGoal);

  const prompt = `
Bạn là chuyên gia thiết kế học liệu ${domainLabel} theo CT GDPT 2018, đồng thời am hiểu Khung năng lực số TT02/2025 và năng lực AI theo QĐ 2422.

Nhiệm vụ đang chọn: ${kindLabels[input.kind]}
Nhánh môn học: ${domainLabel}
Môn/chủ đề: ${input.subject}
Lớp: ${input.grade}
Bài/chuyên đề: ${input.topic}
Địa phương/khu vực ưu tiên: ${input.province || "Việt Nam"}
Số câu mong muốn nếu tạo quiz/đề kiểm tra: ${input.questionCount || 8}
Yêu cầu cần đạt hoặc ghi chú của giáo viên:
${input.lessonGoal || "Không có"}

Tư liệu/dữ liệu đầu vào nếu có:
"""
${(input.sourceText || "").slice(0, 12000)}
"""

${competencyGuardrails}

YÊU CẦU CHUNG:
- Nội dung viết bằng tiếng Việt, đúng thuật ngữ Sử - Địa, dùng được ngay cho giáo viên.
- Tích hợp hợp lý năng lực số và AI: nêu mã, mô tả, cách học sinh dùng công cụ số/AI và cách kiểm chứng; chỉ gán mã khi mã bám sát YCCĐ môn học.
- Nếu tạo quiz hoặc đề kiểm tra, câu hỏi phải có đáp án, giải thích ngắn, có đủ nhận biết, thông hiểu, vận dụng.
- Nếu tạo slide, mỗi slide phải có tiêu đề ngắn, gạch đầu dòng vừa phải, ghi chú thuyết trình và hoạt động trên lớp.
- Với Lịch sử: ưu tiên mốc thời gian, bối cảnh, nguyên nhân - kết quả, nhân vật/sự kiện, phân tích tư liệu, so sánh quan điểm và kiểm chứng nguồn.
- Với Địa lí: ngoài bản đồ/GIS, BẮT BUỘC xét thêm biểu đồ, bảng số liệu, công thức tính toán địa lí khi nhiệm vụ phù hợp.
- Nếu phân tích bản đồ/GIS: nêu lớp dữ liệu, quy trình thao tác, câu hỏi khai thác bản đồ, nguồn dữ liệu gợi ý và cảnh báo sai lệch dữ liệu.
- Nếu phân tích biểu đồ: nêu loại biểu đồ phù hợp, bảng dữ liệu mẫu, các bước vẽ/đọc biểu đồ, câu hỏi nhận xét và lỗi thường gặp.
- Nếu xử lí bảng số liệu: nêu bảng mẫu, bước xử lí, phép tính, nhận xét xu hướng, câu hỏi khai thác số liệu.
- Nếu dùng công thức Địa lí: nêu tên công thức, biểu thức, biến số, khi dùng, ví dụ tính mẫu và bài tập luyện tập.
- Nếu thiếu dữ liệu thực, hãy tạo bộ mẫu hợp lý và ghi rõ là dữ liệu minh họa để giáo viên thay bằng số liệu chính thức.

Trả về JSON object đúng schema, không markdown, không giải thích ngoài JSON.
`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      kind: { type: Type.STRING },
      title: { type: Type.STRING },
      overview: { type: Type.STRING },
      tags: { type: Type.ARRAY, items: { type: Type.STRING } },
      teacherNotes: { type: Type.ARRAY, items: { type: Type.STRING } },
      nlsAiConnections: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            code: { type: Type.STRING },
            description: { type: Type.STRING },
            classroomUse: { type: Type.STRING }
          },
          required: ["code", "description", "classroomUse"]
        }
      },
      quiz: {
        type: Type.OBJECT,
        properties: {
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                level: { type: Type.STRING },
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                answer: { type: Type.STRING },
                explanation: { type: Type.STRING },
                sourceHint: { type: Type.STRING }
              },
              required: ["level", "question", "options", "answer", "explanation", "sourceHint"]
            }
          }
        },
        required: ["questions"]
      },
      slides: {
        type: Type.OBJECT,
        properties: {
          slides: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                subtitle: { type: Type.STRING },
                bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
                speakerNotes: { type: Type.STRING },
                classroomActivity: { type: Type.STRING }
              },
              required: ["title", "subtitle", "bullets", "speakerNotes", "classroomActivity"]
            }
          }
        },
        required: ["slides"]
      },
      gisAnalysis: {
        type: Type.OBJECT,
        properties: {
          mapBrief: { type: Type.STRING },
          layers: { type: Type.ARRAY, items: { type: Type.STRING } },
          workflow: { type: Type.ARRAY, items: { type: Type.STRING } },
          inquiryQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
          dataSources: { type: Type.ARRAY, items: { type: Type.STRING } },
          classroomActivity: { type: Type.ARRAY, items: { type: Type.STRING } },
          cautions: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["mapBrief", "layers", "workflow", "inquiryQuestions", "dataSources", "classroomActivity", "cautions"]
      },
      historyAnalysis: {
        type: Type.OBJECT,
        properties: {
          timeline: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                time: { type: Type.STRING },
                event: { type: Type.STRING },
                significance: { type: Type.STRING }
              },
              required: ["time", "event", "significance"]
            }
          },
          sourceAnalysisSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
          causeEffect: { type: Type.ARRAY, items: { type: Type.STRING } },
          historicalQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
          verificationSources: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["timeline", "sourceAnalysisSteps", "causeEffect", "historicalQuestions", "verificationSources"]
      },
      geographyAnalysis: {
        type: Type.OBJECT,
        properties: {
          chartGuide: {
            type: Type.OBJECT,
            properties: {
              chartType: { type: Type.STRING },
              dataTable: {
                type: Type.OBJECT,
                properties: {
                  headers: { type: Type.ARRAY, items: { type: Type.STRING } },
                  rows: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { type: Type.STRING } } },
                  caption: { type: Type.STRING },
                  source: { type: Type.STRING }
                },
                required: ["headers", "rows", "caption", "source"]
              },
              drawingSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
              interpretationQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
              commonMistakes: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["chartType", "dataTable", "drawingSteps", "interpretationQuestions", "commonMistakes"]
          },
          dataTableGuide: {
            type: Type.OBJECT,
            properties: {
              tableTitle: { type: Type.STRING },
              headers: { type: Type.ARRAY, items: { type: Type.STRING } },
              rows: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { type: Type.STRING } } },
              processingSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
              keyCalculations: { type: Type.ARRAY, items: { type: Type.STRING } },
              comments: { type: Type.ARRAY, items: { type: Type.STRING } },
              questions: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["tableTitle", "headers", "rows", "processingSteps", "keyCalculations", "comments", "questions"]
          },
          formulaGuide: {
            type: Type.OBJECT,
            properties: {
              formulas: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    expression: { type: Type.STRING },
                    variables: { type: Type.STRING },
                    whenToUse: { type: Type.STRING },
                    example: { type: Type.STRING }
                  },
                  required: ["name", "expression", "variables", "whenToUse", "example"]
                }
              },
              practiceTasks: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["formulas", "practiceTasks"]
          }
        },
        required: ["chartGuide", "dataTableGuide", "formulaGuide"]
      },
      exam: {
        type: Type.OBJECT,
        properties: {
          matrix: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                competency: { type: Type.STRING },
                level: { type: Type.STRING },
                questionCount: { type: Type.STRING },
                score: { type: Type.STRING }
              },
              required: ["competency", "level", "questionCount", "score"]
            }
          },
          multipleChoice: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                answer: { type: Type.STRING },
                explanation: { type: Type.STRING }
              },
              required: ["question", "options", "answer", "explanation"]
            }
          },
          trueFalse: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                stem: { type: Type.STRING },
                statements: { type: Type.ARRAY, items: { type: Type.STRING } },
                answers: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["stem", "statements", "answers"]
            }
          },
          shortAnswer: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                answer: { type: Type.STRING },
                rubric: { type: Type.STRING }
              },
              required: ["question", "answer", "rubric"]
            }
          },
          essay: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                rubric: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["question", "rubric"]
            }
          },
          answerKey: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["matrix", "multipleChoice", "trueFalse", "shortAnswer", "essay", "answerKey"]
      }
    },
    required: ["kind", "title", "overview", "tags", "teacherNotes", "nlsAiConnections", "quiz", "slides", "gisAnalysis", "historyAnalysis", "geographyAnalysis", "exam"]
  };

  const output = await callGeminiWithFallback(prompt, schema);
  return {
    ...output,
    kind: input.kind,
    requestedQuestionCount: input.questionCount || 8
  };
};
