import { GoogleGenAI, Type } from "@google/genai";

const getFallbackModels = (startModel: string) => {
  const models = ['gemini-2.5-flash', 'gemini-3-flash-preview', 'gemini-3-pro-preview', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'];
  const index = models.indexOf(startModel);
  if (index === -1) return models;

  // Return startModel followed by remaining models in order
  const modelsToTry = [startModel];
  for (const m of models) {
    if (m !== startModel && !modelsToTry.includes(m)) {
      modelsToTry.push(m);
    }
  }
  return modelsToTry;
};

const callGeminiWithFallback = async (prompt: any, responseSchema: any) => {
  const apiKey = localStorage.getItem('GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error('API_KEY_REQUIRED');
  }
  const startModel = localStorage.getItem('GEMINI_MODEL') || 'gemini-3-flash-preview';
  const modelsToTry = getFallbackModels(startModel);

  for (let i = 0; i < modelsToTry.length; i++) {
    const currentModel = modelsToTry[i];
    try {
      const ai = new GoogleGenAI({ apiKey: apiKey });
      const response = await ai.models.generateContent({
        model: currentModel,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: responseSchema,
        },
      });
      return JSON.parse(response.text);
    } catch (err: any) {
      console.error(`Lỗi với model ${currentModel}:`, err);

      const isQuotaExhausted = err.message && (err.message.includes('429') || err.message.includes('quota') || err.message.includes('RESOURCE_EXHAUSTED'));
      const isApiKeyInvalid = err.message && (err.message.includes('API_KEY_INVALID') || err.message.includes('400'));
      const isLastModel = i === modelsToTry.length - 1;

      if (isApiKeyInvalid) {
        throw new Error('API_KEY_INVALID');
      }

      if (isLastModel) {
        if (isQuotaExhausted) throw new Error('QUOTA_EXHAUSTED');
        throw err;
      }
      // Wait for 1 second before retrying
      await new Promise(r => setTimeout(r, 1000));
    }
  }
};

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

