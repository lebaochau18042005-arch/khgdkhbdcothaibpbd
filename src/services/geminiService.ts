import { GoogleGenAI, Type } from "@google/genai";
import { GEO_10_KNTT } from './curriculumData';

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
- KHÔNG sao chép nguyên văn toàn bộ đoạn văn từ SGK/SGV.
- Mọi nội dung trích dẫn phải có ghi nguồn.

MỤC 7 - TIÊU CHUẨN SẢN PHẨM Sử DỤNG AI:
- AI hỗ trợ học sinh tìm kiếm thông tin, so sánh, đặt câu hỏi, kiểm chứng, sửa và hoàn thiện sản phẩm. AI KHÔNG thay thế suy luận của học sinh.
- Mọi hoạt động có sử dụng AI trong KHBD phải thiết kế để học sinh tạo ra: (1) Câu lệnh Prompt đã sử dụng, (2) Nguồn kiểm chứng, (3) Nhận xét đúng/chưa đủ/cần sửa, (4) Bản chỉnh sửa của học sinh, (5) Nhận xét của giáo viên.
- NGHIÊM CẤM dùng cụm từ "bản nháp AI" trong sản phẩm học tập.
`;

const AI_SUBJECT_GUIDELINES = `
Dưới đây là Khung mạch nội dung tích hợp AI cho từng môn học theo CV 3439:
- Ngữ văn: Trọng tâm NLa, NLb, NLc. Nội dung: Lên dàn ý, tóm tắt tư liệu, phân tích thi pháp, dịch thuật. Thảo luận: Sáng tác Người vs AI, bản quyền, phong cách cá nhân, tác động đến ngôn ngữ.
- Tích hợp Khoa học tự nhiên (Lý, Hóa, Sinh): Trọng tâm NLa, NLb, NLc. Nội dung: Phân tích dữ liệu thí nghiệm, mô phỏng phản ứng và sinh thái thực tế. Thảo luận: Giới hạn AI trong khoa học.
- Tích hợp Lịch sử & Địa lí: Trọng tâm NLa, NLb, NLc. Nội dung: Phân tích Big Data dân cư, tạo timeline sự kiện động. Thảo luận: Tính công bằng tài nguyên và thiên kiến thuật toán.
- Công nghệ: Trọng tâm NLa, NLb (hỗ trợ bởi NLc, NLd). Nội dung: Hệ thống AI trong nông nghiệp, sản xuất, thiết kế. Thảo luận: Đạo đức trong thiết kế công nghệ, tác động xã hội của tự động hóa, tính bền vững.
- Hoạt động TN, Hướng nghiệp: Trọng tâm NLa, NLb. Nội dung: Thay đổi thị trường lao động, kỹ năng cốt lõi của con người, trách nhiệm xã hội.
- Ngoại ngữ: Trọng tâm NLb, NLc. Nội dung: Luyện phát âm, giao tiếp chatbot, dịch thuật, cá nhân hóa học tập. Thảo luận: Đánh giá dịch máy, vai trò văn hóa và ngữ cảnh.
- Nhóm Nghệ thuật (Âm nhạc, Mỹ thuật): Trọng tâm NLa, NLb, NLc. Nội dung: Khám phá công cụ sáng tác, phân tích tác phẩm. Thảo luận: Vấn đề bản quyền, tính độc đáo và vai trò cảm xúc con người.
- Giáo dục địa phương: Trọng tâm NLa, NLb, NLc. Nội dung: Phân tích dữ liệu kinh tế - xã hội địa phương, bảo tồn văn hóa qua số hóa kỹ thuật, đề xuất giải pháp phát triển đô thị. Thảo luận: Tác động của AI đến bản sắc văn hóa vùng miền, bảo tồn di sản trong kỷ nguyên số.
`;

const GEOGRAPHY_AI_RULES = `
LỆNH ĐẶC BIỆT TỪ CHUYÊN GIA ĐỊA LÍ VÀ AI:
Nhiệm vụ của bạn là rà soát PPCT và bổ sung nội dung tích hợp NLAI bảo đảm YCCĐ AI phải phục vụ và hỗ trợ trực tiếp YCCĐ môn Địa lí.

I. NGUYÊN TẮC BẮT BUỘC
1. Giữ nguyên toàn bộ nội dung gốc của PPCT.
2. Không bổ sung AI theo kiểu hình thức.
3. Không để AI thay thế hoạt động tư duy Địa lí (đọc bản đồ, phân tích số liệu...).
4. Trình tự xử lí: YCCĐ Địa lí -> Tách kiến thức/năng lực -> Cơ hội tích hợp AI -> Chọn thành phần năng lực AI -> Xác định hành vi học sinh -> Viết YCCĐ AI -> Tạo mã NLAI -> Xác định sản phẩm, tiêu chí, minh chứng.
5. Không sử dụng chatbot làm nguồn dữ liệu gốc (phải dùng SGK, Atlat, cổng thông tin).
6. Không đưa thông tin cá nhân của học sinh vào AI.

II. CẤU TRÚC MÃ VÀ CHỦ ĐỀ ĐƯỢC PHÉP
Cấu trúc: [Lớp].[Chủ đề].[Số thứ tự] (Ví dụ: 10.C4.01, 11.C3.02, 12.D2.01).
- Lớp 10: Chỉ dùng A1, A2, A3; B2, B3; C2, C3, C4; D1, D2.
- Lớp 11: Chỉ dùng A1, A2, A3; B2, B3; C2, C3, C5; D1, D2.
- Lớp 12: Chỉ dùng A1, A2, A3; B1, B2, B3; C2, C3, C4; D1, D2.
TUYỆT ĐỐI không gán mã chủ đề không thuộc lớp tương ứng! Mỗi đơn vị bài học chỉ chọn 1-2 mã NLAI thật sự phù hợp.

III. YÊU CẦU TÁCH YCCĐ AI VÀ ĐẶC THÙ ĐỊA LÍ
- Công thức: Học sinh + động từ quan sát được + nội dung AI + bối cảnh Địa lí + sản phẩm/minh chứng + tiêu chí đánh giá.
- Động từ ưu tiên: Xác định, Mô tả, Giải thích, Phân tích, Đối chiếu, Kiểm chứng, Đánh giá, Thiết kế, Thu thập...
- Gắn với: Đọc Atlat/bản đồ số, Xử lí số liệu, Tìm hiểu thiên tai/BĐKH, Điều tra địa phương...
- Lớp 10 tập trung nhận diện, mô tả; Lớp 11 tập trung thực hành, phân tích, đánh giá, prompt nâng cao; Lớp 12 tập trung thiết kế, kiểm thử, cải tiến, trách nhiệm.

IV. ĐỊNH DẠNG ĐẦU RA BẮT BUỘC CHO CỘT AI (aiCompetency3439Integrated)
BẠN BẮT BUỘC PHẢI gộp tất cả các thông tin minh chứng sau vào cột "Mục tiêu & YCCĐ 3439 Tích hợp GD AI" dưới dạng một danh sách văn bản (dùng gạch đầu dòng):
- Tên thành phần năng lực AI (NLa/NLb/NLc/NLd).
- Hành vi học sinh có thể quan sát được.
- Yêu cầu cần đạt AI tích hợp.
- Mã NL AI đúng lớp, đúng chủ đề.
- Sản phẩm học tập.
- Tiêu chí đánh giá.
- Minh chứng.
`;

const AI_COMPETENCY_ORDER_RULE = `
LỆNH MÃ HÓA NL AI BẮT BUỘC:
- Trước khi gắn mã AI, bắt buộc ghi tên thành phần năng lực AI (NLa/NLb/NLc/NLd).
- Khi mô tả/gắn mã NL AI trong mục tiêu, hoạt động, đánh giá hoặc cột aiCompetency3439Integrated, luôn trình bày đúng thứ tự:
  1. Tên thành phần năng lực AI.
  2. Hành vi học sinh.
  3. Yêu cầu cần đạt AI.
  4. Mã NL AI.
  5. Sản phẩm.
  6. Tiêu chí.
  7. Minh chứng.
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

const detectThptGradeFromText = (...texts: Array<string | undefined>) => {
  const combined = texts.filter(Boolean).join("\n").slice(0, 60000);
  const contextualMatch = combined.match(/(?:lớp|lop|khối|khoi)\s*[:\-]?\s*(10|11|12)\b/i);
  if (contextualMatch) return contextualMatch[1];
  const lessonPlanMatch = combined.match(/(?:kế hoạch bài dạy|giao án|giáo án)[\s\S]{0,800}?\b(10|11|12)\b/i);
  return lessonPlanMatch?.[1];
};

const isLikelyPlaceholderIndicatorCode = (code?: string) => /^\s*\d{1,2}\.A\d+\.a\s*$/i.test(code || "");

const isValidAiIndicatorCode = (code: string, grade?: string) => {
  const normalizedCode = code.trim();
  const currentGrade = extractGradeNumber(grade);
  const match = normalizedCode.match(/^(\d{1,2})\.([ABCD]\d+)\.\d{1,2}$/i);
  if (!match) return false;
  if (isThptGrade(grade) && match[1] !== currentGrade) return false;
  const allowedThemes = AI_THEMES_BY_THPT_GRADE[currentGrade];
  return !allowedThemes || allowedThemes.includes(match[2].toUpperCase());
};

const getSafeAiIndicatorCode = (code?: string, grade?: string) => {
  if (!code || isLikelyPlaceholderIndicatorCode(code)) return undefined;
  const trimmed = code.trim();
  return isValidAiIndicatorCode(trimmed, grade) ? trimmed : undefined;
};

const getAiCompetencyComponentName = (code?: string) => {
  const normalized = (code || "").toUpperCase();
  if (/\.(A\d+)\./.test(normalized) || normalized.includes("NLA")) {
    return "NLa - Tư duy lấy con người làm trung tâm";
  }
  if (/\.(B\d+)\./.test(normalized) || normalized.includes("NLB")) {
    return "NLb - Đạo đức và trách nhiệm xã hội";
  }
  if (/\.(C\d+)\./.test(normalized) || normalized.includes("NLC")) {
    return "NLc - Kỹ thuật và ứng dụng";
  }
  if (/\.(D\d+)\./.test(normalized) || normalized.includes("NLD")) {
    return "NLd - Giải quyết vấn đề và thiết kế hệ thống";
  }
  return "Thành phần năng lực AI cần đối chiếu theo CV/QĐ 3439";
};

const sanitizeAiCodeForGrade = (code: string | undefined, grade?: string) => {
  const currentGrade = extractGradeNumber(grade);
  const rawCode = (code || "").trim();
  if (!rawCode) {
    return { code: "Không gán mã", note: "Thiếu mã NL AI." };
  }

  const match = rawCode.match(/(\d{1,2})\.([ABCD]\d+)\.(\d{1,2})/i);
  if (!match) {
    return { code: "Không gán mã", note: `Mã "${rawCode}" không đúng định dạng NL AI.` };
  }

  const [, codeGrade, rawTheme, rawOrder] = match;
  const theme = rawTheme.toUpperCase();
  const allowedThemes = AI_THEMES_BY_THPT_GRADE[currentGrade];
  if (isThptGrade(currentGrade) && !allowedThemes?.includes(theme)) {
    return { code: "Không gán mã", note: `Chủ đề ${theme} không thuộc danh sách được phép của lớp ${currentGrade}.` };
  }

  const normalizedOrder = rawOrder.padStart(2, "0");
  const correctedCode = isThptGrade(currentGrade)
    ? `${currentGrade}.${theme}.${normalizedOrder}`
    : `${codeGrade}.${theme}.${normalizedOrder}`;

  if (isThptGrade(currentGrade) && codeGrade !== currentGrade) {
    return {
      code: correctedCode,
      note: `Đã hiệu chỉnh tiền tố lớp từ ${codeGrade} sang ${currentGrade}; giáo viên cần đối chiếu lại YCCĐ trước khi dùng.`,
    };
  }

  return { code: correctedCode };
};

