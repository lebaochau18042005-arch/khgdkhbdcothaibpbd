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

const callGeminiWithFallback = async (prompt: string, responseSchema: any) => {
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
- Lịch sử: Trọng tâm NLa, NLb, NLc. Nội dung: Tổng hợp tư liệu đa nguồn, dòng thời gian tương tác, giả thuyết lịch sử. Thảo luận: Độ tin cậy, thiên kiến trong nguồn AI, tác động của CMCN đến tiến trình lịch sử.
- Địa lí: Trọng tâm NLa, NLb, NLc. Nội dung: Phân tích Big Data khí hậu/dân cư, mô hình hóa biến đổi khí hậu, hỗ trợ quy hoạch. Thảo luận: Trách nhiệm đạo đức trong giám sát, công bằng tài nguyên dựa trên dự báo AI.
- GD KT & Pháp luật: Trọng tâm NLa, NLb. Nội dung: So sánh mô hình kinh tế/pháp luật, phân tích xu hướng thị trường lao động. Thảo luận: Tác động tự động hóa, vấn đề pháp lý mới, quyền riêng tư và bảo vệ dữ liệu.
- Toán: Trọng tâm NLa (hỗ trợ bởi NLc, NLd). Nội dung: Giải bài toán tối ưu, trực quan hóa hàm số/hình học, phân tích dữ liệu thống kê. Thảo luận: Vai trò tư duy chứng minh con người, giới hạn của mô hình AI.
- Nhóm KHTN (Lý, Hóa, Sinh): Trọng tâm NLa, NLb, NLc. Nội dung: Phân tích dữ liệu thí nghiệm, mô phỏng phản ứng và quá trình sinh học. Thảo luận: Giới hạn AI trong khám phá khoa học, đạo đức sinh học, vũ khí tự động.
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
1. Đối với Công thức (Toán, Vật lí, Hóa học):
- Toàn bộ công thức toán học, biểu thức vật lí: TUYỆT ĐỐI KHÔNG SỬ DỤNG MÃ LATEX (ví dụ các ký hiệu $ ... $ hoặc $$...$$, \sin, \cos). Hãy viết công thức theo cấu trúc văn bản thuần túy và thân thiện nhất với người đọc (Ví dụ: sin x = m).
- Phương trình hóa học: Ghi rõ bằng văn bản (Ví dụ: H2O thay cho H_{2}O).
2. Đối với Hình vẽ, Biểu đồ và Bản đồ:
- Không được bỏ qua hình vẽ: Tại mỗi vị trí cần hình minh họa, biểu đồ hoặc sơ đồ, bạn phải đặt một thẻ giữ chỗ dạng: [CHÈN HÌNH VẼ/BIỂU ĐỒ: Mô tả chi tiết nội dung hình cần vẽ tại đây].
- Mô tả kỹ thuật: Cung cấp các thông số kỹ thuật (ví dụ: Tọa độ điểm, phương trình đường cong, các nhãn ký hiệu trên trục Ox, Oy) để giáo viên dễ dàng vẽ lại bằng phần mềm chuyên dụng (GeoGebra, Chemdraw).
3. Đối với Bảng biểu và Sơ đồ tư duy:
- Sử dụng định dạng bảng chuẩn.
- Các sơ đồ tiến trình hoặc sơ đồ tư duy phải được trình bày theo dạng danh sách phân cấp (bullet points lồng nhau) để dễ dàng chuyển đổi sang SmartArt.
4. Quy chuẩn trình bày:
- Cấu trúc: Phải tuân thủ đúng các mục của Công văn 5512 (I. Mục tiêu, II. Thiết bị, III. Tiến trình, IV. Đánh giá) và Quyết định 3439 (Tích hợp NLa, NLb, NLc, NLd).
`;

const LESSON_PLAN_STRICT_GUIDELINES = `
CHỈ THỊ THỰC THI NGHIÊM NGẶT CHO MỤC III. TIẾN TRÌNH DẠY HỌC (CHUẨN CÔNG VĂN 5512 & QĐ 3439):
1. Thiết kế đúng và đủ 4 hoạt động theo cấu trúc chuẩn CV 5512 (Mở đầu, Hình thành kiến thức, Luyện tập, Vận dụng).
2. Với MỖI hoạt động, bạn phải đảm bảo có 4 thành tố: Mục tiêu, Nội dung, Sản phẩm, Tổ chức thực hiện. Các mục này phải mô tả THẬT CHI TIẾT CỤ THỂ, tuyệt đối không viết chung chung kiểu "GV yêu cầu HS làm bài".
3. TRỌNG TÂM CHI TIẾT Ở PHẦN "TỔ CHỨC THỰC HIỆN" (BẮT BUỘC có đủ 4 bước, mỗi bước phải rất dài và có chiều sâu sư phạm tối thiểu 100-200 từ):
   - Bước 1: Giao nhiệm vụ học tập: Ghi RÕ RÀNG lời dẫn dắt của Giáo viên (GV) trong ngoặc kép ("..."). Liệt kê cụ thể từng yêu cầu, câu hỏi GV đặt ra, tài liệu hoặc công cụ AI (theo QĐ 3439) được giao cho Học sinh (HS) là gì?
   - Bước 2: Thực hiện nhiệm vụ: Mô tả cực kỳ chi tiết hành động của HS. HS suy nghĩ gì, thảo luận nhóm ra sao? Nếu dùng công cụ AI (ChatGPT, Gemini), HS sẽ nhập câu lệnh (Prompt) như thế nào? GV đi quan sát, theo dõi và có những hành động hỗ trợ nào khi HS gặp khó khăn?
   - Bước 3: Báo cáo, thảo luận: Chỉ đích danh cách thức GV chọn nhóm trình bày. HS lên bảng hoặc sử dụng máy chiếu trình bày sản phẩm học tập và kết quả do AI tạo ra như thế nào? Các HS/Nhóm khác đặt câu hỏi phản biện, tranh luận về độ chính xác của tài liệu hoặc của AI ra sao? (Đặc biệt nhấn mạnh việc Kiểm chứng chéo - Cross-checking kết quả AI).
   - Bước 4: Kết luận, nhận định: GV đánh giá cặn kẽ thái độ làm việc của HS. GV chốt lại ĐÚNG KIẾN THỨC TRỌNG TÂM (ghi nội dung chốt). Đánh giá mức độ thành thạo Năng lực số (NLa, NLb, NLc, NLd) và ý thức trách nhiệm (đạo đức AI) của học sinh. 
4. Nếu nội dung liên quan đến môn Toán/Lý/Hóa, TUYỆT ĐỐI KHÔNG ĐƯỢC SỬ DỤNG MÃ LATEX. Mọi nội dung câu hỏi/nhiệm vụ bắt buộc phải trình bày bằng văn bản trực quan thân thiện nhất (ví dụ: khối chóp S.ABCD, sin a + cos a = 1).
5. Yêu cầu sản phẩm trả về: XUẤT SẮC, TOÀN DIỆN DIỆN, THẬT DÀI VÀ CỤ THỂ ĐẾN TỪNG CHI TIẾT SƯ PHẠM. Khối lượng chữ cho phần Tổ chức thực hiện phải rất lớn, mô phỏng đúng kịch bản của một giáo viên dạy giỏi cấp Quốc gia.
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
}