const CURRICULUM_DATA = `
DỮ LIỆU CHUẨN VỀ CHƯƠNG TRÌNH VÀ TÊN BÀI HỌC (THỰC HIỆN NGHIÊM TÚC):

LƯU Ý TỐI QUAN TRỌNG CHUNG MÔN ĐỊA LÍ (TẤT CẢ CÁC KHỐI LỚP): BẮT BUỘC cập nhật tên bài và nội dung chương trình đảm bảo TUYỆT ĐỐI tuân thủ Thông tư 17/2025/TT-BGDĐT của Bộ GD&ĐT. Hãy ưu tiên dữ liệu của TT 17/2025 làm chuẩn mực cao nhất để hiệu chỉnh danh sách bài đi kèm.

1. GIÁO DỤC ĐỊA PHƯƠNG - THÀNH PHỐ HỒ CHÍ MINH:
   - Lớp 10:
     * Chủ đề 1: Biến đổi khí hậu và phòng, chống thiên tai ở Thành phố Hồ Chí Minh (5 tiết)
     * Chủ đề 2: Đạo lí “Uống nước nhớ nguồn” qua các nghi lễ dân gian ở TP.HCM (5 tiết)
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
     * Chủ đề 8: Phong tục, luật tục và giáo dục pháp luật ở Tp. Hồ Chí Minh
   - Lớp 12:
     * Chủ đề 1: Lao động, việc làm tại thành phố Hồ Chí Minh
     * Chủ đề 2: Phát triển giao thông vận tải ở Thành phố Hồ Chí Minh
     * Chủ đề 3: Những thành tựu cơ bản và bài học kinh nghiệm trong công cuộc Đổi mới tại Thành phố Hồ Chí Minh (1991 - nay)
     * Chủ đề 4: Văn học ở Thành phố Hồ Chí Minh từ năm 1975
     * Chủ đề 5: Một số loại hình nghệ thuật ở Thành phố Hồ Chí Minh (Hát bội, Kịch nói, Đờn ca tài tử, Cải lương)
     * Chủ đề 6: Mĩ thuật ứng dụng hiện đại ở Thành phố Hồ Chí Minh (Đúc đồng, Điêu khắc đá, Tranh bích họa, Đồ gốm)
     * Chủ đề 7: Vai trò của lễ hội truyền thống tại Thành phố Hồ Chí Minh trong việc duy trì, phát huy các giá trị văn hóa dân tộc
     * Chủ đề 8: Ý tưởng khởi nghiệp cho học sinh tại Thành phố Hồ Chí Minh

2. ĐỊA LÍ 10 (Chương trình GDPT 2018):
   * Bài 1: Môn Địa lí với định hướng nghề nghiệp (1 tiết)
   * Bài 2: Sử dụng bản đồ (2 tiết)
   * Bài 3: Trái Đất. Thuyết kiến tạo mảng (2 tiết)
   * Bài 4: Hệ quả địa lí các chuyển động của Trái Đất (3 tiết)
   * Bài 5: Thạch quyển. Nội lực (3 tiết)
   * Bài 6: Ngoại lực (2 tiết)
   * Bài 7: Khí quyển. Nhiệt độ không khí (2 tiết)
   * Bài 8: Khí áp, gió và mưa (4 tiết)
   * Bài 9: Thực hành: Đọc bản đồ khí hậu (1 tiết)
   * Bài 10: Thủy quyển. Nước trên lục địa (3 tiết)
   * Bài 11: Nước biển và đại dương (2 tiết)
   * Bài 12: Đất và sinh quyển (3 tiết)
   * Bài 13: Thực hành: Phân tích phân bố đất và sinh vật (1 tiết)
   * Bài 14: Vỏ địa lí. Quy luật thống nhất và hoàn chỉnh (1 tiết)
   * Bài 15: Quy luật địa đới và phi địa đới (2 tiết)
   * Bài 16: Dân số và gia tăng dân số (2 tiết)
   * Bài 17: Phân bố dân cư và đô thị hóa (2 tiết)
   * Bài 18: Các nguồn lực phát triển kinh tế (1 tiết)
   * Bài 19: Cơ cấu nền kinh tế, GDP, GNI (2 tiết)
   * Bài 20: Vai trò, đặc điểm nông nghiệp... (1 tiết)
   * Bài 21: Địa lí các ngành nông nghiệp (4 tiết)
   * Bài 22: Tổ chức lãnh thổ nông nghiệp (1 tiết)
   * Bài 23: Vai trò, đặc điểm công nghiệp... (1 tiết)
   * Bài 24: Địa lí một số ngành công nghiệp (4 tiết)
   * Bài 25: Tổ chức lãnh thổ công nghiệp (1 tiết)
   * Bài 26: Vai trò, đặc điểm dịch vụ... (1 tiết)
   * Bài 27: Địa lí ngành GTVT và BCVT (4 tiết)
   * Bài 28: Thương mại, tài chính ngân hàng và du lịch (4 tiết)
   * Bài 29: Môi trường và tài nguyên thiên nhiên (1 tiết)
   * Bài 30: Phát triển bền vững và tăng trưởng xanh (1 tiết)

3. ĐỊA LÍ 11 (Chương trình GDPT 2018):
   * Bài 1: Sự khác biệt về trình độ phát triển các nhóm nước (2 tiết)
   * Bài 2: Toàn cầu hóa, khu vực hóa kinh tế (2 tiết)
   * Bài 3: Một số tổ chức khu vực và quốc tế (1 tiết)
   * Bài 4: Thực hành: Tìm hiểu về toàn cầu hóa (1 tiết)
   * Bài 5: Một số vấn đề an ninh toàn cầu (1 tiết)
   * Bài 6: Thực hành: Viết báo cáo về nền kinh tế tri thức (1 tiết)
   * Bài 7: Vị trí, tự nhiên, dân cư, kinh tế Mỹ Latinh (5 tiết)
   * Bài 8: Thực hành: Viết báo cáo về kinh tế Brazil (1 tiết)
   * Bài 9: EU - Một liên kết kinh tế khu vực lớn (4 tiết)
   * Bài 10: Thực hành: Viết báo cáo về công nghiệp Đức (1 tiết)
   * Bài 11: Vị trí, tự nhiên, dân cư, kinh tế Đông Nam Á (4 tiết)
   * Bài 12: Hiệp hội các quốc gia Đông Nam Á (ASEAN) (2 tiết)
   * Bài 13: Thực hành: Tìm hiểu về du lịch và kinh tế đối ngoại ĐNA (1 tiết)
   * Bài 14: Vị trí, tự nhiên, dân cư, kinh tế Tây Nam Á (5 tiết)
   * Bài 15: Thực hành: Viết báo cáo về dầu mỏ Tây Nam Á (1 tiết)
   * Bài 16: Vị trí, tự nhiên, dân cư Hoa Kỳ (3 tiết)
   * Bài 17: Kinh tế Hoa Kỳ (2 tiết)
   * Bài 18: Thực hành: Tìm hiểu hoạt động XNK của Hoa Kỳ (1 tiết)
   * Bài 19: Vị trí, tự nhiên, dân cư Liên bang Nga (2 tiết)
   * Bài 20: Kinh tế Liên bang Nga (3 tiết)
   * Bài 21: Thực hành: Tìm hiểu tình hình kinh tế LB Nga (1 tiết)
   * Bài 22: Vị trí, tự nhiên, dân cư, kinh tế Nhật Bản (4 tiết)
   * Bài 23: Thực hành: Tìm hiểu về hoạt động kinh tế đối ngoại Nhật Bản (1 tiết)
   * Bài 24: Vị trí, tự nhiên, dân cư, kinh tế Trung Quốc (4 tiết)
   * Bài 25: Thực hành: Tìm hiểu về nông nghiệp Trung Quốc (1 tiết)
   * Bài 26: Vị trí, tự nhiên, dân cư, kinh tế Australia (3 tiết)
   * Bài 27: Thực hành: Tìm hiểu về sự thay đổi của kinh tế Australia (1 tiết)
   * Bài 28: Vị trí, tự nhiên, dân cư, kinh tế Cộng hòa Nam Phi (3 tiết)
   * Bài 29: Thực hành: Tìm hiểu về sản xuất cây công nghiệp cà phê (1 tiết)

4. ĐỊA LÍ 12 (Chương trình GDPT 2018 - BÁM SÁT TÀI LIỆU):
   * Bài 1. Vị trí địa lí và phạm vi lãnh thổ (2 tiết)
   * Bài 2. Thiên nhiên nhiệt đới ẩm gió mùa và ảnh hưởng đến sản xuất, đời sống (3 tiết)
   * Bài 3. Sự phân hoá đa dạng của thiên nhiên (4 tiết)
   * Bài 4. Thực hành: Trình bày báo cáo về sự phân hoá tự nhiên Việt Nam (1 tiết)
   * Bài 5. Vấn đề sử dụng hợp lí tài nguyên thiên nhiên và bảo vệ môi trường (4 tiết)
   * Bài 6. Dân số, lao động và việc làm (4 tiết)
   * Bài 7. Đô thị hoá (1 tiết)
   * Ôn tập Giữa kì I (1 tiết)
   * Kiểm tra Giữa kì I (1 tiết)
   * Bài 8. Thực hành: Viết báo cáo về dân số, lao động và việc làm, đô thị hoá (1 tiết)
   * Bài 9. Chuyển dịch cơ cấu kinh tế (2 tiết)
   * Bài 10. Vấn đề phát triển nông nghiệp, lâm nghiệp và thuỷ sản (5 tiết)
   * Bài 11. Một số hình thức tổ chức lãnh thổ nông nghiệp (1 tiết)
   * Bài 12. Thực hành: Vẽ biểu đồ, nhận xét và giải thích về tình hình phát triển và sự chuyển dịch cơ cấu của ngành nông nghiệp, lâm nghiệp và thuỷ sản (1 tiết)
   * Bài 13. Vấn đề phát triển công nghiệp (3 tiết)
   * Ôn tập Cuối kì I (1 tiết)
   * Kiểm tra Cuối kì I (1 tiết)
   * Bài 14. Một số hình thức tổ chức lãnh thổ công nghiệp (1 tiết)
   * Bài 15. Thực hành: Vẽ biểu đồ, nhận xét và giải thích tình hình phát triển các ngành công nghiệp ở nước ta (1 tiết)
   * Bài 16. Giao thông vận tải và bưu chính viễn thông (3 tiết)
   * Bài 17. Thương mại và du lịch (2 tiết)
   * Bài 18. Thực hành: Tìm hiểu thực tế về một số hoạt động và sản phẩm dịch vụ của địa phương (1 tiết)
   * Bài 19. Khai thác thế mạnh ở Trung du và miền núi phía Bắc (2 tiết)
   * Bài 20. Phát triển kinh tế - xã hội ở Đồng bằng sông Hồng (3 tiết)
   * Bài 21. Phát triển kinh tế - xã hội ở Bắc Trung Bộ (2 tiết)
   * Ôn tập Giữa kì II (1 tiết)
   * Kiểm tra Giữa kì II (1 tiết)
   * Bài 22+23. Phát triển kinh tế - xã hội ở Nam Trung Bộ (5 tiết)
   * Bài 24. Phát triển kinh tế - xã hội ở Đông Nam Bộ (2 tiết)
   * Bài 25. Sử dụng hợp lí tự nhiên để phát triển kinh tế ở Đồng bằng sông Cửu Long (2 tiết)
   * Bài 26. Thực hành: Tìm hiểu ảnh hưởng của biến đổi khí hậu đối với Đồng bằng sông Cửu Long và các giải pháp ứng phó (1 tiết)
   * Bài 28. Phát triển kinh tế và đảm bảo an ninh quốc phòng ở Biển Đông và các đảo, quần đảo (2 tiết)
   * Bài 29. Thực hành: Viết và trình bày báo cáo tuyên truyền về bảo vệ chủ quyền biển đảo của Việt Nam (1 tiết)
   * Bài 30. Thực hành: Tìm hiểu địa lí địa phương (2 tiết)
   * Ôn tập Cuối kì II (1 tiết)
   * Kiểm tra Cuối kì II (1 tiết)
   * Chuyên đề 1: Thiên tai và biện pháp phòng chống (10 tiết)
   * Chuyên đề 2: Phát triển vùng (15 tiết)
   * Chuyên đề 3: Phát triển làng nghề (10 tiết)
`;