const appendSanitizerNote = (text: string | undefined, note?: string) => {
  if (!note) return text || "";
  const base = (text || "").trim();
  return base ? `${base} (${note})` : note;
};

const normalizeViText = (value?: string) =>
  (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");

const isGeographyLikeSubject = (subject?: string) => /dia li|giao duc dia phuong|lich su va dia li/.test(normalizeViText(subject));

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

const sanitizeAnalysisResultCompetencies = (analysis: any, forcedGrade?: string, sourceText?: string) => {
  const grade = forcedGrade || extractGradeNumber(analysis?.grade);
  const sanitizedSuggestions = Array.isArray(analysis?.aiSuggestions)
    ? analysis.aiSuggestions.map((suggestion: any) => {
        const sanitized = sanitizeAiCodeForGrade(suggestion?.suggestedAI, grade);
        const finalAiCode = isThptGrade(grade) ? sanitized.code : suggestion?.suggestedAI;
        const yccdEvidence = suggestion?.yccdEvidence || suggestion?.aiYccd || suggestion?.reason || "Chưa có căn cứ YCCĐ riêng trong phản hồi AI.";
        const action = suggestion?.action || suggestion?.aiStudentBehavior || "Học sinh thực hiện nhiệm vụ học tập có sử dụng AI dưới sự hướng dẫn của giáo viên.";
        return {
          ...suggestion,
          suggestedNLS: suggestion?.suggestedNLS || "Không gán mã - cần đối chiếu TT 02/CV 3456 theo YCCĐ trước khi sử dụng.",
          yccdEvidence,
          suggestedAI: finalAiCode,
          aiCompetencyName: suggestion?.aiCompetencyName || suggestion?.aiComponentName || getAiCompetencyComponentName(finalAiCode),
          aiStudentBehavior: suggestion?.aiStudentBehavior || action,
          aiYccd: suggestion?.aiYccd || yccdEvidence,
          aiProduct: suggestion?.aiProduct || suggestion?.product || "Sản phẩm học tập có sử dụng AI và được học sinh chỉnh sửa/kiểm chứng.",
          aiCriteria: suggestion?.aiCriteria || suggestion?.criteria || "Đúng kiến thức môn học; dùng AI đúng mục đích; biết kiểm chứng nguồn và giải thích cách điều chỉnh kết quả AI.",
          aiEvidence: suggestion?.aiEvidence || suggestion?.evidence || "Prompt đã dùng, nguồn kiểm chứng, bản chỉnh sửa của học sinh và sản phẩm cuối.",
          action,
          reason: appendSanitizerNote(suggestion?.reason, isThptGrade(grade) ? sanitized.note : undefined),
          geoDataRequirement: buildGeoDataRequirement({ ...analysis, grade }, suggestion, sourceText),
        };
      })
    : [];

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
        ? "Mã NL AI hợp lệ theo lớp và chủ đề."
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
  const currentGrade = extractGradeNumber(grade);
  const thptNote = isThptGrade(grade)
    ? `\n- Vì đây là cấp THPT lớp ${currentGrade}, mã NLS phải ở mức NC1 theo Công văn 3456. Không dùng nguyên mã CB1/CB2 cho THPT nếu không có phụ lục chính thức chứng minh.`
    : "";
  return `
LỆNH RÀ SOÁT MÃ NLS/NL AI ĐÃ CHỌN:
${indicators.map(i => `- Mã ${i.code}: ${i.description}`).join('\n')}
- Chỉ sử dụng mã nào có minh chứng trực tiếp từ YCCĐ môn học và hoạt động học sinh.
- Với mã NL AI, trước khi ghi mã phải ghi tên thành phần năng lực AI và trình bày theo thứ tự: Tên thành phần -> hành vi học sinh -> YCCĐ AI -> mã -> sản phẩm -> tiêu chí -> minh chứng.
- Nếu mã đã chọn không khớp cấp học, không khớp YCCĐ hoặc là mã tạm, phải ghi "Không gán mã" và nêu lý do ngắn gọn.${thptNote}
`;
};

const getThptCompetencyGuardrails = (subject: string, grade?: string, yccd?: string) => {
  const currentGrade = extractGradeNumber(grade);
  const allowedThemes = AI_THEMES_BY_THPT_GRADE[currentGrade];
  const gradeRule = isThptGrade(grade)
    ? `- Cấp THPT lớp ${currentGrade}: mã NLS phải dùng mức Nâng cao 1 (NC1), ví dụ 1.1.NC1a; không dùng CB1/CB2 cho lớp 10-12.\n- Mã NL AI phải bắt đầu bằng "${currentGrade}." và chỉ dùng các chủ đề được phép: ${allowedThemes?.join(", ") || "theo bảng lớp tương ứng trong QĐ 3439"}.`
    : `- Nếu bài thuộc lớp 10, 11, 12 thì mã NLS phải dùng mức NC1 và mã NL AI phải bắt đầu đúng số lớp.`;
  const subjectRule = subject.toLowerCase().includes("địa")
    ? "- Môn Địa lí: chỉ gán mã khi YCCĐ yêu cầu/cho phép thao tác với bản đồ, Atlat, GIS, biểu đồ, bảng số liệu, dữ liệu địa phương hoặc công thức tính toán địa lí."
    : subject.toLowerCase().includes("sử")
      ? "- Môn Lịch sử: chỉ gán mã khi YCCĐ yêu cầu/cho phép phân tích tư liệu, kiểm chứng nguồn, lập timeline, so sánh bối cảnh, nguyên nhân - hệ quả hoặc đánh giá quan điểm lịch sử."
      : "- Với môn học này, chỉ chọn mã dựa trên thao tác học tập thật sự được nêu trong YCCĐ; không gán mã theo tên bài một cách hình thức.";
  return `
==== RÀ SOÁT BẮT BUỘC MÃ NLS / NL AI THEO YCCĐ ====
Căn cứ áp dụng trong app:
- TT 02/2025/TT-BGDĐT: Khung NLS gồm 6 miền, 24 năng lực thành phần, dùng để xây dựng/đánh giá yêu cầu năng lực số.
- Công văn 3456/BGDĐT-GDPT: triển khai NLS cho học sinh phổ thông; lớp 10-12 thuộc mức Nâng cao 1 (NC1), nhiệm vụ đa dạng và có thể hướng dẫn người khác.
- QĐ 3439/QĐ-BGDĐT: năng lực AI có 4 mạch NLa/NLb/NLc/NLd và yêu cầu riêng cho từng lớp THPT.
Quy tắc không được vi phạm:
${gradeRule}
- Không coi các mã tạm kiểu "10.A1.a", "11.A2.a", "12.A3.a" là mã NL AI hợp lệ.
- Không trộn mã NLS (ví dụ 1.1.NC1a) với mã NL AI (ví dụ 10.C2.01).
- Không gán mã chỉ để đủ số lượng. Nếu YCCĐ không có điểm chạm rõ, ghi "Không tích hợp" hoặc "Không gán mã".
- Với NL AI, trước khi ghi mã phải ghi tên thành phần năng lực AI. Mỗi mã được chọn phải có chuỗi chứng minh: tên thành phần năng lực AI -> hành vi học sinh -> YCCĐ AI -> mã NL AI -> sản phẩm -> tiêu chí -> minh chứng.
${subjectRule}
${yccd ? `YCCĐ đầu vào cần bám sát:\n${yccd}` : ""}
`;
};

const SOCIAL_INTEGRATION_GUIDELINES = `
Dưới đây là Khung NỘI DUNG LỒNG GHÉP BẮT BUỘC theo quy định của Bộ GD&ĐT (đây là các nội dung lồng ghép RIÊNG BIỆT, KHÔNG phải Thông tư 02/2025 - TT02/2025 là Khung Năng lực số cho người học):

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
# QUY TẮC THỰC THI "KỊCH BẢN CHI TIẾT"(CV 5512 + QĐ 3439)

1. BÁM SÁT HỌC LIỆU: Trích xuất 100 % kiến thức từ tài liệu / đề bài cung cấp.Chỉ bổ sung Năng lực AI và các mô phỏng trực quan.
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
Trước khi nêu mã chỉ báo năng lực AI từ QĐ 3439, bắt buộc ghi tên thành phần năng lực AI; chỉ dùng mã đúng định dạng lớp hiện tại (vd 11.A1.01, 12.C2.01) khi có căn cứ YCCĐ.
Mô tả chi tiết trong chính 4 bước CV 5512: GV hướng dẫn HS dùng công cụ AI gì, prompt nào, kiểm chứng ra sao, sản phẩm phục vụ đúng mục tiêu nào.
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
  socialIntegrations?: string[]; // ["Heritage", "DrugPrevention", "Population", "Inclusive"]
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
  const competencyGuardrails = getThptCompetencyGuardrails("môn học đang xét", grade, objectives);
  const prompt = `Bạn là một chuyên gia giáo dục phân tích Kế hoạch bài dạy.
Nhiệm vụ: Dựa vào Tên bài học, Mục tiêu, và Khối lớp, hãy đề xuất 3 đến 5 chỉ báo Năng lực số (NLS) hoặc Năng lực AI phù hợp nhất để tích hợp vào bài học này.
- Tên bài học: ${topic}
- Khối lớp: ${grade}
- Mục tiêu/Yêu cầu cần đạt: ${objectives}

${competencyGuardrails}
${AI_COMPETENCY_ORDER_RULE}

Hãy phân tích và trả về kết quả định dạng JSON array chuẩn, mỗi object chứa 2 trường:
- "code": mã chỉ báo hợp lệ. Với THPT, mã NLS dùng dạng "1.1.NC1a"; mã NL AI dùng dạng "${extractGradeNumber(grade)}.C2.01".
- "rationale": Lý do ngắn gọn tại sao chỉ báo này phù hợp với bài học này (dưới 30 từ). Nếu là mã NL AI, rationale bắt buộc mở đầu bằng tên thành phần năng lực AI trước khi giải thích và nêu mã.

Đảm bảo chỉ trả về mảng JSON, không có code block markdown hay giải thích thêm.`;

  const result = await ai.models.generateContent({ model: config.aiModel, contents: prompt });
  const text = stripMarkdownJson(result.text ?? "");
  try {
    return JSON.parse(text) as { code: string; rationale: string }[];
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
  const detectedGrade = detectThptGradeFromText(fileText, pl1Data);
  const genericThptGuardrails = getThptCompetencyGuardrails("môn học trong giáo án", detectedGrade);
  const detectedGradeInstruction = detectedGrade
    ? `\nLỚP ĐÃ PHÁT HIỆN TỪ GIÁO ÁN GỐC: ${detectedGrade}. Mọi mã NL AI trong aiSuggestions BẮT BUỘC bắt đầu bằng "${detectedGrade}."; tuyệt đối không dùng mã lớp khác.`
    : `\nTrước khi đề xuất aiSuggestions, phải trích xuất chính xác lớp từ giáo án. Mã NL AI bắt buộc bắt đầu bằng đúng lớp vừa trích xuất; ví dụ nếu lớp là 12 thì dùng 12.A1.01, không dùng 10.* hoặc 11.*.`;

  // Build the textbook image section of the prompt
  const textbookSection = hasImages
    ? `\n\n--- TRANG SÁCH GIÁO KHOA MỚI (${textbookImages!.length} ảnh) ---\nBên cạnh giáo án cũ, hãy phân tích các ảnh chụp trang sách giáo khoa mới được đính kèm và:
A. Xác định các kiến thức/hoạt động/nội dung MỚI xuất hiện trong sách giáo khoa mà GIÁO ÁN CŨ CÒN THIẾU.
B. Đề xuất thêm những điểm cần bổ sung vào trường "newContentFromTextbook" (mảng chuỗi) trong JSON đầu ra.
C. Đề xuất các hoạt động tích hợp chủ đề xã hội bắt buộc TT02/2025 (Di sản, Dân số, Phòng chống Ma túy/Thuốc lá) phù hợp với nội dung SGK mới.`
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
      "suggestedNLS": "Mã NLS TT 02/CV 3456 đúng cấp/lớp, ví dụ 1.1.NC1a; nếu không đủ căn cứ ghi 'Không gán mã - lý do: ...'",
      "suggestedAI": "Mã chỉ báo AI chuẩn đúng lớp (vd: nếu grade là 12 thì 12.A1.01; không dùng 10.*)",
      "aiCompetencyName": "Tên thành phần năng lực AI trước khi ghi mã, ví dụ: NLa - Tư duy lấy con người làm trung tâm",
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
      "reason": "Lý do phù hợp",
      "action": "HS sẽ làm gì với AI?"
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
3. Trọng tâm: Phân tích xem giáo án gốc HIỆN CÓ năng lực AI theo QĐ 3439 chưa. Chỉ ra 3-5 vị trí TỐT NHẤT có thể lồng ghép AI, nhưng chỉ gán mã NLS/NL AI khi có căn cứ trực tiếp từ YCCĐ và hoạt động học sinh. Với lớp 10-12, trường suggestedNLS phải dùng mức NC1 theo TT 02/CV 3456 (ví dụ '1.1.NC1a') và trường suggestedAI phải bắt đầu đúng lớp của giáo án. Mỗi gợi ý phải có yccdEvidence để sau đó đưa vào mục I. MỤC TIÊU, đồng thời phải có đủ các trường aiCompetencyName, aiStudentBehavior, aiYccd, aiProduct, aiCriteria, aiEvidence.${detectedGradeInstruction}${AI_COMPETENCY_ORDER_RULE}${textbookSection}${pl1Section}
4. RIÊNG MÔN ĐỊA LÍ: Nếu bài/hoạt động có bảng số liệu, biểu đồ, AQI, tài nguyên, dân số, kinh tế, khí hậu, diện tích, sản lượng, GRDP hoặc yêu cầu nhận xét - giải thích số liệu, trường geoDataRequirement BẮT BUỘC có bảng số liệu và biểu đồ. Không được chỉ ghi chung chung "phân tích dữ liệu"; phải nêu bảng, nguồn kiểm chứng, loại biểu đồ và nhiệm vụ HS.

${genericThptGuardrails}

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
3. Trọng tâm: Phân tích xem giáo án gốc HIỆN CÓ năng lực AI theo QĐ 3439 chưa. Chỉ ra 3-5 vị trí TỐT NHẤT có thể lồng ghép AI, nhưng chỉ gán mã NLS/NL AI khi có căn cứ trực tiếp từ YCCĐ và hoạt động học sinh. Với lớp 10-12, trường suggestedNLS phải dùng mức NC1 theo TT 02/CV 3456 (ví dụ '1.1.NC1a') và trường suggestedAI phải bắt đầu đúng lớp của giáo án. Mỗi gợi ý phải có yccdEvidence để sau đó đưa vào mục I. MỤC TIÊU, đồng thời phải có đủ các trường aiCompetencyName, aiStudentBehavior, aiYccd, aiProduct, aiCriteria, aiEvidence.${detectedGradeInstruction}${AI_COMPETENCY_ORDER_RULE}${textbookSection}${pl1Section}
4. RIÊNG MÔN ĐỊA LÍ: Nếu bài/hoạt động có bảng số liệu, biểu đồ, AQI, tài nguyên, dân số, kinh tế, khí hậu, diện tích, sản lượng, GRDP hoặc yêu cầu nhận xét - giải thích số liệu, trường geoDataRequirement BẮT BUỘC có bảng số liệu và biểu đồ. Không được chỉ ghi chung chung "phân tích dữ liệu"; phải nêu bảng, nguồn kiểm chứng, loại biểu đồ và nhiệm vụ HS.

${genericThptGuardrails}

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
              suggestedNLS: { type: Type.STRING },
              suggestedAI: { type: Type.STRING },
              aiCompetencyName: { type: Type.STRING },
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
              reason: { type: Type.STRING },
              action: { type: Type.STRING }
            },
            required: ["activityName", "suggestedNLS", "suggestedAI", "aiCompetencyName", "aiStudentBehavior", "aiYccd", "aiProduct", "aiCriteria", "aiEvidence", "yccdEvidence", "reason", "action"]
          }
        }
      },
      required: ["subject", "grade", "topic", "duration", "aiSuggestions"]
    });
    return sanitizeAnalysisResultCompetencies(analysis, detectedGrade, fileText);
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
  const englishConstraint = isEnglish ? `LỆNH TỐI CẤP (NGÔN NGỮ): BẮT BUỘC SỬ DỤNG 100% TIẾNG ANH (ENGLISH) CHO TOÀN BỘ NỘI DUNG. KHÔNG ĐƯỢC CHỨA BẤT KỲ TỪ TIẾNG VIỆT NÀO.` : ``;
  const competencyGuardrails = getThptCompetencyGuardrails(subject, grade);
  const sanitizedSuggestions = (aiSuggestions || []).map((suggestion) => {
    const sanitized = sanitizeAiCodeForGrade(suggestion?.suggestedAI, grade);
    const finalAiCode = sanitized.code;
    const yccdEvidence = suggestion?.yccdEvidence || suggestion?.aiYccd || suggestion?.reason || "Chưa có căn cứ YCCĐ riêng trong phản hồi AI.";
    const action = suggestion?.action || suggestion?.aiStudentBehavior || "Học sinh thực hiện nhiệm vụ học tập có sử dụng AI dưới sự hướng dẫn của giáo viên.";
    return {
      ...suggestion,
      suggestedAI: finalAiCode,
      aiCompetencyName: suggestion?.aiCompetencyName || getAiCompetencyComponentName(finalAiCode),
      aiStudentBehavior: suggestion?.aiStudentBehavior || action,
      aiYccd: suggestion?.aiYccd || yccdEvidence,
      aiProduct: suggestion?.aiProduct || suggestion?.product || "Sản phẩm học tập có sử dụng AI và được học sinh chỉnh sửa/kiểm chứng.",
      aiCriteria: suggestion?.aiCriteria || suggestion?.criteria || "Đúng kiến thức môn học; dùng AI đúng mục đích; biết kiểm chứng nguồn và giải thích cách điều chỉnh kết quả AI.",
      aiEvidence: suggestion?.aiEvidence || suggestion?.evidence || "Prompt đã dùng, nguồn kiểm chứng, bản chỉnh sửa của học sinh và sản phẩm cuối.",
      yccdEvidence,
      action,
      reason: appendSanitizerNote(suggestion?.reason, sanitized.note),
      geoDataRequirement: suggestion?.geoDataRequirement || buildGeoDataRequirement({ subject, grade, topic }, suggestion),
    };
  });
  const hasGeoDataRequirement = sanitizedSuggestions.some((suggestion) => suggestion?.geoDataRequirement);

  const prompt = `Bạn là chuyên gia thiết kế Hoạt động Trí tuệ Nhân tạo (AI) cho học sinh.
Thông tin bài học: Môn ${subject}, Lớp ${grade}, Bài: ${topic}.
Dưới đây là các gợi ý tích hợp AI đã được phê duyệt:
${JSON.stringify(sanitizedSuggestions, null, 2)}

${competencyGuardrails}

Nhiệm vụ: Viết MỘT ĐOẠN GHI CHÚ BỔ SUNG cho mỗi hoạt động để app CHÈN THÊM vào chính file DOCX gốc của giáo viên. TUYỆT ĐỐI KHÔNG viết lại giáo án, không tóm tắt giáo án, không thay thế bảng/biểu/hình/công thức đang có trong file gốc. Đoạn bổ sung này sẽ được app tự định dạng chữ màu đỏ trong Word, vì vậy không cần bọc thẻ <ai>.
Đoạn văn này phải mô tả rõ:
1. Nhiệm vụ cụ thể của học sinh với công cụ AI.
2. Câu lệnh Prompt gợi ý (nếu có).
3. Yêu cầu sản phẩm.
4. Có gắn mã NLS TT 02/CV 3456 và mã chỉ báo AI đúng lớp. Nếu lớp ${grade} thì mã NL AI phải bắt đầu bằng ${extractGradeNumber(grade)}.; nếu gợi ý đang là "Không gán mã" thì không tự tạo mã mới.
5. Phải viết sao cho đoạn này có thể đồng thời đưa vào mục I. MỤC TIÊU, III. TIẾN TRÌNH và IV. ĐÁNH GIÁ.
${AI_COMPETENCY_ORDER_RULE}
${hasGeoDataRequirement ? `6. RIÊNG MÔN ĐỊA LÍ: Với mọi gợi ý có geoDataRequirement, đoạn "text" BẮT BUỘC chứa:
- Một mục "Bảng số liệu bắt buộc:" kèm bảng Markdown từ sampleTableMarkdown.
- Một dòng thẻ biểu đồ đúng mẫu [Biểu đồ: ...].
- Nguồn kiểm chứng số liệu và nhiệm vụ HS nhận xét/giải thích biểu đồ.
Không được chỉ viết chung chung "phân tích dữ liệu" hoặc "vẽ biểu đồ" mà không có bảng số liệu.` : ""}

${englishConstraint}

TRẢ VỀ ĐÚNG ĐỊNH DẠNG JSON MẢNG:
[
  {
    "activityName": "Tên hoạt động",
    "text": "Nội dung đoạn văn chi tiết (Khoảng 3-5 câu, rõ ràng, thực tế, sư phạm)."
  }
]`;

  try {
    return await callGeminiWithFallback(prompt, {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          activityName: { type: Type.STRING },
          text: { type: Type.STRING }
        },
        required: ["activityName", "text"]
      }
    });
  } catch (err) {
    console.error("Error generating snippets:", err);
    throw err;
  }
};

export const parseCurriculumAppendix = async (rawText: string, pdfBase64?: string) => {
  const apiKey = localStorage.getItem('GEMINI_API_KEY');
  if (!apiKey) throw new Error('API_KEY_REQUIRED');
  const startModel = localStorage.getItem('GEMINI_MODEL') || 'gemini-3.5-flash';
  const modelsToTry = getFallbackModels(startModel);

  const instruction = `Bạn là chuyên gia phân phối chương trình giáo dục.

QUY TẮC BẮT BUỘC(THỰC THI NGHIÊM NGẶT):
1. BẮT BUỘC bóc tách TẤT CẢ bài học có trong nội dung(KHÔNG ĐƯỢC bỏ sót bài nào, dù ngắn hay dài).
2. Mỗi bài học / chủ đề / tiết kiểm tra là một object riêng biệt trong mảng JSON.
3. TUYỆT ĐỐI không gộp nhiều bài thành một, không rút gọn, không tóm tắt.
4. Giữ nguyên tên bài học chính xác từng chữ như trong gốc.
5. Bỏ qua thông tin tiêu đề trang, quốc hiệu, chữ ký cán bộ.
6. Chỉ gộp nếu một tiết kiểm tra xuất hiện nhiều lần liên tiếp với tên GIỐNG HỆT nhau.

Trạng thái: Trả về ĐÚNG định dạng JSON array (không có markdown, không có giải thích). Nếu bảng gốc có cột "Yêu cầu cần đạt" hoặc tương tự, hãy đưa nội dung đó vào thuộc tính "yccd".
[{ "lessonName": "Tên bài", "periods": 2, "timing": "Tuần 1", "yccd": "Nội dung Yêu cầu cần đạt nếu có" }, ...]`;

  let parts: any[];
  if (pdfBase64) {
    parts = [
      { text: instruction + '\n\nHãy phân tích PDF đính kèm và trích xuất toàn bộ danh sách bài học.' },
      { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } }
    ];
  } else {
    parts = [{ text: instruction + `\n\nVĂN BẢN GỐC: \n"""\n${rawText.substring(0, 25000)}\n"""` }];
  }

  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseMimeType: 'application/json',
      maxOutputTokens: 8192,
      temperature: 0,
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
      if (!text) throw new Error('AI trả về phản hồi rỗng khi phân tích phụ lục.');

      // Step 1: Try direct parse (may be plain array)
      let parsed: any = null;
      try { parsed = JSON.parse(text); } catch { /* not pure JSON */ }

      // Step 2: If wrapped in object (e.g. {"lessons":[...]}, {"data":[...]}), extract array
      if (parsed && !Array.isArray(parsed) && typeof parsed === 'object') {
        const keys = Object.keys(parsed);
        for (const k of keys) {
          if (Array.isArray(parsed[k]) && parsed[k].length > 0) {
            parsed = parsed[k];
            break;
          }
        }
      }

      // Step 3: Regex extract from markdown code block or raw text
      if (!Array.isArray(parsed)) {
        const match = text.match(/\[[\s\S]*\]/);
        if (match) {
          try { parsed = JSON.parse(match[0]); } catch { /* ignore */ }
        }
      }

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
  const formattingNeed = input.useLaTeX || input.detailDrawings || ["Toán học", "Vật lý", "Hóa học", "Địa lí"].includes(input.subject);
  const englishConstraint = (input.subject === "Tiếng Anh" || input.subject.toLowerCase().includes("english")) ? "\\nLỆNH ĐẶC BIỆT TỐI QUAN TRỌNG: Môn học là Tiếng Anh nên TOÀN BỘ nội dung giáo án (kịch bản GV-HS, mục tiêu, nội dung...) PHẢI ĐƯỢC VIẾT 100% BẰNG TIẾNG ANH (ENGLISH). ĐẶC BIỆT, KHI NỘI DUNG TÍCH HỢP NĂNG LỰC SỐ (NLS) VÀ NĂNG LỰC AI (NLAI) ĐƯỢC KHỞI TẠO, CHÚNG CŨNG BẮT BUỘC PHẢI ĐƯỢC VIẾT BẰNG TIẾNG ANH." : "";
  const lessonYccd = [input.objectivesKnowledge, input.objectivesCompetency, input.objectivesQuality].filter(Boolean).join("\n");
  const competencyGuardrails = getThptCompetencyGuardrails(input.subject, input.grade, lessonYccd);
  const safeIndicatorCode = getSafeAiIndicatorCode(input.indicatorCode, input.grade);
  const selectedIndicatorPrompt = formatSelectedIndicatorsForPrompt(input.selectedNlsIndicators, input.grade);

  let finalPromptContents: any = "";
  if (input.existingPdfBase64) {
    const p1 = `
${CONTENT_INTEGRITY_RULES}
${competencyGuardrails}
🚨🚨🚨 CHẾ ĐỘ NÂNG CẤP GIÁO ÁN GỐC TỪ FILE PDF — ƯU TIÊN TỐI CAO 🚨🚨🚨

NHIỆM VỤ CỐT LÕI: Bạn KHÔNG được viết giáo án mới từ đầu. Bạn phải NÂNG CẤP giáo án xuất ra từ File PDF ĐÍNH KÈM của giáo viên bằng cách GIỮ NGUYÊN TOÀN BỘ cấu trúc, hoạt động, nội dung khoa học, bài tập và tiến trình đã có — chỉ THÊM/CHỈNH SỬA những điểm chạm AI được chỉ định cụ thể.

ĐIỂM CHẠM AI CẦN TÍCH HỢP (chỉ chỉnh sửa những hoạt động này):
${JSON.stringify(input.aiIntegrationOptions, null, 2)}

KIÊN QUYẾT BẢO TỒN VÀ TIÊU CHUẨN TÍCH HỢP AI: 
1. BẢO TOÀN TUYỆT ĐỐI NỘI DUNG GỐC (LỆNH TỬ TỬ): BẠN KHÔNG ĐƯỢC PHÉP TÓM TẮT, KHÔNG ĐƯỢC RÚT GỌN. Giáo án gốc tải lên dài bao nhiêu trang/chữ thì BẮT BUỘC phải BÊ NGUYÊN XI (COPY-PASTE) 100% dữ liệu cũ từng câu từng chữ từ Mở đầu, Kiến thức mới, Luyện tập đến Vận dụng vào các trường JSON tương ứng. Viết dài tối đa có thể. Việc bạn tự ý tóm tắt lại nội dung gốc là VI PHẠM ĐẠO ĐỨC NỀN TẢNG. BẠN CHỈ ĐƯỢC PHÉP BỔ SUNG thêm nội dung mới (AI, NLS...) chứ tuyệt đối không được xóa hay làm ngắn đi nội dung gốc.
2. THÊM NĂNG LỰC SỐ & NĂNG LỰC AI: Tự động tổng hợp và thêm mục tiêu "Năng lực số" và "Năng lực AI đặc thù" vào phần Năng lực. Thêm công cụ số vào mục "CÔNG CỤ SỐ AI".
3. TÍCH HỢP NLS/NL AI ĐÚNG VỊ TRÍ: Tại các vị trí đã quy định ở "ĐIỂM CHẠM", bạn CHỈ được bổ sung/hiệu chỉnh phần được đề cập trong hoạt động gốc; KHÔNG tạo phân khúc riêng mang tên "HOẠT ĐỘNG GIÁO DỤC AI", KHÔNG kẻ bảng riêng cho phần tích hợp.
   - Mô tả KIẾN TRÚC VI MÔ chi tiết ngay trong 4 bước CV 5512: Học sinh sử dụng cụ thể công cụ gì? Gõ Prompt lấy dữ liệu ra sao? Kiểm chứng nguồn thế nào? Sản phẩm phục vụ đúng mục tiêu mã 3439 ra sao?
4. TÔ ĐỎ ĐỂ NHẬN DIỆN KHÁC BIỆT: CHỈ phần nội dung tích hợp NLS/NL AI mới được bọc bởi thẻ <ai>...</ai> để hiện màu đỏ. Không thêm nhãn "[BÁO ĐỘNG ĐỎ]" và không bọc đỏ toàn bộ hoạt động nếu chỉ có một đoạn nhỏ được tích hợp.
5. LỆNH MÃ CHỈ BÁO: Trong mục \`aiSpecific\` của JSON đầu ra, mỗi dòng mục tiêu AI phải ghi tên thành phần năng lực AI trước khi ghi mã chỉ báo và chỉ dùng mã khi mã đó đã khớp YCCĐ. ${safeIndicatorCode ? `Có mã NL AI hợp lệ từ hệ thống: (${safeIndicatorCode}); vẫn phải chứng minh bằng YCCĐ trước khi dùng.` : `Không được tự bịa mã. Nếu có điểm chạm rõ với QĐ 3439 thì chọn mã đúng lớp ${extractGradeNumber(input.grade)} và đúng chủ đề; nếu không đủ căn cứ thì ghi "Không tích hợp".`}.
${AI_COMPETENCY_ORDER_RULE}
${selectedIndicatorPrompt}
${input.additionalNotes ? `\nGHI CHÚ TÍCH HỢP BẮT BUỘC TỪ GIÁO VIÊN/APP:\n${input.additionalNotes}\nLỆNH BẮT BUỘC: Toàn bộ nội dung trong ghi chú này phải được thể hiện lại trong giáo án ở ít nhất 3 vị trí: I. MỤC TIÊU, III. TIẾN TRÌNH DẠY HỌC và IV. KẾ HOẠCH ĐÁNH GIÁ. Không được bỏ qua.` : ""}
${englishConstraint}
${formattingNeed ? FORMATTING_INSTRUCTIONS : ""}
${LESSON_PLAN_STRICT_GUIDELINES}
${input.subject.toLowerCase().includes("địa") ? GEOGRAPHY_AI_RULES : ""}
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

ĐIỂM CHẠM AI CẦN TÍCH HỢP(chỉ chỉnh sửa những hoạt động này):
${JSON.stringify(input.aiIntegrationOptions, null, 2)}

KIÊN QUYẾT BẢO TỒN VÀ TIÊU CHUẨN TÍCH HỢP AI:
1. BẢO TOÀN TUYỆT ĐỐI NỘI DUNG GỐC (LỆNH TỬ TỬ): BẠN KHÔNG ĐƯỢC PHÉP TÓM TẮT, KHÔNG ĐƯỢC RÚT GỌN. Giáo án gốc tải lên dài bao nhiêu trang/chữ thì BẮT BUỘC phải BÊ NGUYÊN XI (COPY-PASTE) 100% dữ liệu cũ từng câu từng chữ từ Mở đầu, Kiến thức mới, Luyện tập đến Vận dụng vào các trường JSON tương ứng. Viết dài tối đa có thể. Việc bạn tự ý tóm tắt lại nội dung gốc là VI PHẠM ĐẠO ĐỨC NỀN TẢNG. BẠN CHỈ ĐƯỢC PHÉP BỔ SUNG thêm nội dung mới (AI, NLS...) chứ tuyệt đối không được xóa hay làm ngắn đi nội dung gốc.
2. THÊM NĂNG LỰC SỐ & NĂNG LỰC AI: Tự động tổng hợp và thêm mục tiêu "Năng lực số" và "Năng lực AI đặc thù" vào phần Năng lực. Thêm công cụ số vào mục "CÔNG CỤ SỐ AI".
3. TÍCH HỢP NLS/NL AI ĐÚNG VỊ TRÍ: Tại các vị trí đã quy định ở "ĐIỂM CHẠM", bạn CHỈ được bổ sung/hiệu chỉnh phần được đề cập trong hoạt động gốc; KHÔNG tạo phân khúc riêng mang tên "HOẠT ĐỘNG GIÁO DỤC AI", KHÔNG kẻ bảng riêng cho phần tích hợp.
   - Mô tả KIẾN TRÚC VI MÔ chi tiết ngay trong 4 bước CV 5512: Học sinh sử dụng cụ thể công cụ gì? Gõ Prompt lấy dữ liệu ra sao? Kiểm chứng nguồn thế nào? Sản phẩm phục vụ đúng mục tiêu mã 3439 ra sao?
4. TÔ ĐỎ ĐỂ NHẬN DIỆN KHÁC BIỆT: CHỈ phần nội dung tích hợp NLS/NL AI mới được bọc bởi thẻ <ai>...</ai> để hiện màu đỏ. Không thêm nhãn "[BÁO ĐỘNG ĐỎ]" và không bọc đỏ toàn bộ hoạt động nếu chỉ có một đoạn nhỏ được tích hợp.
5. LỆNH MÃ CHỈ BÁO: Trong mục \`aiSpecific\` của JSON đầu ra, mỗi dòng mục tiêu AI phải ghi tên thành phần năng lực AI trước khi ghi mã chỉ báo và chỉ dùng mã khi mã đó đã khớp YCCĐ. ${safeIndicatorCode ? `Có mã NL AI hợp lệ từ hệ thống: (${safeIndicatorCode}); vẫn phải chứng minh bằng YCCĐ trước khi dùng.` : `Không được tự bịa mã. Nếu có điểm chạm rõ với QĐ 3439 thì chọn mã đúng lớp ${extractGradeNumber(input.grade)} và đúng chủ đề; nếu không đủ căn cứ thì ghi "Không tích hợp".`}.
${AI_COMPETENCY_ORDER_RULE}
${selectedIndicatorPrompt}
${input.additionalNotes ? `\nGHI CHÚ TÍCH HỢP BẮT BUỘC TỪ GIÁO VIÊN/APP:\n${input.additionalNotes}\nLỆNH BẮT BUỘC: Toàn bộ nội dung trong ghi chú này phải được thể hiện lại trong giáo án ở ít nhất 3 vị trí: I. MỤC TIÊU, III. TIẾN TRÌNH DẠY HỌC và IV. KẾ HOẠCH ĐÁNH GIÁ. Không được bỏ qua.` : ""}
${englishConstraint}
${formattingNeed ? FORMATTING_INSTRUCTIONS : ""}
${LESSON_PLAN_STRICT_GUIDELINES}
${input.subject.toLowerCase().includes("địa") ? GEOGRAPHY_AI_RULES : ""}
${SOCIAL_INTEGRATION_GUIDELINES}
` : "";
  }

  const basePrompt = `
    Vai trò: Bạn là một Chuyên gia Giáo dục hàng đầu quốc gia, là người xét duyệt giáo án thi giáo viên giỏi xuất sắc.Bạn am hiểu sâu sắc Chương trình GDPT 2018, Công văn 5512 / BGDĐT - GDTrH và Khung giáo dục Trí tuệ nhân tạo(AI) theo Quyết định 3439 / QĐ - BGDĐT. 
    Lệnh đặc biệt: Hãy soạn một Giáo án(Kế hoạch bài dạy) SIÊU CHI TIẾT, thật sự chuyên sâu, logic, chặt chẽ, cụ thể từng lời nói và hành động mô phỏng thực tế lớp học cho:
    Môn học: ${input.subject}
    Tên bài dạy: ${input.topic}
    Lớp: ${input.grade} - Thời lượng: ${input.duration}
    Hoàn cảnh học sinh: ${input.contextStudents || "Học sinh có khả năng tiếp thu trung bình - khá"}
    Điều kiện trường lớp: ${input.contextSchool || "Lớp học có máy chiếu và kết nối internet cơ bản"}
    ${input.objectivesKnowledge ? `Mục tiêu kiến thức yêu cầu: ${input.objectivesKnowledge}` : ""}
    ${input.objectivesCompetency ? `Mục tiêu năng lực yêu cầu: ${input.objectivesCompetency}` : ""}
    ${input.objectivesQuality ? `Mục tiêu phẩm chất yêu cầu: ${input.objectivesQuality}` : ""}
    ${input.additionalNotes ? `GHI CHÚ TÍCH HỢP BẮT BUỘC TỪ GIÁO VIÊN/APP:\n${input.additionalNotes}\nLỆNH BẮT BUỘC: Toàn bộ nội dung trong ghi chú này phải được thể hiện lại trong giáo án ở ít nhất 3 vị trí: I. MỤC TIÊU, III. TIẾN TRÌNH DẠY HỌC và IV. KẾ HOẠCH ĐÁNH GIÁ. Không được bỏ qua.` : ""}
    Lưu ý riêng về độ tuổi(Nếu là khối 6, 7, 8, 9): Giáo án CẦN TĂNG CƯỜNG thực hành, thao tác trực quan, và trò chơi hóa(gamification).Hạn chế những câu hỏi thảo luận mang tính triết học nặng nề của cấp 3.

    ${AI_SUBJECT_GUIDELINES}
    ${SOCIAL_INTEGRATION_GUIDELINES}
    ${competencyGuardrails}
    ${input.socialIntegrations && input.socialIntegrations.length > 0 ? `\nLỆNH BẮT BUỘC TÍCH HỢP NỘI DUNG XÃ HỘI: Bạn PHẢI tích hợp sâu sắc các nội dung sau vào kế hoạch bài dạy: ${input.socialIntegrations.join(", ")}. Hãy thể hiện rõ trong mục tiêu và các hoạt động học tập.` : ""}
    CHỈ BÁO QĐ 3439 - Định dạng bắt buộc: KHỐI_LỚP_HIỆN_TẠI.MẠCH_VÀ_CHỦ_ĐỀ.SỐ (vd: ${input.grade}.C1.01, ${input.grade}.B2.02, ${input.grade}.A3.02).
      ${safeIndicatorCode ? `\nMÃ NL AI HỢP LỆ TỪ HỆ THỐNG: ${safeIndicatorCode}. Chỉ khai báo trong mục "Năng lực AI đặc thù" nếu chứng minh được mã này bám sát YCCĐ môn học.` : ""}
      ${selectedIndicatorPrompt}
    ${AI_COMPETENCY_ORDER_RULE}
    ${CURRICULUM_DATA}
    ${formattingNeed ? FORMATTING_INSTRUCTIONS : ""}
    ${englishConstraint}

    YÊU CẦU NỘI DUNG NGHIÊM NGẶT(CHUẨN CV 5512 và QĐ 3439):

    QUY TẮC THỰC THI NGHIÊM NGẶT(CRITICAL RULES):
    1. KIỂM TRA ĐIỀU KIỆN TÍCH HỢP:
    - ${safeIndicatorCode ? "Có mã NL AI hợp lệ từ hệ thống. Phải kiểm tra lại YCCĐ trước khi tích hợp vào đúng hoạt động gốc; nếu không có điểm chạm thật sự thì nêu lý do không gán." : "Tự động đánh giá nội dung bài học để xem có khả năng tích hợp AI hay không. Nếu không tích hợp thì để trống mục Năng lực AI. Nếu có tích hợp thì chỉ bổ sung vào đúng hoạt động gốc, không tạo hoạt động AI riêng."}
    2. MÔ TẢ CÔNG CỤ SỐ AI: Trong hoạt động có tích hợp, phải mô tả cụ thể việc sử dụng các công cụ AI(ChatGPT, Canva, chatbot...) để hỗ trợ học sinh đạt được năng lực tương ứng.
    3. GẮN MÃ CHỈ BÁO: Tại hoạt động tích hợp, trước khi ghi mã NL AI BẮT BUỘC ghi tên thành phần năng lực AI, sau đó mới ghi mã chỉ báo theo định dạng [Khối lớp].[Ký hiệu Mạch NL (A/B/C/D) + Số thứ tự Chủ đề (1,2,3...)].[STT YCCĐ] (Ví dụ: ${input.grade}.A1.01, ${input.grade}.C2.02). Tuyệt đối khối lớp phải khớp với ${input.grade}. MÃ ĐÚNG CHỈ CÓ 2 DẤU CHẤM, KHÔNG ĐƯỢC CHÈN THÊM CHỮ CÁI THỪA (Không được viết 10.A.A1.1 hay 10.C3.A2.1).
    4. ĐÁNH DẤU MÀU ĐỎ: Chỉ sử dụng thẻ <ai>...</ai> cho đúng đoạn nội dung có tích hợp NLS/NL AI để đoạn đó hiện màu đỏ. Không dùng nhãn "[BÁO ĐỘNG ĐỎ]" và không kẻ bảng riêng cho phần tích hợp.

    I.MỤC TIÊU:
    - Kiến thức: Nêu rõ kiến thức cốt lõi. (Theo CV 5512).
    - Năng lực:
    + Đặc thù môn học: Theo chương trình 2018.
      + Năng lực số: Xác định rõ các năng lực số học sinh đạt được (sử dụng phần mềm, khai thác thông tin, an toàn mạng...). Với lớp 10-12, mã phải là NC1 theo Công văn 3456 (Ví dụ: '... (1.1.NC1a)', '... (2.4.NC1b)', '... (3.2.NC1a)'). Chỉ gắn mã khi có minh chứng từ YCCĐ.
      + Năng lực AI đặc thù(Chỉ thêm nếu Có tích hợp AI): Chỉ trả về mảng string, mỗi chuỗi trình bày đúng thứ tự: Tên thành phần năng lực AI -> hành vi học sinh -> yêu cầu cần đạt AI -> mã NL AI -> sản phẩm -> tiêu chí -> minh chứng. ${safeIndicatorCode ? `(Mã hệ thống hợp lệ cần xem xét: ${safeIndicatorCode})` : `(Không tự bịa mã; nếu thiếu căn cứ thì để trống/ghi "Không tích hợp")`}.
      + Năng lực chung: Tự chủ, tự học; Giao tiếp...
    - Phẩm chất: Theo CV 5512.

    II.THIẾT BỊ DẠY HỌC VÀ HỌC LIỆU: Đảm bảo theo quy định 5512(thêm Công cụ số AI nếu Có tích hợp).

      III.TIẾN TRÌNH DẠY HỌC(CHI TIẾT):
    ${LESSON_PLAN_STRICT_GUIDELINES}
    
    Phân bổ 4 hoạt động chuẩn 5512:
    1. Hoạt động 1. KHỞI ĐỘNG.
    2. Hoạt động 2. HÌNH THÀNH KIẾN THỨC MỚI.
    3. Hoạt động 3. LUYỆN TẬP.
    4. Hoạt động 4. VẬN DỤNG.
    (LƯU Ý: Với bài học có tích hợp AI, phải lồng ghép khéo léo nội dung tích hợp, mã chỉ báo và thẻ <ai>...</ai> vào đúng vị trí trong 1 trong 4 bước trên sao cho phù hợp; không tạo hoạt động AI riêng).

      IV.KẾ HOẠCH ĐÁNH GIÁ:
    BẮT BUỘC thiết kế tiêu chí đánh giá kỹ năng tương tác với AI và khả năng phản biện.QUAN TRỌNG: Tại phần Bài kiểm tra ngắn(Quiz), BẮT BUỘC phải viết nội dung cụ thể của 2 - 3 câu hỏi trắc nghiệm(gồm câu hỏi, 4 đáp án A B C D và đáp án đúng) thay vì chỉ ghi chung chung là "có 5 câu hỏi".

      V.PHỤ LỤC:
    Gợi ý 3 - 5 mẫu lệnh Prompt cụ thể cho bài học này để HS thực hành.

    Định dạng đầu ra: JSON.
  `;

  try {
    return await callGeminiWithFallback(finalPromptContents || basePrompt, {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        objectives: {
          type: Type.OBJECT,
          properties: {
            knowledge: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Mục tiêu về kiến thức" },
            subjectSpecific: { type: Type.ARRAY, items: { type: Type.STRING } },
            digitalSpecific: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Mục tiêu Năng lực số" },
            aiSpecific: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Mục tiêu Năng lực AI đặc thù. BẮT BUỘC: mỗi chuỗi phải ghi theo thứ tự Tên thành phần năng lực AI -> hành vi học sinh -> yêu cầu cần đạt AI -> mã NL AI -> sản phẩm -> tiêu chí -> minh chứng. Chỉ dùng mã đúng lớp, đúng chủ đề và có căn cứ YCCĐ." },
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
              name: { type: Type.STRING, description: "Tên hoạt động đúng 4 nhóm chuẩn CV 5512, ví dụ: Hoạt động 1. KHỞI ĐỘNG: tên tình huống cụ thể; Hoạt động 2. HÌNH THÀNH KIẾN THỨC MỚI: tên nhiệm vụ; Hoạt động 3. LUYỆN TẬP; Hoạt động 4. VẬN DỤNG." },
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
                    teacherStudentActivities: { type: Type.STRING, description: "Kịch bản GV-HS SIÊU CHI TIẾT. NẾU LÀ NÂNG CẤP GIÁO ÁN, BẮT BUỘC COPY-PASTE 100% TOÀN BỘ NỘI DUNG TỪ BẢN GỐC (dài bao nhiêu chép bấy nhiêu, TUYỆT ĐỐI KHÔNG TÓM TẮT). Phần nội dung chốt kiến thức/kết luận của giáo viên PHẢI được bọc trong thẻ <bold>...</bold> để in đậm. Phần nội dung nào tích hợp AI (ví dụ Prompt, hướng dẫn kỹ năng, chỉ báo 10.A1.01, 10.C2.02...) PHẢI được bọc trong thẻ <ai>...</ai> để bôi đỏ." },
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
  } catch (error) {
    console.error("Error generating lesson plan:", error);
    throw error;
  }
};

export const generateEducationalPlan = async (subject: string, grade: string, province?: string, referencePlan?: any[], options?: { useLaTeX?: boolean, detailDrawings?: boolean, customCurriculumData?: any[], curriculumDbData?: any[], socialIntegrations?: string[] }) => {
  const formattingNeed = options?.useLaTeX || options?.detailDrawings || ["Toán học", "Vật lý", "Hóa học", "Địa lí"].includes(subject);
  const englishConstraint = (subject === "Tiếng Anh" || subject.toLowerCase().includes("english")) ? "\\nLỆNH ĐẶC BIỆT TỐI QUAN TRỌNG: Môn học là Tiếng Anh nên TOÀN BỘ nội dung kế hoạch giáo dục PHẢI ĐƯỢC VIẾT 100% BẰNG TIẾNG ANH (ENGLISH). ĐẶC BIỆT, KHI NỘI DUNG TÍCH HỢP NĂNG LỰC SỐ (NLS) VÀ NĂNG LỰC AI (NLAI) ĐƯỢC KHỞI TẠO, CHÚNG CŨNG BẮT BUỘC PHẢI ĐƯỢC VIẾT BẰNG TIẾNG ANH." : "";
  const competencyGuardrails = getThptCompetencyGuardrails(subject, grade);
  const normalizedCurriculumDbData = options?.curriculumDbData ? normalizeCurriculumCompetencyData(options.curriculumDbData, grade) : undefined;

  const curriculumConstraint = options?.customCurriculumData
    ? `DỮ LIỆU BÀI HỌC BẮT BUỘC TỪ PHỤ LỤC DO GIÁO VIÊN CUNG CẤP:
${JSON.stringify(options.customCurriculumData, null, 2)}
LỆNH VỀ TÊN BÀI HỌC TỐI CAO: TUYỆT ĐỐI tuân thủ danh sách tên bài học và số tiết trong mảng dữ liệu trên.KHÔNG SỬ DỤNG DỮ LIỆU MẶC ĐỊNH KHÁC.`
    : normalizedCurriculumDbData ? `DỮ LIỆU BÀI HỌC TỪ HỆ THỐNG:
${JSON.stringify(normalizedCurriculumDbData.map(l => ({ topic: l.topic, indicatorCode: l.indicatorCode, indicatorNote: l.indicatorNote })), null, 2)}
LỆNH TỐI CẤP: Bạn BẮT BUỘC dùng chính xác danh sách bài học. Trước khi ghi mã AI phải ghi tên thành phần năng lực AI. Chỉ dùng indicatorCode nếu trường này còn tồn tại sau khi hệ thống lọc. Nếu indicatorCode bị bỏ trống hoặc có indicatorNote báo mã tạm/không hợp lệ, phải tự đối chiếu YCCĐ theo QĐ 3439; không đủ căn cứ thì ghi "Không tích hợp/Không gán mã".`
      : CURRICULUM_DATA;

  const referencePrompt = referencePlan
    ? `DỰA TRÊN KẾ HOẠCH TỔ CHUYÊN MÔN SAU ĐÂY ĐỂ ĐỒNG NHẤT NỘI DUNG(BẮT BUỘC):
       ${JSON.stringify(referencePlan.map(i => ({ 
           bài: i.lessonContent, 
           mục_tiêu: i.lessonGoal, 
           ai: i.aiCompetency3439,
           năng_lực_số_TT02: i.digitalCompetencyTT02 
       })), null, 2)}
       
       Yêu cầu: Bạn phải giữ nguyên tên các bài học, mục tiêu AI, và đặc biệt là cột Năng lực số (TT 02) đã có trong kế hoạch tổ chuyên môn ở trên.`
    : "";

  const prompt = `
    ${CONTENT_INTEGRITY_RULES}

    Hãy đóng vai một chuyên gia giáo dục THPT tại Việt Nam.Xây dựng "Khung kế hoạch giáo dục của giáo viên"(Phân phối chương trình cả năm) cho:
    - Môn: ${subject}
    - Lớp: ${grade}
    ${subject === "Giáo dục địa phương" && province ? `- Địa phương (Tỉnh/Thành phố): ${province}` : ""}
    
    ${referencePrompt}
    
    ${AI_SUBJECT_GUIDELINES}
    ${SOCIAL_INTEGRATION_GUIDELINES}
    ${competencyGuardrails}
    ${AI_COMPETENCY_ORDER_RULE}
    ${options?.socialIntegrations?.length ? `\nYÊU CẦU TÍCH HỢP CÔNG VĂN 02/2025: BẮT BUỘC lồng ghép nội dung về: ${options.socialIntegrations.join(", ")}.` : ""}
    ${curriculumConstraint}
    ${formattingNeed ? FORMATTING_INSTRUCTIONS : ""}
    ${englishConstraint}

    YÊU CẦU QUAN TRỌNG VỀ ĐỘ CHÍNH XÁC:
    1. TUÂN THỦ CHƯƠNG TRÌNH GDPT 2018 VÀ SÁCH KNTT:
    - LƯU Ý MÔN ĐỊA LÍ VÀ CÁC MÔN CÒN LẠI: Nội dung, trật tự và tên bài học BẮT BUỘC PHẢI KHỚP TUYỆT ĐỐI VỚI BỘ SÁCH "KẾT NỐI TRI THỨC VỚI CUỘC SỐNG" của NXB Giáo dục Việt Nam. Đảm bảo đầy đủ các đơn vị kiến thức, không được thiếu bài. TUYỆT ĐỐI KHÔNG sử dụng cấu trúc của Cánh Diều hay Chân trời sáng tạo.
    - ĐỐI VỚI MÔN GIÁO DỤC ĐỊA PHƯƠNG: Chỉ trong trường hợp này mới sử dụng nội dung đặc thù của ${province}.
    
    ${curriculumConstraint}

    2. Cấu trúc bảng Phân phối chương trình:
    - Thứ tự tiết: Số thứ tự tiết học.
       - Bài học: Tên bài học theo chương trình.
       - Số tiết: Số lượng tiết dành cho bài học đó.
       - Thời điểm: Tuần hoặc tháng thực hiện(Ví dụ: Tuần 1).
       - Thiết bị dạy học: Các thiết bị truyền thống cần thiết.
       - Công cụ số và AI(BẮT BUỘC): Bám sát định hướng CV 3439:
    + Phương án triển khai: Sử dụng tình huống giả định, nghiên cứu tình huống(case study) hay có công cụ AI trực tiếp.
         + Học liệu / công cụ cụ thể: Các bài báo, video phân tích, các bộ dữ liệu giả định, hoặc tên phần mềm / nền tảng AI sẽ sử dụng.
       - Địa điểm dạy học: Lớp học, phòng máy tính, thư viện...
    - Định hướng năng lực số/AI: Nếu có NL AI, trước khi ghi mã phải ghi tên thành phần năng lực AI. QUY TẮC MÃ: [Khối lớp].[Ký hiệu Mạch NL (A/B/C/D) + Số thứ tự Chủ đề (1,2,3...)].[STT YCCĐ] (Ví dụ: 10.A1.01, 11.C2.03). MÃ ĐÚNG CHỈ CÓ 2 DẤU CHẤM. TUYỆT ĐỐI tuân thủ dấu chấm phân tách và định dạng này, không được chế thêm định dạng (như 10.C2.A1.2 là SAI).
       - ĐỊNH DẠNG VĂN BẢN(RẤT QUAN TRỌNG): TUYỆT ĐỐI KHÔNG SỬ DỤNG MÃ LATEX($...$, \sin, \cos) trong bảng này.Các công thức toán / lý / hóa phải chuyển thành text thường dễ đọc nhất(vd: y = sin x).

    2. NGUYÊN TẮC TÍCH HỢP(Theo 8334 / BGDĐT - GDPT):
    - Rà soát toàn bộ bài học trong chương trình.
       - KHÔNG tích hợp dàn trải hoặc khiên cưỡng.Chỉ thực hiện khi có "điểm chạm" logic và tự nhiên giữa kiến thức môn học và năng lực AI.
       - Nếu bài nào không phù hợp để tích hợp, tại cột "YCCĐ AI" và "Mục tiêu tích hợp AI" ghi rõ: "Không tích hợp".

    3. Định dạng đầu ra: Trình bày dưới dạng JSON Array các đối tượng.
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
        },
        required: ["order", "lesson", "periods", "timing", "equipment", "digitalToolsAndAI", "location", "digitalCompetency"],
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

    return parsed;
  } catch (error) {
    console.error("Error generating educational plan:", error);
    throw error;
  }
};

export const generateDepartmentPlan = async (subject: string, grade: string, province?: string, options?: { useLaTeX?: boolean, detailDrawings?: boolean, customCurriculumData?: any[], curriculumDbData?: any[] }) => {
  const formattingNeed = options?.useLaTeX || options?.detailDrawings || ["Toán học", "Vật lý", "Hóa học", "Địa lí"].includes(subject);
  const englishConstraint = (subject === "Tiếng Anh" || subject.toLowerCase().includes("english")) ? "\\nLỆNH ĐẶC BIỆT TỐI QUAN TRỌNG: Môn học là Tiếng Anh nên TOÀN BỘ nội dung kế hoạch giáo dục PHẢI ĐƯỢC VIẾT 100% BẰNG TIẾNG ANH (ENGLISH). ĐẶC BIỆT, KHI NỘI DUNG TÍCH HỢP NĂNG LỰC SỐ (NLS) VÀ NĂNG LỰC AI (NLAI) ĐƯỢC KHỞI TẠO, CHÚNG CŨNG BẮT BUỘC PHẢI ĐƯỢC VIẾT BẰNG TIẾNG ANH." : "";
  const competencyGuardrails = getThptCompetencyGuardrails(subject, grade);

  // ===== BATCH PROCESSING FOR DIA LI 10 (prevents output token truncation) =====
  const isGeo10Batch = (/\u0111\u1ecba/i.test(subject) || subject === "Địa lý" || subject === "Địa lí" || subject === "ĐỊA LÝ" || subject === "ĐỊA LÍ" || subject.includes("\u0111\u1ecba") || subject.includes("\u0110\u1ecaa")) && grade === "10" && !options?.customCurriculumData && Array.isArray(GEO_10_KNTT) && GEO_10_KNTT.length > 0;
  if (isGeo10Batch) {
    const GEO_BATCH_SIZE = 22;
    const allBatchResults: any[] = [];
    let weekCounter = 1;
    const geoRulesForBatch = `${GEOGRAPHY_AI_RULES}\n${competencyGuardrails}`;

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
        "3. TICH HOP NLS va NL AI chi khi YCCD cua bai co diem cham ro rang. Neu khong du can cu, ghi 'Khong tich hop - ly do: ...' hoac 'Khong gan ma - ly do: ...'. KHONG duoc ghi cut 'Khong'.",
        "4. digitalCompetencyTT02: voi THPT dung ma NLS muc NC1 (VD: 1.1.NC1a: Khai thac nguon du lieu...; 2.4.NC1b: Hop tac tren cong cu so...). Moi ma phai bam vao YCCD va san pham hoc tap.",
        "5. aiCompetency3439Integrated: truoc khi ghi ma NL AI phai ghi ten thanh phan nang luc AI; chi dung ma NL AI hop le theo lop va chu de QD 3439, kem YCCD cu the.",
        AI_COMPETENCY_ORDER_RULE,
        "   Quy uoc ma: [10].[Mach(A/B/C/D)+So chu de].[STT] - VD: 10.A1.01, 10.A2.03, 10.B2.01, 10.C2.01, 10.D2.02",
        "   - Mach A: Tu duy lay con nguoi lam trung tam | Mach B: Dao duc & trach nhiem | Mach C: Ky thuat & ung dung | Mach D: Giai quyet van de",
        "   PHAI DA DANG: moi bai dung ma va chu de KHAC NHAU. KHONG lap lai cung ma.",
        "6. Phan bo thoi gian bat dau tu Tuan " + weekCounter + ".",
        "",
        "Dau ra: JSON Array gom dung " + batch.length + " object voi cac truong: time, lessonContent, periods, lessonGoal, digitalCompetencyTT02, aiCompetency3439Integrated. KHONG duoc de trong bat ky truong nao."
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
    if (allBatchResults.length > 0) return allBatchResults;
  }
  // ===== END BATCH PROCESSING FOR DIA LI 10 =====

    const overrideCurriculumDbData = (subject.toLowerCase().includes("địa") && grade === "10") ? undefined : options?.curriculumDbData;
    const normalizedOverrideCurriculumDbData = overrideCurriculumDbData ? normalizeCurriculumCompetencyData(overrideCurriculumDbData, grade) : undefined;
    const systemCurriculum = normalizedOverrideCurriculumDbData ? `DỮ LIỆU BÀI HỌC TỪ HỆ THỐNG:
${JSON.stringify(normalizedOverrideCurriculumDbData.map(l => ({ topic: l.topic, indicatorCode: l.indicatorCode, indicatorNote: l.indicatorNote, yccd: [l.objectivesKnowledge, l.objectivesCompetency, l.objectivesQuality].filter(Boolean).join("; ") })), null, 2)}
LỆNH TỐI CẤP: Bạn BẮT BUỘC phải tạo KHTCM chứa toàn bộ danh sách bài học trên. Tại cột "Yêu cầu cần đạt CT 2018" (lessonGoal), BẮT BUỘC lấy nội dung "yccd" tương ứng. Tại cột "Yêu cầu cần đạt 3439" (aiCompetency3439), trước khi ghi mã AI phải ghi tên thành phần năng lực AI; chỉ chèn indicatorCode khi mã còn hợp lệ sau khi hệ thống lọc và có căn cứ YCCĐ. Nếu indicatorCode bị bỏ trống hoặc có indicatorNote báo mã tạm/không hợp lệ, phải tự đối chiếu QĐ 3439; không đủ căn cứ thì ghi "Không tích hợp/Không gán mã".
LƯU Ý ĐẶC BIỆT VỀ CÁC BÀI HỌC CÒN THIẾU: Danh sách trên có thể chưa đủ 35 tuần học. Bạn BẮT BUỘC phải TỰ BỔ SUNG các bài học SGK còn thiếu cho đủ 35 tuần. 
Đối với các bài học bạn TỰ BỔ SUNG (không có mã chỉ báo sẵn từ hệ thống): Hãy đánh giá cơ hội tích hợp NLS/NL AI theo YCCĐ. Không gán mã hình thức chỉ vì bài có thể tìm kiếm thông tin hoặc dùng công cụ số.
QUY TẮC ĐÁNH MÃ CHỈ BÁO AI KHI TỰ ĐỀ XUẤT: Chỉ đề xuất mã số theo đúng quy ước [Khối lớp].[Ký hiệu Mạch NL + Chủ đề].[STT] khi có YCCĐ tương ứng. Ví dụ hợp lệ: 12.A1.01, 12.B2.01, 10.C3.02. Không dùng chung 1 mã cho mọi bài học; không dùng chủ đề ngoài danh sách được phép của lớp.` : "";

    let defaultCurriculum = "";
    if (subject === "Giáo dục địa phương") {
        defaultCurriculum = CURRICULUM_DATA_GDDP;
    } else if (subject.toLowerCase().includes("địa") && grade === "10") {
        defaultCurriculum = `MỤC LỤC VÀ YÊU CẦU CẦN ĐẠT (YCCĐ) CHÍNH XÁC TỪNG BÀI - ĐỊA LÍ 10 KẾT NỐI TRI THỨC VỚI CUỘC SỐNG:\n${JSON.stringify(GEO_10_KNTT, null, 2)}`;
    }

    const curriculumConstraint = options?.customCurriculumData
    ? `DỮ LIỆU BÀI HỌC BẮT BUỘC TỪ PHỤ LỤC DO GIÁO VIÊN CUNG CẤP:
${JSON.stringify(options.customCurriculumData, null, 2)}
LỆNH VỀ TÊN BÀI HỌC TỐI CAO: TUYỆT ĐỐI tuân thủ danh sách tên bài học và số tiết trong mảng dữ liệu trên. Phải sinh KHTCM cho TOÀN BỘ các bài học được mô tả trong mảng này. KHÔNG SỬ DỤNG DỮ LIỆU CHƯƠNG TRÌNH MẶC ĐỊNH KHÁC.
LƯU Ý VỀ YÊU CẦU CẦN ĐẠT: Nếu trong mảng dữ liệu trên có chứa thuộc tính "yccd" (Yêu cầu cần đạt), bạn BẮT BUỘC phải sao chép Y NGUYÊN nội dung "yccd" đó vào cột Yêu cầu cần đạt CT 2018 (lessonGoal), TUYỆT ĐỐI KHÔNG ĐƯỢC TỰ Ý RÚT GỌN HAY CẮT XÉN.`
    : `${systemCurriculum}\n\nDANH SÁCH BÀI HỌC BỔ SUNG TỪ HỆ THỐNG:\n${defaultCurriculum}`;
    const geographyRules = subject.toLowerCase().includes("địa") ? GEOGRAPHY_AI_RULES : "";

  const prompt = `
    ${CONTENT_INTEGRITY_RULES}
    ${competencyGuardrails}

    Bạn là một Chuyên gia xây dựng chương trình giáo dục.Hãy giúp tôi lập Kế hoạch giáo dục tổ chuyên môn tích hợp nội dung giáo dục AI cho môn: ${subject}, lớp: ${grade}${subject === "Giáo dục địa phương" && province ? `, tại địa phương: ${province}` : ""}.
    
    YÊU CẦU QUAN TRỌNG VỀ TÊN BÀI HỌC VÀ CHƯƠNG TRÌNH:
    1. Nếu là môn "Giáo dục địa phương": Phải bám sát chương trình của ${province}.
    2. ĐỐI VỚI MÔN ĐỊA LÍ VÀ CÁC MÔN KHÁC: TUYỆT ĐỐI BẮT BUỘC tuân thủ danh mục bài học và đơn vị kiến thức của BỘ SÁCH "KẾT NỐI TRI THỨC VỚI CUỘC SỐNG". KHÔNG ĐƯỢC TỰ BỊA RA BÀI HỌC HAY SỬ DỤNG BỘ SÁCH KHÁC. ĐẢM BẢO ĐỦ SỐ BÀI TRONG SGK KNTT.

    ${AI_SUBJECT_GUIDELINES}
    ${SOCIAL_INTEGRATION_GUIDELINES}
    ${curriculumConstraint}
    ${geographyRules}
    ${AI_COMPETENCY_ORDER_RULE}
    
    ${formattingNeed ? FORMATTING_INSTRUCTIONS : ""}
    ${englishConstraint}

    Nhiệm vụ cụ thể:
    1. Rà soát & Phân tích toàn diện: LỆNH TỐI CẤP: BẠN KHÔNG ĐƯỢC BỎ SÓT BẤT KỲ BÀI HỌC, CHUYÊN ĐỀ, HAY BÀI KIỂM TRA ĐÁNH GIÁ NÀO CÓ TRONG DANH SÁCH. PHẢI LIỆT KÊ ĐỦ 35 TUẦN HỌC. ĐẶC BIỆT: Phải XEN KẼ các tiết "Ôn tập", "Kiểm tra đánh giá" (Giữa kì, Cuối kì) và Chuyên đề vào các tuần tương ứng để hoàn thiện Kế hoạch Tổ chuyên môn đúng chuẩn thực tế.
    1b. KHÔNG ĐƯỢC ĐỂ THIẾU Ô: Mỗi dòng bắt buộc phải có đủ 6 trường time, lessonContent, periods, lessonGoal, digitalCompetencyTT02, aiCompetency3439Integrated. Không được trả chuỗi rỗng, "..." hoặc chỉ một chữ "Không". Nếu không tích hợp, phải ghi theo mẫu: "Không tích hợp - lý do: ..." và nêu căn cứ YCCĐ chưa phù hợp.
    2. TÍCH HỢP NLS VÀ NL AI THEO YCCĐ, KHÔNG GƯỢNG ÉP:
    - Chỉ tích hợp Năng lực số (NLS) và Năng lực AI (NL AI) khi YCCĐ của bài có thao tác phù hợp: khai thác dữ liệu, kiểm chứng nguồn, tạo sản phẩm số, phân tích biểu đồ/bản đồ/bảng số liệu, mô phỏng, thiết kế, đánh giá rủi ro...
    - Không đặt chỉ tiêu 95%/100% số bài. Nếu bài không có điểm chạm rõ, ghi "Không tích hợp - lý do: ..." hoặc "Không gán mã - lý do: ..." và nêu lý do ngắn.
    - Mỗi mã được đề xuất phải có chuỗi chứng minh: YCCĐ -> thao tác học sinh -> công cụ/dữ liệu -> sản phẩm/minh chứng -> mã.
    3. Ánh xạ Năng lực:
    - Thời gian (time): Ước lượng thời gian thực hiện (Ví dụ: Học kì I, Tháng 9, Tuần 1...).
       - Nội dung (lessonContent): Tên bài học, chủ đề, chuyên đề hoặc tên bài kiểm tra. Phải lấy từ danh sách gốc.
       - Số tiết (periods): Số lượng tiết học của bài học.
       - Yêu cầu cần đạt CT 2018 (lessonGoal): BẮT BUỘC SAO CHÉP Y NGUYÊN 100% nội dung "yccd" (hoặc "YCCĐ") được cung cấp trong danh sách gốc cho từng bài học/chuyên đề/kiểm tra tương ứng. BẠN KHÔNG ĐƯỢC PHÉP TÓM TẮT HAY CẮT XÉN YCCĐ GỐC!
       - Năng lực số (digitalCompetencyTT02): Với lớp 10-12, mã NLS phải dùng mức NC1 theo Công văn 3456 (vd: 1.1.NC1a, 2.2.NC1b...). Chỉ liệt kê mã gắn với YCCĐ và minh chứng học tập; nếu không phù hợp ghi "Không tích hợp - lý do: ..." kèm lý do cụ thể, không ghi cụt "Không".
       - Mục tiêu & YCCĐ 3439 Tích hợp GD AI (aiCompetency3439Integrated): Trước khi ghi mã NL AI phải ghi tên thành phần năng lực AI; chỉ liệt kê mã đúng lớp, đúng chủ đề QĐ 3439 và bám YCCĐ. Nội dung bắt buộc theo thứ tự: Tên thành phần năng lực AI -> hành vi học sinh -> yêu cầu cần đạt AI -> mã NL AI -> sản phẩm -> tiêu chí -> minh chứng. Với bài có indicatorCode hợp lệ từ hệ thống, vẫn phải kiểm tra YCCĐ trước khi dùng. Với bài tự đề xuất, không bịa mã; nếu thiếu căn cứ ghi "Không tích hợp/Không gán mã - lý do: ..." kèm lý do cụ thể, không ghi cụt "Không".
       
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
    - aiCompetency3439Integrated: Mục tiêu & YCCĐ 3439 Tích hợp GD AI. Kết hợp tên thành phần năng lực AI, hành vi học sinh, YCCĐ AI, mã chỉ báo CV 3439, sản phẩm, tiêu chí và minh chứng theo đúng thứ tự. Ghi "Không tích hợp - lý do: ..." nếu bài không phù hợp.
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
            aiCompetency3439Integrated: { type: 'STRING' as any }
          },
          required: ['time', 'lessonContent', 'periods', 'lessonGoal', 'digitalCompetencyTT02', 'aiCompetency3439Integrated'],
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
      return parsed;

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
    Dựa trên Kế hoạch bài dạy (KHBD) sau đây, hãy thiết kế một "Hệ thống đánh giá năng lực" chi tiết theo Công văn 3439/BGDĐT và Chương trình GDPT 2018.
    
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
  const competencyGuardrails = getThptCompetencyGuardrails(input.subject, input.grade, input.requirementsText);
  const prompt = `Bạn là chuyên gia xây dựng Khung năng lực AI theo Quyết định 3439/QĐ-BGDĐT năm 2025.
Nhiệm vụ:
1. Đọc toàn bộ Yêu cầu cần đạt của chủ đề được cung cấp.
2. Tách từng yêu cầu cần đạt thành các chỉ báo năng lực độc lập.
3. Đánh mã chỉ báo theo quy tắc: [Lớp].[Chủ đề].[Số thứ tự]
Trong đó:
- Lớp = ${input.grade}
- Chủ đề = A1, A2, A3, B1, B2, B3, C1, C2, C3, C4, C5, D1, D2
- Số thứ tự gồm 2 chữ số (01, 02, 03...)
Ví dụ: ${input.grade}.C2.01, ${input.grade}.C2.02...
4. Với mỗi chỉ báo, trước khi ghi mã AI bắt buộc ghi tên thành phần năng lực AI. Trình bày theo đúng thứ tự: Tên thành phần năng lực AI -> hành vi học sinh -> yêu cầu cần đạt AI -> mã NL AI -> sản phẩm -> tiêu chí -> minh chứng.
5. Bảo đảm không bỏ sót YCCĐ nào, đánh số liên tục trong từng chủ đề.
6. Không mã hóa YCCĐ môn học thành mã NL AI nếu YCCĐ đó không có thao tác liên quan trực tiếp tới AI, dữ liệu, công cụ số, kiểm chứng, đạo đức AI hoặc thiết kế/đánh giá hệ thống.

${competencyGuardrails}
${AI_COMPETENCY_ORDER_RULE}

THÔNG TIN BÀI HỌC:
Môn học: ${input.subject}
Khối lớp: ${input.grade}
Chủ đề/Bài: ${input.topic}
Yêu cầu cần đạt (Đầu vào):
"""
${input.requirementsText}
"""
`;

  try {
    return await callGeminiWithFallback(prompt, {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          code: { type: Type.STRING, description: "Mã chỉ báo (VD: 10.C2.01)" },
          content: { type: Type.STRING, description: "Yêu cầu cần đạt AI / nội dung chỉ báo" },
          component: { type: Type.STRING, description: "Thành phần năng lực (NLa, NLb, NLc, NLd)" },
          level: { type: Type.STRING, description: "Mức độ nhận thức (Biết, Hiểu, Vận dụng, Vận dụng cao)" },
          product: { type: Type.STRING, description: "Sản phẩm học tập cần tạo ra" },
          evidence: { type: Type.STRING, description: "Minh chứng đánh giá" },
          activities: { type: Type.STRING, description: "Hoạt động học tập gợi ý" },
          tools: { type: Type.STRING, description: "Công cụ AI phù hợp" },
          rubric: { type: Type.STRING, description: "Tiêu chí đánh giá (Rubric Đạt/Chưa đạt)" }
        },
        required: ["code", "content", "component", "level", "product", "evidence", "activities", "tools", "rubric"]
      }
    });
  } catch (error) {
    console.error("Error generating AI Competency Framework:", error);
    throw error;
  }
};