export const generateLessonPlan = async (input: LessonPlanInput) => {
  const formattingNeed = input.useLaTeX || input.detailDrawings || ["Toán học", "Vật lý", "Hóa học", "Địa lí"].includes(input.subject);
  const englishConstraint = (input.subject === "Tiếng Anh" || input.subject.toLowerCase().includes("english")) ? "\nLỆNH ĐẶC BIỆT TỐI QUAN TRỌNG: Môn học là Tiếng Anh nên TOÀN BỘ nội dung giáo án (kịch bản GV-HS, mục tiêu, nội dung...) PHẢI ĐƯỢC VIẾT 100% BẰNG TIẾNG ANH (ENGLISH)." : "";

  const prompt = `
    Vai trò: Bạn là một Chuyên gia Giáo dục hàng đầu quốc gia, là người xét duyệt giáo án thi giáo viên giỏi xuất sắc. Bạn am hiểu sâu sắc Chương trình GDPT 2018, Công văn 5512/BGDĐT-GDTrH và Khung giáo dục Trí tuệ nhân tạo (AI) theo Quyết định 3439/QĐ-BGDĐT. 
    Lệnh đặc biệt: Hãy soạn một Giáo án (Kế hoạch bài dạy) SIÊU CHI TIẾT, thật sự chuyên sâu, logic, chặt chẽ, cụ thể từng lời nói và hành động mô phỏng thực tế lớp học cho:
    Môn học: ${input.subject}
    Tên bài dạy: ${input.topic}
    Lớp: ${input.grade} - Thời lượng: ${input.duration}
    Hoàn cảnh học sinh: ${input.contextStudents || "Học sinh có khả năng tiếp thu trung bình - khá"}
    Điều kiện trường lớp: ${input.contextSchool || "Lớp học có máy chiếu và kết nối internet cơ bản"}

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
    3. GẮN MÃ CHỈ BÁO: Tại hoạt động tích hợp, phải ghi rõ mã chỉ báo năng lực AI từ QĐ 3439 (Ví dụ: 12.A1.a).
    4. PHẢN BIỆN & BÁO ĐỘNG ĐỎ: BẮT BUỘC sử dụng thẻ <ai>[🚨 BÁO ĐỘNG ĐỎ - TÍCH HỢP AI]</ai> để đánh dấu hoạt động trọng tâm có ứng dụng công nghệ AI.

    I. MỤC TIÊU:
    - Kiến thức: Nêu rõ kiến thức cốt lõi. (Theo CV 5512).
    - Năng lực:
      + Đặc thù môn học: Theo chương trình 2018.
      + Năng lực AI đặc thù (Chỉ thêm nếu Có tích hợp AI): Phân tích rõ các thành phần NLa, NLb, NLc, NLd kèm mã chỉ báo (Ví dụ khối 12 là 12.A1.a).
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
                    teacherStudentActivities: { type: Type.STRING, description: "Kịch bản GV-HS SIÊU CHI TIẾT (100-250 từ). Lệnh bắt buộc: Phần nội dung chốt kiến thức/kết luận của giáo viên PHẢI được bọc trong thẻ <bold>...</bold> để in đậm. Phần nội dung nào tích hợp AI (ví dụ Prompt, hướng dẫn kỹ năng, chỉ báo 12.A1.a...) PHẢI được bọc trong thẻ <ai>...</ai> để bôi đỏ." },
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

export const generateEducationalPlan = async (subject: string, grade: string, province?: string, referencePlan?: any[], options?: { useLaTeX?: boolean, detailDrawings?: boolean }) => {
  const formattingNeed = options?.useLaTeX || options?.detailDrawings || ["Toán học", "Vật lý", "Hóa học", "Địa lí"].includes(subject);
  const englishConstraint = (subject === "Tiếng Anh" || subject.toLowerCase().includes("english")) ? "\nLỆNH ĐẶC BIỆT TỐI QUAN TRỌNG: Môn học là Tiếng Anh nên TOÀN BỘ nội dung kế hoạch giáo dục PHẢI ĐƯỢC VIẾT 100% BẰNG TIẾNG ANH (ENGLISH)." : "";
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
    ${CURRICULUM_DATA}
    ${formattingNeed ? FORMATTING_INSTRUCTIONS : ""}
    ${englishConstraint}

    YÊU CẦU QUAN TRỌNG VỀ ĐỘ CHÍNH XÁC:
    1. TUÂN THỦ CHƯƠNG TRÌNH GDPT 2018 (VÀ TT 17/2025 CHO MÔN ĐỊA LÍ): 
       - LƯU Ý MÔN ĐỊA LÍ: TUYỆT ĐỐI tuân thủ danh mục bài học theo Thông tư 17/2025/TT-BGDĐT (điều chỉnh tên bài, thứ tự chương trình của môn Địa Lí theo TT mới nhất).
       - Đối với các môn còn lại: Sử dụng chính xác tên các bài học theo phân phối chương trình chuẩn.
       - ĐỐI VỚI CÁC MÔN HỌC CHUNG (Toán, Văn, Anh, Lí, Hóa, Sinh, Sử, Địa...): Nội dung và tên bài học là GIỐNG NHAU trên toàn quốc theo các bộ sách (Kết nối tri thức, Chân trời sáng tạo, Cánh diều). TUYỆT ĐỐI KHÔNG sử dụng yếu tố địa phương (${province}) để thay đổi tên bài học của các môn này.
       - ĐỐI VỚI MÔN GIÁO DỤC ĐỊA PHƯƠNG: Chỉ trong trường hợp này mới sử dụng nội dung đặc thù của ${province}.
    
    ${CURRICULUM_DATA}

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
       - Định hướng năng lực số: Cụ thể hóa mã YCCĐ AI (Khung 3439). QUY TẮC MÃ: Ký tự phân cấp cuối cùng BẮT BUỘC VIẾT THƯỜNG (Ví dụ: 10.A.a1, 11.B.b2, 12.C.c1). Tuyệt đối không viết hoa toàn bộ như 11.C.C1.
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

export const generateDepartmentPlan = async (subject: string, grade: string, province?: string, options?: { useLaTeX?: boolean, detailDrawings?: boolean }) => {
  const formattingNeed = options?.useLaTeX || options?.detailDrawings || ["Toán học", "Vật lý", "Hóa học", "Địa lí"].includes(subject);
  const englishConstraint = (subject === "Tiếng Anh" || subject.toLowerCase().includes("english")) ? "\nLỆNH ĐẶC BIỆT TỐI QUAN TRỌNG: Môn học là Tiếng Anh nên TOÀN BỘ nội dung kế hoạch giáo dục PHẢI ĐƯỢC VIẾT 100% BẰNG TIẾNG ANH (ENGLISH)." : "";
  const prompt = `
    Bạn là một Chuyên gia xây dựng chương trình giáo dục. Hãy giúp tôi lập Kế hoạch giáo dục tổ chuyên môn tích hợp nội dung giáo dục AI cho môn: ${subject}, lớp: ${grade}${subject === "Giáo dục địa phương" && province ? `, tại địa phương: ${province}` : ""}.
    
    YÊU CẦU QUAN TRỌNG VỀ TÊN BÀI HỌC VÀ CHƯƠNG TRÌNH:
    1. Nếu là môn "Giáo dục địa phương": Phải bám sát chương trình của ${province}.
    2. ĐỐI VỚI MÔN ĐỊA LÍ: TUYỆT ĐỐI BẮT BUỘC tuân thủ danh mục bài học theo Thông tư 17/2025/TT-BGDĐT (ưu tiên TT 17/2025 nếu có sai lệch với dữ liệu cũ).
    3. Nếu là các môn học khác (Toán, Văn...): Phải sử dụng tên bài học TRÙNG KHỚP 100% với Chương trình GDPT 2018 và SGK hiện hành. 
    
    ${CURRICULUM_DATA}
    
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
       - Năng lực AI (aiCompetency): Phải làm rõ chỉ báo trong YCCĐ. QUY TẮC KÝ HIỆU CHUẨN: Ký hiệu phân loại cấp cuối BẮT BUỘC VIẾT THƯỜNG (Ví dụ: 10.A.a1, 11.B.b2, 12.C.c1). TUYỆT ĐỐI KHÔNG viết hoa chữ cái thứ 2 như 11.C.C1.
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