const FORMATTING_INSTRUCTIONS = `
YÊU CẦU ĐỊNH DẠNG VÀ TRÌNH BÀY (THỰC THI NGHIÊM NGẶT):
1. Đối với Công thức (Toán, Vật lí, Hóa học, Sinh học):
- TUYỆT ĐỐI KHÔNG SỬ DỤNG MÃ LATEX (các ký hiệu $ ... $, $$...$$, \\sin, \\frac, \\sqrt). Viết công thức theo dạng văn bản thuần túy thân thiện nhất (Ví dụ: sin x, căn bậc hai của a, S = a x b, H2O).
- Phương trình hóa học: ghi ký hiệu nguyên tố và chỉ số thường (VD: H2O, CO2, CaCO3).
2. Đối với Hình vẽ, Biểu đồ và Bản đồ:
- Mô tả trực quan chi tiết cho các hình vẽ/biểu đồ để GV dễ chèn ảnh (VD: [CHÈN HÌNH VẼ: Trục tọa độ Oxy, vẽ parabol y=x^2 và đường thẳng y=2x cắt nhau...]).
3. Đối với Bảng biểu và Sơ đồ:
- Sử dụng định dạng bảng chuẩn Markdown.
- Các sơ đồ tiến trình phải được trình bày phân cấp rõ ràng.
`;