export const analyzeLessonSource = async (fileBase64: string, mimeType: string, options: { apiKey?: string; aiModel?: string }) => {
  const apiKey = options.apiKey || localStorage.getItem('GEMINI_API_KEY') || '';
  if (!apiKey) throw new Error('API_KEY_REQUIRED');
  const startModel = options.aiModel || localStorage.getItem('GEMINI_MODEL') || 'gemini-3.5-flash';
  const modelsToTry = getFallbackModels(startModel);

  const promptText = `Bạn là một Chuyên gia Giáo dục và Thị giác máy tính (Computer Vision).
Nhiệm vụ của bạn là đọc và phân tích bức ảnh/tài liệu (trang Sách giáo khoa) được đính kèm, sau đó trích xuất các thông tin cốt lõi để điền vào form tạo Kế hoạch bài dạy.

YÊU CẦU:
1. Trích xuất Tên bài học (hoặc nội dung trọng tâm).
2. Trích xuất chính xác các Yêu cầu cần đạt (Mục tiêu kiến thức, năng lực).
3. Đề xuất nhanh 2-3 phương pháp hoặc kỹ thuật dạy học tích cực phù hợp nhất với bài học này.

Trả về JSON hợp lệ: {"topic": "Tên bài học", "objectives": "Yêu cầu cần đạt...", "methodologies": "Phương pháp..."}`;

  for (let i = 0; i < modelsToTry.length; i++) {
    const currentModel = modelsToTry[i];
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`;
      const body = {
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { data: fileBase64, mimeType } },
            { text: promptText }
          ]
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
3. Chuyên gia Phản biện AI: Kiểm định việc áp dụng Khung năng lực AI (QĐ 3439), kiểm tra xem các Prompt/công cụ đề xuất cho học sinh có thực tế không, có nguy cơ "ảo giác" (hallucination) hay lạm dụng AI thay vì tư duy không.

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
    "strengths": "Ưu điểm về tích hợp AI 3439...",
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

export const generateEducationalActivitiesPlan = async (subject: string, grade: string, options?: { useLaTeX?: boolean }) => {
  const englishConstraint = (subject === "Tiếng Anh" || subject.toLowerCase().includes("english")) ? "\\nLỆNH ĐẶC BIỆT TỐI QUAN TRỌNG: Môn học là Tiếng Anh nên TOÀN BỘ nội dung kế hoạch giáo dục PHẢI ĐƯỢC VIẾT 100% BẰNG TIẾNG ANH (ENGLISH)." : "";
  const prompt = `
    Bạn là một Chuyên gia xây dựng chương trình giáo dục. Hãy giúp tôi lập "Kế hoạch tổ chức các hoạt động giáo dục" (Phụ lục 2 - CV 5512) cho môn: ${subject}, lớp: ${grade}.

    YÊU CẦU QUAN TRỌNG:
    1. Đề xuất từ 3 đến 5 hoạt động giáo dục đặc sắc, mang tính trải nghiệm, câu lạc bộ, tham quan, hoặc dự án liên môn phù hợp với môn học và lứa tuổi.
    2. Các hoạt động phải ĐA DẠNG: Có thể bao gồm Sinh hoạt dưới cờ, Sinh hoạt lớp, Câu lạc bộ, Hoạt động trải nghiệm ngoài nhà trường, Dự án học tập...
    3. TÍCH HỢP AI: Đề xuất cách học sinh hoặc giáo viên sử dụng công cụ số/AI trong hoạt động này (VD: dùng AI để lên kịch bản, làm poster, lập trình chatbot đơn giản, v.v.).

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
    - aiIntegration: Tích hợp Năng lực số / AI (Cách sử dụng công cụ AI trong hoạt động này).
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
          },
          required: ['theme', 'requirements', 'periods', 'timing', 'location', 'host', 'collaborator', 'conditions', 'aiIntegration'],
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
      return parsed;
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
  const competencyGuardrails = getThptCompetencyGuardrails(domainLabel, input.grade, input.lessonGoal);

  const prompt = `
Bạn là chuyên gia thiết kế học liệu ${domainLabel} theo CT GDPT 2018, đồng thời am hiểu Khung năng lực số TT02/2025 và năng lực AI theo QĐ 3439.

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