const LESSON_PLAN_STRICT_GUIDELINES = `
# QUY TẮC THỰC THI "KỊCH BẢN CHI TIẾT" (CV 5512 + QĐ 3439)

1. BÁM SÁT HỌC LIỆU: Trích xuất 100% kiến thức từ tài liệu/đề bài cung cấp. Chỉ bổ sung Năng lực AI và các mô phỏng trực quan.
2. TIÊU ĐỀ HOẠT ĐỘNG CÁ NHÂN HÓA: Không đặt tên chung chung (như Hoạt động 1, Hoạt động 2). Phải gắn tên hoạt động với nội dung bài học. Đặt tên hay, hấp dẫn. Ví dụ: Thay vì "Hoạt động 1: Khởi động", hãy viết "Hoạt động 1: Giải mã bí ẩn về vị trí địa lí Châu Âu".

MỖI HOẠT ĐỘNG TRONG 4 HOẠT ĐỘNG (Xác định vấn đề -> Hình thành kiến thức -> Luyện tập -> Vận dụng) PHẢI ĐẢM BẢO CHI TIẾT TUYỆT ĐỐI NHƯ SAU:
a. Mục tiêu: Ghi rõ kiến thức/kỹ năng/năng lực AI đạt được.
b. Nội dung: Nhiệm vụ cụ thể (đọc mục nào, quan sát hình nào, trả lời câu hỏi gì).
c. Sản phẩm: SẢN PHẨM DỰ KIẾN CỤ THỂ, KHÔNG ghi chung chung là "vở ghi". Phải mô tả rõ diện mạo sản phẩm là bảng thông tin, sơ đồ tư duy có mấy nhánh, đoạn văn phản biện, hay bài test trắc nghiệm (Ví dụ: "Bản đồ tư duy gồm 3 nhánh chính về...", "Kết quả trả lời trên Quizizz thiết kế ra sao").
d. Tổ chức thực hiện (Mô tả kịch bản siêu chi tiết GV - HS):
   - Bước 1: Chuyển giao nhiệm vụ: GV sử dụng lệnh/câu hỏi cụ thể gì (nằm trong ngoặc kép)? Cung cấp phiếu học tập/dữ liệu gì (mô tả nội dung phiếu)? HS tiếp nhận và chuẩn bị như thế nào?
   - Bước 2: Thực hiện nhiệm vụ: HS làm việc cá nhân/nhóm chi tiết ra sao? (Mô tả các bước HS xử lý dữ liệu). GV theo dõi, gợi mở bằng câu hỏi phụ tại các điểm khó như thế nào?
   - Bước 3: Báo cáo, thảo luận: Cách thức HS trình bày (trên bảng/Tivi/Padlet)? Các nhóm khác nhận xét, phản biện dựa trên tiêu chí nào? Đoạn hội thoại mẫu phản biện.
   - Bước 4: Kết luận, nhận định: GV chuẩn hóa kiến thức bằng những ý chính nội dung nào (GHI RÕ NỘI DUNG CHỐT KIẾN THỨC)? Đánh giá thái độ và kết quả làm việc của HS.

🚨 ĐẶC BIỆT: MỤC "HOẠT ĐỘNG GIÁO DỤC AI"
Nếu hoạt động có tích hợp AI, BẮT BUỘC CHÈN THẺ CẢNH BÁO MÀU ĐỎ: <ai>[🚨 BÁO ĐỘNG ĐỎ - TÍCH HỢP AI]</ai>.
Nêu rõ mã chỉ báo năng lực AI từ QĐ 3439/8439 (vd 11.A1.a).
Mô tả chi tiết: GV hướng dẫn HS dùng công cụ AI gì để hỗ trợ giải quyết nội dung bài học đó. HS thực hiện các thao tác kỹ thuật Prompt kỹ sư gì trên công cụ AI.
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
}

export const analyzeExistingPlan = async (fileText: string, pdfBase64?: string) => {
  let prompt: any;
  if (pdfBase64) {
    prompt = [
      `
      Đóng vai trò chuyên gia giáo dục phân tích Kế hoạch bài dạy đính kèm dưới dạng PDF.
      Hãy rà soát và cho tôi biết:
      1. Thông tin chung của bài học (Môn, Lớp, Tên bài, Thời lượng, Đặc điểm học sinh, Điều kiện cơ sở vật chất, Các mục tiêu hiện tại).
      2. Các hoạt động cốt yếu trong giáo án (Thường là Mở đầu, Hình thành kiến thức, Luyện tập, Vận dụng).
      3. Trọng tâm: Phân tích xem giáo án gốc HIỆN CÓ năng lực AI theo QĐ 3439 chưa. Chỉ ra 2 vị trí (2 hoạt động) TỐT NHẤT có thể lồng ghép 2 năng lực AI (chọn từ NLa, NLb, NLc, NLd) sao cho phù hợp tự nhiên nhất.
      
      Định dạng đầu ra JSON bắt buộc:
      {
        "subject": "Tên môn",
        "grade": "Khối lớp",
        "topic": "Tên bài",
        "duration": "Thời lượng",
        "contextStudents": "Đặc điểm học sinh (từ tóm tắt)",
        "contextSchool": "Điều kiện CSVC",
        "objectivesKnowledge": "Tóm tắt mục tiêu kiến thức",
        "objectivesCompetency": "Tóm tắt mục tiêu năng lực",
        "objectivesQuality": "Tóm tắt phẩm chất",
        "aiSuggestions": [
          {
            "activityName": "Tên hoạt động gợi ý (vd: Hoạt động Luyện tập)",
            "suggestedAI": "NLa",
            "reason": "Lý do vì sao phù hợp lồng ghép vào đây",
            "action": "Nếu lồng ghép thì HS sẽ làm gì với AI ở hoạt động này?"
          }
        ]
      }
      `,
      { inlineData: { mimeType: "application/pdf", data: pdfBase64 } }
    ];
  } else {
    prompt = `
      Đóng vai trò chuyên gia giáo dục phân tích Kế hoạch bài dạy (Giáo án) của Giáo viên.
      Dưới đây là nội dung văn bản bóc tách từ Giáo án của giáo viên.
    
    Hãy rà soát và cho tôi biết:
    1. Thông tin chung của bài học (Môn, Lớp, Tên bài, Thời lượng, Đặc điểm học sinh, Điều kiện cơ sở vật chất, Các mục tiêu hiện tại).
    2. Các hoạt động cốt yếu trong giáo án (Thường là Mở đầu, Hình thành kiến thức, Luyện tập, Vận dụng).
    3. Trọng tâm: Phân tích xem giáo án gốc HIỆN CÓ năng lực AI theo QĐ 3439 chưa. Chỉ ra 2 vị trí (2 hoạt động) TỐT NHẤT có thể lồng ghép 2 năng lực AI (chọn từ NLa, NLb, NLc, NLd) sao cho phù hợp tự nhiên nhất.
    
    VĂN BẢN GIÁO ÁN:
    ${fileText.substring(0, 15000)} // Giới hạn một phần để chống tràn

    Định dạng đầu ra JSON bắt buộc:
    {
      "subject": "Tên môn",
      "grade": "Khối lớp",
      "topic": "Tên bài",
      "duration": "Thời lượng",
      "contextStudents": "Đặc điểm học sinh (từ tóm tắt)",
      "contextSchool": "Điều kiện CSVC",
      "objectivesKnowledge": "Tóm tắt mục tiêu kiến thức",
      "objectivesCompetency": "Tóm tắt mục tiêu năng lực",
      "objectivesQuality": "Tóm tắt phẩm chất",
      "aiSuggestions": [
        {
          "activityName": "Tên hoạt động gợi ý (vd: Hoạt động Luyện tập)",
          "suggestedAI": "NLa",
          "reason": "Lý do vì sao phù hợp lồng ghép vào đây",
          "action": "Nếu lồng ghép thì HS sẽ làm gì với AI ở hoạt động này?"
        }
      ]
    }
  `;
  }

  try {
    return await callGeminiWithFallback(prompt, {
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
        aiSuggestions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              activityName: { type: Type.STRING },
              suggestedAI: { type: Type.STRING },
              reason: { type: Type.STRING },
              action: { type: Type.STRING }
            },
            required: ["activityName", "suggestedAI", "reason", "action"]
          }
        }
      },
      required: ["subject", "grade", "topic", "duration", "aiSuggestions"]
    });
  } catch (err) {
    console.error("Error analyzing plan:", err);
    throw err;
  }
};

export const parseCurriculumAppendix = async (rawText: string, pdfBase64?: string) => {
  let prompt: any;
  if (pdfBase64) {
    prompt = [
      `
      Đóng vai trò là chuyên gia giáo dục, hãy phân tích Phụ lục Phân phối chương trình đính kèm (PDF).
      Nhiệm vụ: Bóc tách danh sách các bài học (hoặc chủ đề), thời lượng (số tiết), và thời điểm dạy (vd: Tuần 1).
      Phớt lờ các thông tin thừa như tên trường, quốc hiệu, chữ ký. Bắt đầu ngay từ danh sách bài học. Dồn các tiết tự học/kiểm tra chung thành 1 bài nếu có.
      Trọng tâm là tên bài học phải ĐẦY ĐỦ chính xác từng chữ như trong file gốc.
      `,
      {
        inlineData: {
          mimeType: "application/pdf",
          data: pdfBase64
        }
      }
    ];
  } else {
    prompt = `
      Đóng vai trò là chuyên gia giáo dục, hãy phân tích Phụ lục Phân phối chương trình.
      Dưới đây là văn bản thô bóc tách từ file Phân phối chương trình do giáo viên cung cấp:
      """${rawText.substring(0, 18000)}"""

      Nhiệm vụ: Bóc tách danh sách các bài học (hoặc chủ đề), thời lượng (số tiết), và thời điểm dạy (vd: Tuần 1).
      Phớt lờ các thông tin thừa như tên trường, quốc hiệu, chữ ký. Bắt đầu ngay từ danh sách bài học. Dồn các tiết tự học/kiểm tra chung thành 1 bài nếu có.
      Trọng tâm là tên bài học phải ĐẦY ĐỦ chính xác từng chữ như trong file gốc.
    `;
  }

  try {
    return await callGeminiWithFallback(prompt, {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          lessonName: { type: Type.STRING, description: "Tên chính xác của bài học, chủ đề hoặc tiết kiểm tra" },
          periods: { type: Type.NUMBER, description: "Số tiết học dành cho bài/chủ đề này" },
          timing: { type: Type.STRING, description: "Thời điểm định hướng (Ví dụ: Tuần 1, Tuần 2-3). Nếu không rõ, ghi rỗng." }
        },
        required: ["lessonName", "periods", "timing"]
      }
    });
  } catch (error) {
    console.error("Error parsing curriculum:", error);
    throw error;
  }
};

export const generateLessonPlan = async (input: LessonPlanInput) => {
  const formattingNeed = input.useLaTeX || input.detailDrawings || ["Toán học", "Vật lý", "Hóa học", "Địa lí"].includes(input.subject);
  const englishConstraint = (input.subject === "Tiếng Anh" || input.subject.toLowerCase().includes("english")) ? "\nLỆNH ĐẶC BIỆT TỐI QUAN TRỌNG: Môn học là Tiếng Anh nên TOÀN BỘ nội dung giáo án (kịch bản GV-HS, mục tiêu, nội dung...) PHẢI ĐƯỢC VIẾT 100% BẰNG TIẾNG ANH (ENGLISH)." : "";

  let finalPromptContents: any = ``;
  if (input.existingPdfBase64) {
    const p1 = `
🚨🚨🚨 CHẾ ĐỘ NÂNG CẤP GIÁO ÁN GỐC TỪ FILE PDF — ƯU TIÊN TỐI CAO 🚨🚨🚨

NHIỆM VỤ CỐT LÕI: Bạn KHÔNG được viết giáo án mới từ đầu. Bạn phải NÂNG CẤP giáo án xuất ra từ File PDF ĐÍNH KÈM của giáo viên bằng cách GIỮ NGUYÊN TOÀN BỘ cấu trúc, hoạt động, nội dung khoa học, bài tập và tiến trình đã có — chỉ THÊM/CHỈNH SỬA những điểm chạm AI được chỉ định cụ thể.

ĐIỂM CHẠM AI CẦN TÍCH HỢP (chỉ chỉnh sửa những hoạt động này):
${JSON.stringify(input.aiIntegrationOptions, null, 2)}

KIÊN QUYẾT BẢO TỒN: 
1. Không cắt bớt phần Mở đầu, Hình thành KT mới, Luyện tập, Vận dụng mà giáo viên đã viết.
2. Không tự động bịa đặt các câu hỏi hay kết luận trừ khi có liên quan trực tiếp tới Công cụ AI.
3. Khi bạn được lệnh tích hợp AI ở một Hoạt động nào đó, chỉ viết thêm đúng phần <ai>[🚨 BÁO ĐỘNG ĐỎ - TÍCH HỢP NĂNG LỰC AI]</ai> mô tả chi tiết tại đó với lời văn của mình, CÒN LẠI DỮ LIỆU CŨ PHẢI SAO CHÉP Y HỆT.
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
🚨🚨🚨 CHẾ ĐỘ NÂNG CẤP GIÁO ÁN GỐC — ƯU TIÊN TỐI CAO 🚨🚨🚨

NHIỆM VỤ CỐT LÕI: Bạn KHÔNG được viết giáo án mới từ đầu. Bạn phải NÂNG CẤP giáo án gốc sau đây của giáo viên bằng cách GIỮ NGUYÊN TOÀN BỘ cấu trúc, hoạt động, nội dung khoa học, bài tập và tiến trình đã có — chỉ THÊM/CHỈNH SỬA những điểm chạm AI được chỉ định cụ thể.

VĂN BẢN GIÁO ÁN GỐC CỦA GIÁO VIÊN (BẮT BUỘC BẢO TOÀN):
"""
${input.existingRawText.substring(0, 18000)}
"""

ĐIỂM CHẠM AI CẦN TÍCH HỢP (chỉ chỉnh sửa những hoạt động này):
${JSON.stringify(input.aiIntegrationOptions, null, 2)}

KIÊN QUYẾT BẢO TỒN: 
1. Không cắt bớt phần Mở đầu, Hình thành KT mới, Luyện tập, Vận dụng mà giáo viên đã viết.
2. Không tự động bịa đặt các câu hỏi hay kết luận trừ khi có liên quan trực tiếp tới Công cụ AI.
3. Khi bạn được lệnh tích hợp AI ở một Hoạt động nào đó, chỉ viết thêm đúng phần <ai>[🚨 BÁO ĐỘNG ĐỎ - TÍCH HỢP NĂNG LỰC AI]</ai> mô tả chi tiết tại đó với lời văn của mình, CÒN LẠI DỮ LIỆU CŨ PHẢI SAO CHÉP Y HỆT.
` : ``;
  }

  const basePrompt = `
    Vai trò: Bạn là một Chuyên gia Giáo dục hàng đầu quốc gia, là người xét duyệt giáo án thi giáo viên giỏi xuất sắc. Bạn am hiểu sâu sắc Chương trình GDPT 2018, Công văn 5512/BGDĐT-GDTrH và Khung giáo dục Trí tuệ nhân tạo (AI) theo Quyết định 3439/QĐ-BGDĐT. 
    Lệnh đặc biệt: Hãy soạn một Giáo án (Kế hoạch bài dạy) SIÊU CHI TIẾT, thật sự chuyên sâu, logic, chặt chẽ, cụ thể từng lời nói và hành động mô phỏng thực tế lớp học cho:
    Môn học: ${input.subject}
    Tên bài dạy: ${input.topic}
    Lớp: ${input.grade} - Thời lượng: ${input.duration}
    Hoàn cảnh học sinh: ${input.contextStudents || "Học sinh có khả năng tiếp thu trung bình - khá"}
    Điều kiện trường lớp: ${input.contextSchool || "Lớp học có máy chiếu và kết nối internet cơ bản"}
    Lưu ý riêng về độ tuổi (Nếu là khối 6, 7, 8, 9): Giáo án CẦN TĂNG CƯỜNG thực hành, thao tác trực quan, và trò chơi hóa (gamification). Hạn chế những câu hỏi thảo luận mang tính triết học nặng nề của cấp 3.

    ${AI_SUBJECT_GUIDELINES}
    ${CURRICULUM_DATA}
    ${formattingNeed ? FORMATTING_INSTRUCTIONS : ""}
    ${englishConstraint}

    YÊU CẦU NỘI DUNG NGHIÊM NGẶT (CHUẨN CV 5512 và QĐ 3439):

    QUY TẮC THỰC THI NGHIÊM NGẶT (CRITICAL RULES):
    1. KIỂM TRA ĐIỀU KIỆN TÍCH HỢP:
       - Tự động đánh giá nội dung bài học để xem có khả năng tích hợp AI hay không.
       - Nếu bài học được xác định là "Không tích hợp": Hãy soạn giáo án thuần túy theo Công văn 5512, tuyệt đối không đưa nội dung AI vào (để trống mục Năng lực AI).
       - Nếu bài học có "Tích hợp AI": Bắt buộc thêm một mục riêng biệt có tên "HOẠT ĐỘNG GIÁO DỤC AI" ngay trong phần nội dung tiến trình dạy học ở vị trí có điểm chạm.
    2. MÔ TẢ CÔNG CỤ SỐ AI: Trong hoạt động có tích hợp, phải mô tả cụ thể việc sử dụng các công cụ AI (ChatGPT, Canva, chatbot...) để hỗ trợ học sinh đạt được năng lực tương ứng.
    3. GẮN MÃ CHỈ BÁO: Tại hoạt động tích hợp, BẮT BUỘC ghi rõ mã chỉ báo theo định dạng KHỐI_LỚP.NỘI_DUNG.CHỦ_ĐỀ.SỐ_THỨ_TỰ (Ví dụ: 10.A.A1.1).
    4. PHẢN BIỆN & BÁO ĐỘNG ĐỎ: BẮT BUỘC sử dụng thẻ <ai>[🚨 BÁO ĐỘNG ĐỎ - TÍCH HỢP AI]</ai> để đánh dấu hoạt động trọng tâm có ứng dụng công nghệ AI.

    I. MỤC TIÊU:
    - Kiến thức: Nêu rõ kiến thức cốt lõi. (Theo CV 5512).
    - Năng lực:
      + Đặc thù môn học: Theo chương trình 2018.
      + Năng lực AI đặc thù (Chỉ thêm nếu Có tích hợp AI): Phân tích rõ các NLa, NLb, NLc, NLd kèm mã chỉ báo chuẩn (Ví dụ KHỐI LỚP.NỘI DUNG.CHỦ ĐỀ.YCCĐ: 11.B.B1.2).
      + Năng lực chung: Tự chủ, tự học; Giao tiếp...
    - Phẩm chất: Theo CV 5512.

    II. THIẾT BỊ DẠY HỌC VÀ HỌC LIỆU: Đảm bảo theo quy định 5512 (thêm Công cụ số AI nếu Có tích hợp).

    III. TIẾN TRÌNH DẠY HỌC (CHI TIẾT):
    ${LESSON_PLAN_STRICT_GUIDELINES}
    
    Phân bổ 4 hoạt động chuẩn 5512:
    1. Mở đầu (Xác định vấn đề).
    2. Hình thành kiến thức mới.
    3. Luyện tập (Các hoạt động không tích hợp soạn chuẩn 5512).
    4. Vận dụng.
    (LƯU Ý: Với bài học "Có tích hợp AI", phải lồng ghép khéo léo "HOẠT ĐỘNG GIÁO DỤC AI" kèm khai báo mã chỉ báo và thẻ [🚨 BÁO ĐỘNG ĐỎ] vào 1 trong 4 bước trên sao cho phù hợp).

    IV. KẾ HOẠCH ĐÁNH GIÁ:
    BẮT BUỘC thiết kế tiêu chí đánh giá kỹ năng tương tác với AI và khả năng phản biện. QUAN TRỌNG: Tại phần Bài kiểm tra ngắn (Quiz), BẮT BUỘC phải viết nội dung cụ thể của 2-3 câu hỏi trắc nghiệm (gồm câu hỏi, 4 đáp án A B C D và đáp án đúng) thay vì chỉ ghi chung chung là "có 5 câu hỏi".

    V. PHỤ LỤC:
    Gợi ý 3-5 mẫu lệnh Prompt cụ thể cho bài học này để HS thực hành.

    Định dạng đầu ra: JSON.
  `;

  try {
    return await callGeminiWithFallback(prompt, {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        objectives: {
          type: Type.OBJECT,
          properties: {
            knowledge: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Mục tiêu về kiến thức" },
            subjectSpecific: { type: Type.ARRAY, items: { type: Type.STRING } },
            aiSpecific: { type: Type.ARRAY, items: { type: Type.STRING } },
            general: { type: Type.ARRAY, items: { type: Type.STRING } },
            qualities: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["knowledge", "subjectSpecific", "aiSpecific", "general", "qualities"],
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
              name: { type: Type.STRING },
              objective: { type: Type.STRING },
              content: { type: Type.STRING },
              product: { type: Type.STRING },
              procedure: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    stepName: { type: Type.STRING, description: "Tên bước (Bắt buộc theo thứ tự: Bước 1: Chuyển giao nhiệm vụ; Bước 2: Thực hiện nhiệm vụ; Bước 3: Báo cáo, thảo luận; Bước 4: Kết luận, nhận định)" },
                    teacherStudentActivities: { type: Type.STRING, description: "Kịch bản GV-HS SIÊU CHI TIẾT (100-250 từ). Lệnh bắt buộc: Phần nội dung chốt kiến thức/kết luận của giáo viên PHẢI được bọc trong thẻ <bold>...</bold> để in đậm. Phần nội dung nào tích hợp AI (ví dụ Prompt, hướng dẫn kỹ năng, chỉ báo 10.A.A1.1...) PHẢI được bọc trong thẻ <ai>...</ai> để bôi đỏ." },
                    expectedProduct: { type: Type.STRING, description: "Dự kiến sản phẩm (Chi tiết kết quả mong đợi)" },
                  },
                  required: ["stepName", "teacherStudentActivities", "expectedProduct"],
                },
              },
            },
            required: ["name", "objective", "content", "product", "procedure"],
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
      },
      required: ["title", "objectives", "materials", "activities", "assessment", "appendix"],
    });
  } catch (error) {
    console.error("Error generating lesson plan:", error);
    throw error;
  }
};

export const generateEducationalPlan = async (subject: string, grade: string, province?: string, referencePlan?: any[], options?: { useLaTeX?: boolean, detailDrawings?: boolean, customCurriculumData?: any[] }) => {
  const formattingNeed = options?.useLaTeX || options?.detailDrawings || ["Toán học", "Vật lý", "Hóa học", "Địa lí"].includes(subject);
  const englishConstraint = (subject === "Tiếng Anh" || subject.toLowerCase().includes("english")) ? "\nLỆNH ĐẶC BIỆT TỐI QUAN TRỌNG: Môn học là Tiếng Anh nên TOÀN BỘ nội dung kế hoạch giáo dục PHẢI ĐƯỢC VIẾT 100% BẰNG TIẾNG ANH (ENGLISH)." : "";

  const curriculumConstraint = options?.customCurriculumData
    ? `DỮ LIỆU BÀI HỌC BẮT BUỘC TỪ PHỤ LỤC DO GIÁO VIÊN CUNG CẤP:
${JSON.stringify(options.customCurriculumData, null, 2)}
LỆNH VỀ TÊN BÀI HỌC TỐI CAO: TUYỆT ĐỐI tuân thủ danh sách tên bài học và số tiết trong mảng dữ liệu trên. KHÔNG SỬ DỤNG DỮ LIỆU MẶC ĐỊNH KHÁC.`
    : CURRICULUM_DATA;

  const referencePrompt = referencePlan
    ? `DỰA TRÊN KẾ HOẠCH TỔ CHUYÊN MÔN SAU ĐÂY ĐỂ ĐỒNG NHẤT NỘI DUNG (BẮT BUỘC):
       ${JSON.stringify(referencePlan.map(i => ({ bài: i.lessonName, mục_tiêu: i.lessonGoal, ai: i.aiCompetency })), null, 2)}
       
       Yêu cầu: Bạn phải giữ nguyên tên các bài học và mục tiêu AI đã có trong kế hoạch tổ chuyên môn ở trên.`
    : "";

  const prompt = `
    Hãy đóng vai một chuyên gia giáo dục THPT tại Việt Nam. Xây dựng "Khung kế hoạch giáo dục của giáo viên" (Phân phối chương trình cả năm) cho:
    - Môn: ${subject}
    - Lớp: ${grade}
    ${subject === "Giáo dục địa phương" && province ? `- Địa phương (Tỉnh/Thành phố): ${province}` : ""}
    
    ${referencePrompt}
    
    ${AI_SUBJECT_GUIDELINES}
    ${curriculumConstraint}
    ${formattingNeed ? FORMATTING_INSTRUCTIONS : ""}
    ${englishConstraint}

    YÊU CẦU QUAN TRỌNG VỀ ĐỘ CHÍNH XÁC:
    1. TUÂN THỦ CHƯƠNG TRÌNH GDPT 2018 (VÀ TT 17/2025 CHO MÔN ĐỊA LÍ): 
       - LƯU Ý MÔN ĐỊA LÍ: TUYỆT ĐỐI tuân thủ danh mục bài học theo Thông tư 17/2025/TT-BGDĐT (điều chỉnh tên bài, thứ tự chương trình của môn Địa Lí theo TT mới nhất).
       - Đối với các môn còn lại: Sử dụng chính xác tên các bài học theo phân phối chương trình chuẩn.
       - ĐỐI VỚI TẤT CẢ CÁC MÔN CÒN LẠI: Nội dung, trật tự và tên bài học BẮT BUỘC PHẢI KHỚP TUYỆT ĐỐI VỚI BỘ SÁCH "KẾT NỐI TRI THỨC VỚI CUỘC SỐNG" của NXB Giáo dục Việt Nam. TUYỆT ĐỐI KHÔNG sử dụng yếu tố địa phương (${province}) để thay đổi tên bài học của các môn này.
       - ĐỐI VỚI MÔN GIÁO DỤC ĐỊA PHƯƠNG: Chỉ trong trường hợp này mới sử dụng nội dung đặc thù của ${province}.
    
    ${curriculumConstraint}

    2. Cấu trúc bảng Phân phối chương trình:
       - Thứ tự tiết: Số thứ tự tiết học.
       - Bài học: Tên bài học theo chương trình.
       - Số tiết: Số lượng tiết dành cho bài học đó.
       - Thời điểm: Tuần hoặc tháng thực hiện (Ví dụ: Tuần 1).
       - Thiết bị dạy học: Các thiết bị truyền thống cần thiết.
       - Công cụ số và AI (BẮT BUỘC): Bám sát định hướng CV 3439:
         + Phương án triển khai: Sử dụng tình huống giả định, nghiên cứu tình huống (case study) hay có công cụ AI trực tiếp.
         + Học liệu/công cụ cụ thể: Các bài báo, video phân tích, các bộ dữ liệu giả định, hoặc tên phần mềm/nền tảng AI sẽ sử dụng.
       - Địa điểm dạy học: Lớp học, phòng máy tính, thư viện...
       - Định hướng năng lực số: Cụ thể hóa mã YCCĐ AI (Khung 3439). QUY TẮC MÃ: KHỐI LỚP.NỘI DUNG(A/B/C/D).CHỦ ĐỀ(A1/B1).YCCĐ_SỐ(1/2/3) (Ví dụ: 10.A.A1.1, 11.C.C2.3). TUYỆT ĐỐI tuân thủ dấu chấm phân tách và định dạng này.
       - ĐỊNH DẠNG VĂN BẢN (RẤT QUAN TRỌNG): TUYỆT ĐỐI KHÔNG SỬ DỤNG MÃ LATEX ($...$, \sin, \cos) trong bảng này. Các công thức toán/lý/hóa phải chuyển thành text thường dễ đọc nhất (vd: y = sin x).

    2. NGUYÊN TẮC TÍCH HỢP (Theo 8334/BGDĐT-GDPT):
       - Rà soát toàn bộ bài học trong chương trình.
       - KHÔNG tích hợp dàn trải hoặc khiên cưỡng. Chỉ thực hiện khi có "điểm chạm" logic và tự nhiên giữa kiến thức môn học và năng lực AI.
       - Nếu bài nào không phù hợp để tích hợp, tại cột "YCCĐ AI" và "Mục tiêu tích hợp AI" ghi rõ: "Không tích hợp".

    3. Định dạng đầu ra: Trình bày dưới dạng JSON Array các đối tượng.
  `;

  try {
    return await callGeminiWithFallback(prompt, {
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
  } catch (error) {
    console.error("Error generating educational plan:", error);
    throw error;
  }
};

export const generateDepartmentPlan = async (subject: string, grade: string, province?: string, options?: { useLaTeX?: boolean, detailDrawings?: boolean, customCurriculumData?: any[] }) => {
  const formattingNeed = options?.useLaTeX || options?.detailDrawings || ["Toán học", "Vật lý", "Hóa học", "Địa lí"].includes(subject);
  const englishConstraint = (subject === "Tiếng Anh" || subject.toLowerCase().includes("english")) ? "\nLỆNH ĐẶC BIỆT TỐI QUAN TRỌNG: Môn học là Tiếng Anh nên TOÀN BỘ nội dung kế hoạch giáo dục PHẢI ĐƯỢC VIẾT 100% BẰNG TIẾNG ANH (ENGLISH)." : "";

  const curriculumConstraint = options?.customCurriculumData
    ? `DỮ LIỆU BÀI HỌC BẮT BUỘC TỪ PHỤ LỤC DO GIÁO VIÊN CUNG CẤP:
${JSON.stringify(options.customCurriculumData, null, 2)}
LỆNH VỀ TÊN BÀI HỌC TỐI CAO: TUYỆT ĐỐI tuân thủ danh sách tên bài học và số tiết trong mảng dữ liệu trên. Phải sinh KHTCM cho TOÀN BỘ các bài học được mô tả trong mảng này. KHÔNG SỬ DỤNG DỮ LIỆU CHƯƠNG TRÌNH MẶC ĐỊNH KHÁC.`
    : CURRICULUM_DATA;
  const prompt = `
    Bạn là một Chuyên gia xây dựng chương trình giáo dục. Hãy giúp tôi lập Kế hoạch giáo dục tổ chuyên môn tích hợp nội dung giáo dục AI cho môn: ${subject}, lớp: ${grade}${subject === "Giáo dục địa phương" && province ? `, tại địa phương: ${province}` : ""}.
    
    YÊU CẦU QUAN TRỌNG VỀ TÊN BÀI HỌC VÀ CHƯƠNG TRÌNH:
    1. Nếu là môn "Giáo dục địa phương": Phải bám sát chương trình của ${province}.
    2. ĐỐI VỚI MÔN ĐỊA LÍ: TUYỆT ĐỐI BẮT BUỘC tuân thủ danh mục bài học theo Thông tư 17/2025/TT-BGDĐT (ưu tiên TT 17/2025 nếu có sai lệch với dữ liệu cũ).
    3. Nếu là các môn học khác (Toán, Văn...): Phải sử dụng tên bài học TRÙNG KHỚP 100% với Chương trình GDPT 2018 và SGK hiện hành. 
    
    ${curriculumConstraint}
    
    ${formattingNeed ? FORMATTING_INSTRUCTIONS : ""}
    ${englishConstraint}

    Nhiệm vụ cụ thể:
    1. Rà soát & Phân tích toàn diện: Hãy rà soát TOÀN BỘ các chủ đề/bài học trong chương trình GDPT 2018 của môn này. KHÔNG ĐƯỢC bỏ sót bài nào.
    2. Đánh giá khả năng tích hợp AI:
       - Với mỗi bài học, xác định xem có khả năng tích hợp AI dựa trên các tiêu chí: có nội dung phân tích xã hội, kinh tế, pháp luật hoặc có yếu tố dữ liệu, phương pháp nghiên cứu.
       - Nếu bài học PHÙ HỢP: Xác định mạch nội dung AI (NLa, NLb, NLc, NLd) và mục tiêu cụ thể.
       - Nếu bài học KHÔNG PHÙ HỢP: Ghi rõ "Không tích hợp" vào các cột liên quan đến AI để tránh việc tích hợp khiên cưỡng.
    3. Ánh xạ Năng lực:
       - Mục tiêu bài học (lessonGoal): PHẢI MÔ TẢ CHI TIẾT ĐỦ CÁC NỘI DUNG: Kiến thức (HS nắm vững vấn đề gì?); Năng lực (bao gồm Năng lực chung và Năng lực đặc thù môn học được cụ thể hóa bằng hành động); Phẩm chất (Các phẩm chất cần hình thành).
       - Số tiết (periods): Số lượng tiết học dự kiến cho bài học này.
       - Năng lực AI (aiCompetency): Làm rõ chỉ báo trong YCCĐ. QUY TẮC KÝ HIỆU CHUẨN: KHỐI_LỚP.NỘI_DUNG.CHỦ_ĐỀ.SỐ_THỨ_TỰ (Ví dụ: 10.A.A1.1 HOẶC 12.B.B1.2). TUYỆT ĐỐI tuân thủ bắt buộc định dạng này, trong đó Số thứ tự ứng với từng gạch đầu dòng trong quy định QĐ 3439.
       - Mạch nội dung AI: 
         - ĐỊNH DẠNG VĂN BẢN (RẤT QUAN TRỌNG): TUYỆT ĐỐI KHÔNG SỬ DỤNG MÃ LATEX ($...$, \sin, \cos) HOẶC CÁC KÝ HIỆU ĐẶC BIỆT KÍCH ỨNG LỖI. Các công thức toán/lý/hóa phải được viết dưới dạng văn bản thường thẳng thắn (Ví dụ: y = sin x).
         * NLa (A): Tư duy lấy con người làm trung tâm.
         * NLb (B): Đạo đức và trách nhiệm xã hội.
         * NLc (C): Kỹ thuật và ứng dụng.
         * NLd (D): Giải quyết vấn đề và thiết kế hệ thống.
       * Lưu ý: Đối với các môn ngoài Tin học, ưu tiên trọng tâm vào NLa và NLb. 
    4. Xây dựng kế hoạch: Đảm bảo nội dung tích hợp không làm thay đổi nội dung cốt lõi của môn học.

    Định dạng đầu ra: JSON Array các đối tượng với các trường sau:
    - lessonName: Tên bài học/Chủ đề theo chương trình hiện hành.
    - lessonGoal: Mục tiêu bài học chi tiết (Kiến thức, Năng lực, Phẩm chất).
    - periods: Số tiết (Ví dụ: "2 tiết").
    - aiCompetency: Năng lực AI tích hợp (Ví dụ: NLb - Đạo đức AI).
    - aiObjective: Mục tiêu giáo dục AI cụ thể (Làm rõ các chỉ báo trong YCCĐ, ví dụ: 10.A.A1).
    - implementationForm: Hình thức triển khai (Lồng ghép/Chuyên đề/Ngoại khóa).
  `;

  try {
    return await callGeminiWithFallback(prompt, {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          lessonName: { type: Type.STRING },
          lessonGoal: { type: Type.STRING },
          periods: { type: Type.STRING },
          aiCompetency: { type: Type.STRING },
          aiObjective: { type: Type.STRING },
          implementationForm: { type: Type.STRING },
        },
        required: ["lessonName", "lessonGoal", "periods", "aiCompetency", "aiObjective", "implementationForm"],
      },
    });
  } catch (error) {
    console.error("Error generating department plan:", error);
    throw error;
  }
};

export const generateCompetencyEvaluation = async (lessonPlan: any) => {
  const prompt = `
    Dựa trên Kế hoạch bài dạy (KHBD) sau đây, hãy thiết kế một "Hệ thống đánh giá năng lực" chi tiết theo Công văn 3439/BGDĐT và Chương trình GDPT 2018.
    
    Tên bài: ${lessonPlan.title}
    Mục tiêu kiến thức: ${JSON.stringify(lessonPlan.objectives.knowledge)}
    Mục tiêu năng lực: ${JSON.stringify(lessonPlan.objectives.subjectSpecific)}
    Mục tiêu AI: ${JSON.stringify(lessonPlan.objectives.aiSpecific)}
    
    Yêu cầu hệ thống đánh giá bao gồm:
    1. TIÊU CHÍ ĐÁNH GIÁ (Rubrics): Thiết kế bảng Rubric cho ít nhất 3 năng lực cốt lõi được thể hiện trong bài dạy (bao gồm năng lực chung và năng lực đặc thù môn học/năng lực AI). Mỗi năng lực cần có các mức độ đạt được (VD: Mức 1: Chưa đạt; Mức 2: Đạt; Mức 3: Khá; Mức 4: Tốt).
    2. CÔNG CỤ ĐÁNH GIÁ THƯỜNG XUYÊN: Thiết kế các câu hỏi trắc nghiệm, câu hỏi tự luận ngắn hoặc bảng kiểm (Checklist) dùng trong quá trình dạy học để đánh giá tiến trình của học sinh.
    3. CÔNG CỤ ĐÁNH GIÁ ĐỊNH KỲ: Thiết kế một bài tập/dự án nhỏ hoặc câu hỏi tổng hợp nhằm đánh giá mức độ đạt được mục tiêu sau khi kết thúc bài học.
    4. HƯỚNG DẪN NHẬN XÉT: Các mẫu nhận xét tự luận phù hợp với từng mức độ năng lực.

    LƯU Ý: Phải có các tiêu chí cụ thể đánh giá "Năng lực AI" (NLa - NLd) đã được xác định trong bài dạy.
    LƯU Ý QUAN TRỌNG VỀ NGÔN NGỮ: Bắt buộc kết quả trả về PHẢI ĐỒNG NHẤT 100% với ngôn ngữ của đầu vào. Nếu Tên bài hoặc mục tiêu được viết bằng Tiếng Anh, TOÀN BỘ nội dung Rubric, Câu hỏi, Checklists và Đánh giá phải được viết 100% bằng Tiếng Anh (English).
    
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
            quizzes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  answer: { type: Type.STRING },
                },
                required: ["question", "options", "answer"],
              },
            },
            checklists: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["quizzes", "checklists"],
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
