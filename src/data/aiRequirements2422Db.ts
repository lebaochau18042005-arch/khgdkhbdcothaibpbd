/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Cơ sở dữ liệu Chuẩn Năng Lực AI theo Quyết định 2422/QĐ-BGDĐT ngày 18/8/2026
 * Áp dụng từ năm học 2026 - 2027 cho cấp THPT (Lớp 10, 11, 12)
 * Cấu trúc mã: [Lớp].[Mã chủ đề].[Số thứ tự]
 */

export interface AiRequirementItem {
  id: string;
  code: string;
  grade: "10" | "11" | "12";
  component: "NLa" | "NLb" | "NLc" | "NLd";
  componentName: string;
  topic: string;
  topicName: string;
  requirementType: "CỐT_LÕI" | "MỞ_RỘNG" | "CHUYÊN_ĐỀ";
  requirementText: string;
  sourceDocumentId: string;
  sourcePage?: number;
  isCore: boolean;
  isExtension: boolean;
  isActive: boolean;
}

export const AI_COMPONENTS_MAP = {
  NLa: {
    code: "NLa",
    name: "Tư duy lấy con người làm trung tâm",
    description: "Nhận thức vai trò chủ đạo, làm chủ của con người; con người kiểm soát, đánh giá và ra quyết định cuối cùng trong hệ thống AI."
  },
  NLb: {
    code: "NLb",
    name: "Đạo đức AI, an toàn, pháp luật và trách nhiệm",
    description: "Nhận diện vấn đề bản quyền, dữ liệu cá nhân, an toàn thông tin, nhận biết và phòng tránh thiên lệch (bias), rủi ro xã hội."
  },
  NLc: {
    code: "NLc",
    name: "Các kĩ thuật và ứng dụng AI",
    description: "Kiến thức về cách AI hoạt động, kỹ năng prompt engineering, khai thác các công cụ và ứng dụng AI vào học tập/nghiên cứu."
  },
  NLd: {
    code: "NLd",
    name: "Thiết kế, thử nghiệm và cải tiến hệ thống AI",
    description: "Phát triển từ mức sử dụng sang thiết kế, kiểm thử, cải tiến các sản phẩm/giải pháp ứng dụng AI giải quyết bài toán thực tế."
  }
};

export const getComponentByTopicLetter = (topicLetter: string): "NLa" | "NLb" | "NLc" | "NLd" => {
  const t = (topicLetter || "A").trim().slice(0, 1).toUpperCase();
  if (t === "A") return "NLa";
  if (t === "B") return "NLb";
  if (t === "C") return "NLc";
  return "NLd";
};

export const getComponentNameByLetter = (letter: string): string => {
  const comp = getComponentByTopicLetter(letter);
  return AI_COMPONENTS_MAP[comp]?.name || "Năng lực AI";
};

export const AI_REQUIREMENTS_2422_DB: AiRequirementItem[] = [
  // ==================== LỚP 10 ====================
  // NLa - Lớp 10
  {
    id: "AI-2422-10-A1-1",
    code: "10.A1.1",
    grade: "10",
    component: "NLa",
    componentName: "Tư duy lấy con người làm trung tâm",
    topic: "A1",
    topicName: "Con người trong hệ thống AI",
    requirementType: "CỐT_LÕI",
    requirementText: "Nhận biết và giải thích được con người là chủ thể thiết kế, cung cấp dữ liệu, kiểm soát hoạt động và chịu trách nhiệm về quyết định của hệ thống AI.",
    sourceDocumentId: "DOC-2026-QD2422",
    sourcePage: 16,
    isCore: true,
    isExtension: false,
    isActive: true
  },
  {
    id: "AI-2422-10-A2-1",
    code: "10.A2.1",
    grade: "10",
    component: "NLa",
    componentName: "Tư duy lấy con người làm trung tâm",
    topic: "A2",
    topicName: "AI vì sự tiến bộ của con người",
    requirementType: "CỐT_LÕI",
    requirementText: "Nêu được ví dụ về các lợi ích và rủi ro tiềm ẩn của AI đối với đời sống, học tập và sản xuất; khẳng định AI chỉ hỗ trợ chứ không thay thế tư duy con người.",
    sourceDocumentId: "DOC-2026-QD2422",
    sourcePage: 16,
    isCore: true,
    isExtension: false,
    isActive: true
  },
  {
    id: "AI-2422-10-A3-1",
    code: "10.A3.1",
    grade: "10",
    component: "NLa",
    componentName: "Tư duy lấy con người làm trung tâm",
    topic: "A3",
    topicName: "Kiểm soát và giám sát AI",
    requirementType: "CỐT_LÕI",
    requirementText: "Thực hiện được việc rà soát, kiểm chứng độc lập các nội dung do AI tạo ra bằng các nguồn tài liệu chính thống (SGK, cổng thông tin uy tín).",
    sourceDocumentId: "DOC-2026-QD2422",
    sourcePage: 17,
    isCore: true,
    isExtension: false,
    isActive: true
  },

  // NLb - Lớp 10
  {
    id: "AI-2422-10-B2-1",
    code: "10.B2.1",
    grade: "10",
    component: "NLb",
    componentName: "Đạo đức AI, an toàn, pháp luật và trách nhiệm",
    topic: "B2",
    topicName: "Bảo vệ dữ liệu cá nhân và quyền riêng tư",
    requirementType: "CỐT_LÕI",
    requirementText: "Nhận biết và tuân thủ nguyên tắc không chia sẻ dữ liệu nhạy cảm, thông tin định danh cá nhân của bản thân và người khác khi tương tác với các công cụ AI.",
    sourceDocumentId: "DOC-2026-QD2422",
    sourcePage: 17,
    isCore: true,
    isExtension: false,
    isActive: true
  },
  {
    id: "AI-2422-10-B3-1",
    code: "10.B3.1",
    grade: "10",
    component: "NLb",
    componentName: "Đạo đức AI, an toàn, pháp luật và trách nhiệm",
    topic: "B3",
    topicName: "Sở hữu trí tuệ và tính minh bạch",
    requirementType: "CỐT_LÕI",
    requirementText: "Giải thích được sự cần thiết của việc ghi rõ nguồn gốc và mức độ hỗ trợ của AI khi sử dụng sản phẩm AI trong học tập; tôn trọng bản quyền tác giả.",
    sourceDocumentId: "DOC-2026-QD2422",
    sourcePage: 18,
    isCore: true,
    isExtension: false,
    isActive: true
  },

  // NLc - Lớp 10
  {
    id: "AI-2422-10-C2-1",
    code: "10.C2.1",
    grade: "10",
    component: "NLc",
    componentName: "Các kĩ thuật và ứng dụng AI",
    topic: "C2",
    topicName: "Ứng dụng AI trong học tập môn học",
    requirementType: "CỐT_LÕI",
    requirementText: "Sử dụng được các công cụ AI phổ biến để tìm kiếm thông tin, tóm tắt nội dung, dịch thuật và hỗ trợ thực hiện nhiệm vụ học tập theo chủ đề môn học.",
    sourceDocumentId: "DOC-2026-QD2422",
    sourcePage: 18,
    isCore: true,
    isExtension: false,
    isActive: true
  },
  {
    id: "AI-2422-10-C3-1",
    code: "10.C3.1",
    grade: "10",
    component: "NLc",
    componentName: "Các kĩ thuật và ứng dụng AI",
    topic: "C3",
    topicName: "Kỹ năng thiết lập câu lệnh Prompt",
    requirementType: "CỐT_LÕI",
    requirementText: "Thiết kế và tinh chỉnh được câu lệnh (prompt) có cấu trúc rõ ràng (bối cảnh, yêu cầu, định dạng đầu ra) để nhận phản hồi chính xác và phù hợp từ AI.",
    sourceDocumentId: "DOC-2026-QD2422",
    sourcePage: 19,
    isCore: true,
    isExtension: false,
    isActive: true
  },
  {
    id: "AI-2422-10-C3-2",
    code: "10.C3.2",
    grade: "10",
    component: "NLc",
    componentName: "Các kĩ thuật và ứng dụng AI",
    topic: "C3",
    topicName: "Phân tích và kiểm thử câu lệnh Prompt",
    requirementType: "CỐT_LÕI",
    requirementText: "So sánh phản hồi của AI giữa các biến thể prompt khác nhau; phát hiện và sửa các điểm thiếu sót, mơ hồ trong câu lệnh.",
    sourceDocumentId: "DOC-2026-QD2422",
    sourcePage: 19,
    isCore: true,
    isExtension: false,
    isActive: true
  },
  {
    id: "AI-2422-10-C4-1",
    code: "10.C4.1",
    grade: "10",
    component: "NLc",
    componentName: "Các kĩ thuật và ứng dụng AI",
    topic: "C4",
    topicName: "Dữ liệu và chất lượng mô hình AI",
    requirementType: "CỐT_LÕI",
    requirementText: "Hiểu được vai trò của tập dữ liệu huấn luyện đối với chất lượng đầu ra của mô hình AI; giải thích được hiện tượng 'ảo giác' (hallucination) của AI.",
    sourceDocumentId: "DOC-2026-QD2422",
    sourcePage: 20,
    isCore: true,
    isExtension: false,
    isActive: true
  },

  // NLd - Lớp 10
  {
    id: "AI-2422-10-D1-1",
    code: "10.D1.1",
    grade: "10",
    component: "NLd",
    componentName: "Thiết kế, thử nghiệm và cải tiến hệ thống AI",
    topic: "D1",
    topicName: "Ý tưởng ứng dụng AI giải quyết vấn đề",
    requirementType: "CỐT_LÕI",
    requirementText: "Đề xuất được ý tưởng sử dụng công cụ AI phù hợp để giải quyết một nhiệm vụ học tập hoặc vấn đề đơn giản trong thực tiễn môn học.",
    sourceDocumentId: "DOC-2026-QD2422",
    sourcePage: 21,
    isCore: true,
    isExtension: false,
    isActive: true
  },
  {
    id: "AI-2422-10-D2-1",
    code: "10.D2.1",
    grade: "10",
    component: "NLd",
    componentName: "Thiết kế, thử nghiệm và cải tiến hệ thống AI",
    topic: "D2",
    topicName: "Đánh giá và cải tiến quy trình ứng dụng AI",
    requirementType: "CỐT_LÕI",
    requirementText: "Đánh giá được hiệu quả và tính khả thi của giải pháp tích hợp AI đã thực hiện; đề xuất hướng chỉnh sửa, tối ưu hóa.",
    sourceDocumentId: "DOC-2026-QD2422",
    sourcePage: 21,
    isCore: true,
    isExtension: false,
    isActive: true
  },

  // ==================== LỚP 11 ====================
  // NLa - Lớp 11
  {
    id: "AI-2422-11-A1-1",
    code: "11.A1.1",
    grade: "11",
    component: "NLa",
    componentName: "Tư duy lấy con người làm trung tâm",
    topic: "A1",
    topicName: "Phân công trách nhiệm Người và AI",
    requirementType: "CỐT_LÕI",
    requirementText: "Phân tích được vai trò bổ trợ của AI trong các hoạt động phức tạp; giải thích tại sao quyết định nhân văn và phán đoán đạo đức thuộc về con người.",
    sourceDocumentId: "DOC-2026-QD2422",
    sourcePage: 25,
    isCore: true,
    isExtension: false,
    isActive: true
  },
  {
    id: "AI-2422-11-A2-1",
    code: "11.A2.1",
    grade: "11",
    component: "NLa",
    componentName: "Tư duy lấy con người làm trung tâm",
    topic: "A2",
    topicName: "Đánh giá tác động của AI đối với nghề nghiệp",
    requirementType: "CỐT_LÕI",
    requirementText: "Đánh giá được sự thay đổi của các ngành nghề liên quan đến môn học dưới tác động của công nghệ AI; xác định các kỹ năng con người cần trau dồi.",
    sourceDocumentId: "DOC-2026-QD2422",
    sourcePage: 25,
    isCore: true,
    isExtension: false,
    isActive: true
  },

  // NLb - Lớp 11
  {
    id: "AI-2422-11-B2-1",
    code: "11.B2.1",
    grade: "11",
    component: "NLb",
    componentName: "Đạo đức AI, an toàn, pháp luật và trách nhiệm",
    topic: "B2",
    topicName: "Định kiến và tính công bằng trong AI",
    requirementType: "CỐT_LÕI",
    requirementText: "Nhận diện và phân tích được các biểu hiện thiên lệch (bias), định kiến giới/văn hóa trong phản hồi của mô hình AI; đề xuất cách kiểm chứng.",
    sourceDocumentId: "DOC-2026-QD2422",
    sourcePage: 26,
    isCore: true,
    isExtension: false,
    isActive: true
  },
  {
    id: "AI-2422-11-B3-1",
    code: "11.B3.1",
    grade: "11",
    component: "NLb",
    componentName: "Đạo đức AI, an toàn, pháp luật và trách nhiệm",
    topic: "B3",
    topicName: "Quy chuẩn liêm chính học thuật và AI",
    requirementType: "CỐT_LÕI",
    requirementText: "Vận dụng được các chuẩn mực liêm chính học thuật khi sử dụng AI; lập bảng đối chiếu minh bạch các nội dung do AI gợi ý và nội dung do học sinh tự làm.",
    sourceDocumentId: "DOC-2026-QD2422",
    sourcePage: 27,
    isCore: true,
    isExtension: false,
    isActive: true
  },

  // NLc - Lớp 11
  {
    id: "AI-2422-11-C3-1",
    code: "11.C3.1",
    grade: "11",
    component: "NLc",
    componentName: "Các kĩ thuật và ứng dụng AI",
    topic: "C3",
    topicName: "Kỹ thuật Prompt nâng cao (Few-shot, Chain-of-thought)",
    requirementType: "CỐT_LÕI",
    requirementText: "Áp dụng được kỹ thuật prompt nâng cao (cung cấp mẫu ví dụ, yêu cầu AI giải thích từng bước) để xử lý các bài toán, tình huống phức tạp trong môn học.",
    sourceDocumentId: "DOC-2026-QD2422",
    sourcePage: 28,
    isCore: true,
    isExtension: false,
    isActive: true
  },
  {
    id: "AI-2422-11-C3-MR1",
    code: "11.C3.MR1",
    grade: "11",
    component: "NLc",
    componentName: "Các kĩ thuật và ứng dụng AI",
    topic: "C3",
    topicName: "Tích hợp đa phương tiện với AI",
    requirementType: "MỞ_RỘNG",
    requirementText: "Khai thác các công cụ AI xử lý đa phương thức (hình ảnh, âm thanh, bảng số liệu) để phục vụ trực quan hóa dữ liệu bài học.",
    sourceDocumentId: "DOC-2026-QD2422",
    sourcePage: 29,
    isCore: false,
    isExtension: true,
    isActive: true
  },
  {
    id: "AI-2422-11-C5-1",
    code: "11.C5.1",
    grade: "11",
    component: "NLc",
    componentName: "Các kĩ thuật và ứng dụng AI",
    topic: "C5",
    topicName: "Phân tích dữ liệu bằng AI",
    requirementType: "CỐT_LÕI",
    requirementText: "Sử dụng AI để xử lý, làm sạch và phân tích các tập dữ liệu thực nghiệm/thống kê trong môn học; rút ra kết luận logic.",
    sourceDocumentId: "DOC-2026-QD2422",
    sourcePage: 30,
    isCore: true,
    isExtension: false,
    isActive: true
  },

  // NLd - Lớp 11
  {
    id: "AI-2422-11-D1-1",
    code: "11.D1.1",
    grade: "11",
    component: "NLd",
    componentName: "Thiết kế, thử nghiệm và cải tiến hệ thống AI",
    topic: "D1",
    topicName: "Thiết kế giải pháp học tập tích hợp AI",
    requirementType: "CỐT_LÕI",
    requirementText: "Xây dựng được quy trình học tập cá nhân hóa có sự trợ giúp của AI (đặt mục tiêu, tạo bài tập luyện tập, kiểm tra chéo kết quả).",
    sourceDocumentId: "DOC-2026-QD2422",
    sourcePage: 31,
    isCore: true,
    isExtension: false,
    isActive: true
  },
  {
    id: "AI-2422-11-D2-1",
    code: "11.D2.1",
    grade: "11",
    component: "NLd",
    componentName: "Thiết kế, thử nghiệm và cải tiến hệ thống AI",
    topic: "D2",
    topicName: "Kiểm thử và đánh giá sản phẩm AI",
    requirementType: "CỐT_LÕI",
    requirementText: "Xây dựng bộ tiêu chí (rubric) để đánh giá tính chính xác, an toàn và mức độ hữu ích của một sản phẩm do AI hỗ trợ tạo ra.",
    sourceDocumentId: "DOC-2026-QD2422",
    sourcePage: 32,
    isCore: true,
    isExtension: false,
    isActive: true
  },

  // ==================== LỚP 12 ====================
  // NLa - Lớp 12
  {
    id: "AI-2422-12-A1-1",
    code: "12.A1.1",
    grade: "12",
    component: "NLa",
    componentName: "Tư duy lấy con người làm trung tâm",
    topic: "A1",
    topicName: "Tính chủ động của con người",
    requirementType: "CỐT_LÕI",
    requirementText: "Phân tích được một hệ thống AI nhằm đảm bảo con người có quyền kiểm soát và chịu trách nhiệm đối với tất cả các bước quan trọng trong vòng đời AI.",
    sourceDocumentId: "DOC-2026-QD2422",
    sourcePage: 41,
    isCore: true,
    isExtension: false,
    isActive: true
  },
  {
    id: "AI-2422-12-A1-MR1",
    code: "12.A1.MR1",
    grade: "12",
    component: "NLa",
    componentName: "Tư duy lấy con người làm trung tâm",
    topic: "A1",
    topicName: "Tính chủ động của con người",
    requirementType: "MỞ_RỘNG",
    requirementText: "Thực hiện được việc phân tích quyền kiểm soát và trách nhiệm của con người trong vòng đời AI thông qua một dự án sáng tạo AI.",
    sourceDocumentId: "DOC-2026-QD2422",
    sourcePage: 41,
    isCore: false,
    isExtension: true,
    isActive: true
  },
  {
    id: "AI-2422-12-A2-1",
    code: "12.A2.1",
    grade: "12",
    component: "NLa",
    componentName: "Tư duy lấy con người làm trung tâm",
    topic: "A2",
    topicName: "Định hướng nghề nghiệp và thích ứng với AI",
    requirementType: "CỐT_LÕI",
    requirementText: "Xác định được lộ trình phát triển năng lực bản thân để thích ứng và cộng tác hiệu quả với AI trong lĩnh vực nghề nghiệp tương lai.",
    sourceDocumentId: "DOC-2026-QD2422",
    sourcePage: 37,
    isCore: true,
    isExtension: false,
    isActive: true
  },

  // NLb - Lớp 12
  {
    id: "AI-2422-12-B1-1",
    code: "12.B1.1",
    grade: "12",
    component: "NLb",
    componentName: "Đạo đức AI, an toàn, pháp luật và trách nhiệm",
    topic: "B1",
    topicName: "Khung pháp lý và đạo đức công nghệ AI",
    requirementType: "CỐT_LÕI",
    requirementText: "Phân tích được các quy định pháp luật Việt Nam và quốc tế về trách nhiệm giải trình, quyền riêng tư và an toàn khi vận hành hệ thống AI.",
    sourceDocumentId: "DOC-2026-QD2422",
    sourcePage: 38,
    isCore: true,
    isExtension: false,
    isActive: true
  },
  {
    id: "AI-2422-12-B2-1",
    code: "12.B2.1",
    grade: "12",
    component: "NLb",
    componentName: "Đạo đức AI, an toàn, pháp luật và trách nhiệm",
    topic: "B2",
    topicName: "Đánh giá rủi ro an ninh mạng và thao túng thông tin",
    requirementType: "CỐT_LÕI",
    requirementText: "Nhận diện được các nguy cơ deepfake, tin giả, thông tin sai lệch do AI tạo ra; thực hiện được các biện pháp xác thực nguồn tin đa kênh.",
    sourceDocumentId: "DOC-2026-QD2422",
    sourcePage: 39,
    isCore: true,
    isExtension: false,
    isActive: true
  },
  {
    id: "AI-2422-12-B3-1",
    code: "12.B3.1",
    grade: "12",
    component: "NLb",
    componentName: "Đạo đức AI, an toàn, pháp luật và trách nhiệm",
    topic: "B3",
    topicName: "Trách nhiệm xã hội và tính bền vững của AI",
    requirementType: "CỐT_LÕI",
    requirementText: "Đánh giá được tác động của việc tiêu thụ năng lượng và tài nguyên tính toán của các trung tâm dữ liệu AI đối với môi trường và phát triển bền vững.",
    sourceDocumentId: "DOC-2026-QD2422",
    sourcePage: 40,
    isCore: true,
    isExtension: false,
    isActive: true
  },

  // NLc - Lớp 12
  {
    id: "AI-2422-12-C2-1",
    code: "12.C2.1",
    grade: "12",
    component: "NLc",
    componentName: "Các kĩ thuật và ứng dụng AI",
    topic: "C2",
    topicName: "Ứng dụng AI trong học tập và cuộc sống",
    requirementType: "CỐT_LÕI",
    requirementText: "Lựa chọn được ý tưởng thiết kế một số công cụ AI để thực hiện các công việc khác nhau.",
    sourceDocumentId: "DOC-2026-QD2422",
    sourcePage: 43,
    isCore: true,
    isExtension: false,
    isActive: true
  },
  {
    id: "AI-2422-12-C2-MR1",
    code: "12.C2.MR1",
    grade: "12",
    component: "NLc",
    componentName: "Các kĩ thuật và ứng dụng AI",
    topic: "C2",
    topicName: "Ứng dụng AI trong học tập và cuộc sống",
    requirementType: "MỞ_RỘNG",
    requirementText: "Tùy chỉnh được các yêu cầu hệ thống AI để hỗ trợ các hoạt động học tập và hoạt động xã hội.",
    sourceDocumentId: "DOC-2026-QD2422",
    sourcePage: 43,
    isCore: false,
    isExtension: true,
    isActive: true
  },
  {
    id: "AI-2422-12-C3-1",
    code: "12.C3.1",
    grade: "12",
    component: "NLc",
    componentName: "Các kĩ thuật và ứng dụng AI",
    topic: "C3",
    topicName: "Công nghệ AI",
    requirementType: "CỐT_LÕI",
    requirementText: "Nêu được một số công cụ mã nguồn mở hoặc miễn phí dùng để thiết kế, huấn luyện và phát triển hệ thống AI, như: Teachable Machine, ML5.js, TensorFlow.js, MIT App Inventor hoặc công cụ phù hợp khác.",
    sourceDocumentId: "DOC-2026-QD2422",
    sourcePage: 43,
    isCore: true,
    isExtension: false,
    isActive: true
  },
  {
    id: "AI-2422-12-C3-MR1",
    code: "12.C3.MR1",
    grade: "12",
    component: "NLc",
    componentName: "Các kĩ thuật và ứng dụng AI",
    topic: "C3",
    topicName: "Công nghệ AI",
    requirementType: "MỞ_RỘNG",
    requirementText: "Sử dụng được một số công cụ mã nguồn mở hoặc miễn phí dùng để thiết kế, huấn luyện và phát triển hệ thống AI.",
    sourceDocumentId: "DOC-2026-QD2422",
    sourcePage: 43,
    isCore: false,
    isExtension: true,
    isActive: true
  },
  {
    id: "AI-2422-12-C3-2",
    code: "12.C3.2",
    grade: "12",
    component: "NLc",
    componentName: "Các kĩ thuật và ứng dụng AI",
    topic: "C3",
    topicName: "Tùy chỉnh và tối ưu hệ thống AI",
    requirementType: "CỐT_LÕI",
    requirementText: "Nêu được ví dụ về cách thức đánh giá hiệu quả của hệ thống AI.",
    sourceDocumentId: "DOC-2026-QD2422",
    sourcePage: 43,
    isCore: true,
    isExtension: false,
    isActive: true
  },
  {
    id: "AI-2422-12-C3-MR2",
    code: "12.C3.MR2",
    grade: "12",
    component: "NLc",
    componentName: "Các kĩ thuật và ứng dụng AI",
    topic: "C3",
    topicName: "Tùy chỉnh và tối ưu hệ thống AI",
    requirementType: "MỞ_RỘNG",
    requirementText: "Đánh giá được khả năng tối ưu hệ thống AI thông qua cập nhật công nghệ, kỹ thuật mới.",
    sourceDocumentId: "DOC-2026-QD2422",
    sourcePage: 43,
    isCore: false,
    isExtension: true,
    isActive: true
  },
  {
    id: "AI-2422-12-C3-MR3",
    code: "12.C3.MR3",
    grade: "12",
    component: "NLc",
    componentName: "Các kĩ thuật và ứng dụng AI",
    topic: "C3",
    topicName: "Tùy chỉnh và tối ưu hệ thống AI",
    requirementType: "MỞ_RỘNG",
    requirementText: "Trình bày được một số khái niệm cơ bản của hệ thống ứng dụng học máy như: hàm mục tiêu, tối ưu hoá hệ thống, mô hình quá khớp dữ liệu (overfitting).",
    sourceDocumentId: "DOC-2026-QD2422",
    sourcePage: 43,
    isCore: false,
    isExtension: true,
    isActive: true
  },
  {
    id: "AI-2422-12-C4-MR1",
    code: "12.C4.MR1",
    grade: "12",
    component: "NLc",
    componentName: "Các kĩ thuật và ứng dụng AI",
    topic: "C4",
    topicName: "Dữ liệu trong AI",
    requirementType: "MỞ_RỘNG",
    requirementText: "Thu thập và tổ chức được dữ liệu đáp ứng yêu cầu của việc phát triển hệ thống AI.",
    sourceDocumentId: "DOC-2026-QD2422",
    sourcePage: 43,
    isCore: false,
    isExtension: true,
    isActive: true
  },
  {
    id: "AI-2422-12-C4-MR2",
    code: "12.C4.MR2",
    grade: "12",
    component: "NLc",
    componentName: "Các kĩ thuật và ứng dụng AI",
    topic: "C4",
    topicName: "Dữ liệu trong AI",
    requirementType: "MỞ_RỘNG",
    requirementText: "Phân tích và xác định được các nền tảng hoặc bộ công cụ phát triển AI, cải thiện các bộ dữ liệu đáp ứng quá trình thiết kế, phát triển AI.",
    sourceDocumentId: "DOC-2026-QD2422",
    sourcePage: 43,
    isCore: false,
    isExtension: true,
    isActive: true
  },

  // NLd - Lớp 12
  {
    id: "AI-2422-12-D1-1",
    code: "12.D1.1",
    grade: "12",
    component: "NLd",
    componentName: "Thiết kế hệ thống AI",
    topic: "D1",
    topicName: "Nhận diện và hình thành giải pháp",
    requirementType: "CỐT_LÕI",
    requirementText: "Nhận biết được một số phương án thiết kế và vận hành hệ thống AI phù hợp để đạt hiệu quả cao trong một số nhiệm vụ cụ thể.",
    sourceDocumentId: "DOC-2026-QD2422",
    sourcePage: 43,
    isCore: true,
    isExtension: false,
    isActive: true
  },
  {
    id: "AI-2422-12-D1-MR1",
    code: "12.D1.MR1",
    grade: "12",
    component: "NLd",
    componentName: "Thiết kế hệ thống AI",
    topic: "D1",
    topicName: "Nhận diện và hình thành giải pháp",
    requirementType: "MỞ_RỘNG",
    requirementText: "Phân tích được một số phương án thiết kế và vận hành hệ thống AI phù hợp để đạt hiệu quả cao trong một số nhiệm vụ cụ thể.",
    sourceDocumentId: "DOC-2026-QD2422",
    sourcePage: 43,
    isCore: false,
    isExtension: true,
    isActive: true
  },
  {
    id: "AI-2422-12-D2-1",
    code: "12.D2.1",
    grade: "12",
    component: "NLd",
    componentName: "Thiết kế hệ thống AI",
    topic: "D2",
    topicName: "Cấu trúc và tương tác, cải tiến hệ thống",
    requirementType: "CỐT_LÕI",
    requirementText: "Nhận biết được các vai trò khác nhau trong quá trình phát triển một sản phẩm AI (như người đề xuất ý tưởng, lập trình, huấn luyện, kiểm thử) và việc tạo ra sản phẩm AI cần có sự hợp tác giữa nhiều người với chuyên môn khác nhau.",
    sourceDocumentId: "DOC-2026-QD2422",
    sourcePage: 43,
    isCore: true,
    isExtension: false,
    isActive: true
  },
  {
    id: "AI-2422-12-D2-MR1",
    code: "12.D2.MR1",
    grade: "12",
    component: "NLd",
    componentName: "Thiết kế hệ thống AI",
    topic: "D2",
    topicName: "Cấu trúc và tương tác, cải tiến hệ thống",
    requirementType: "MỞ_RỘNG",
    requirementText: "Phân tích được nguyên nhân của các vấn đề phát sinh trong hệ thống AI và lựa chọn được cách giải quyết phù hợp để hệ thống hoạt động ổn định và hiệu quả hơn.",
    sourceDocumentId: "DOC-2026-QD2422",
    sourcePage: 44,
    isCore: false,
    isExtension: true,
    isActive: true
  },
  {
    id: "AI-2422-12-D2-MR2",
    code: "12.D2.MR2",
    grade: "12",
    component: "NLd",
    componentName: "Thiết kế hệ thống AI",
    topic: "D2",
    topicName: "Cấu trúc và tương tác, cải tiến hệ thống",
    requirementType: "MỞ_RỘNG",
    requirementText: "Trình bày được khả năng và cấu trúc cơ bản của một hệ thống tác nhân AI (AI agent).",
    sourceDocumentId: "DOC-2026-QD2422",
    sourcePage: 44,
    isCore: false,
    isExtension: true,
    isActive: true
  },
  {
    id: "AI-2422-12-D2-MR3",
    code: "12.D2.MR3",
    grade: "12",
    component: "NLd",
    componentName: "Thiết kế hệ thống AI",
    topic: "D2",
    topicName: "Cấu trúc và tương tác, cải tiến hệ thống",
    requirementType: "CHUYÊN_ĐỀ",
    requirementText: "Xây dựng và kiểm thử được hệ thống tác nhân AI đơn giản phục vụ một nhiệm vụ học tập hoặc cộng đồng.",
    sourceDocumentId: "DOC-2026-QD2422",
    sourcePage: 44,
    isCore: false,
    isExtension: true,
    isActive: true
  }
];

export const parseAiCode2422 = (rawCode: string) => {
  if (!rawCode) return undefined;
  const clean = String(rawCode).trim().replace(/\s+/g, " ");

  // Matches various formats:
  // - NLb-12.B2.1, [NLb]-12.B2.1, NLB - 12.B2.1, NL-12.B2.1, NLD-12.B2.1
  // - 12.B2.1, 12.B2.01, 12.B2.2, 12.C4.MR1
  const match = clean.match(
    /^(?:\[?(NL[abcd]?|NLD|NLA|NLB|NLC)\]?\s*[-:\u2013\u2014]?\s*)?((?:10|11|12)\.([A-D]\d*)\.(MR\d+|\d+))$/i
  );
  if (!match) return undefined;

  const [, , , rawTopic, rawIndicator] = match;
  const topicLetter = rawTopic.slice(0, 1).toUpperCase();
  const correctComp = getComponentByTopicLetter(topicLetter);

  const topicNum = rawTopic.slice(1) || "1";
  const topic = `${topicLetter}${topicNum}`;

  const indicator = /^MR\d+$/i.test(rawIndicator)
    ? rawIndicator.toUpperCase()
    : String(Number(rawIndicator) || 1);

  const grade = match[2].slice(0, 2) as "10" | "11" | "12";
  const code = `${grade}.${topic}.${indicator}`;

  return {
    component: correctComp,
    code,
    grade,
    topic
  };
};

/**
 * Converts legacy leading-zero codes (for example 11.C2.01) to QD 2422
 * and auto-corrects minor formatting issues (like 12.B2.2 -> 12.B2.1).
 */
export const normalizeAiCode2422 = (rawCode: string): string | undefined => {
  const parsed = parseAiCode2422(rawCode);
  if (!parsed) return undefined;

  // 1. Exact match in DB
  const exact = AI_REQUIREMENTS_2422_DB.find(
    i => i.code.toLowerCase() === parsed.code.toLowerCase() && i.isActive
  );
  if (exact) return exact.code;

  // 2. Fallback to topic base if indicator index is slightly off (e.g. 12.B2.2 -> 12.B2.1)
  const topicMatch = AI_REQUIREMENTS_2422_DB.find(
    i => i.grade === parsed.grade && i.topic.toLowerCase() === parsed.topic.toLowerCase() && i.isActive
  );
  if (topicMatch) return topicMatch.code;

  // 3. Fallback to component base
  const compMatch = AI_REQUIREMENTS_2422_DB.find(
    i => i.grade === parsed.grade && i.component === parsed.component && i.isActive
  );
  if (compMatch) return compMatch.code;

  return parsed.code;
};

export const formatAiCode2422 = (rawCode: string): string | undefined => {
  const normalized = normalizeAiCode2422(rawCode);
  if (!normalized) return undefined;

  const item = AI_REQUIREMENTS_2422_DB.find(i => i.code === normalized && i.isActive);
  if (item) return `${item.component}-${item.code}`;

  const parsed = parseAiCode2422(rawCode);
  if (parsed) return `${parsed.component}-${parsed.code}`;
  return undefined;
};

export const normalizeAiCodesInText2422 = (value: unknown): string => {
  let text = String(value || "");

  // 1. Clean up duplicate repeats caused by previous mangling like "thử nghiệm và cải tiến hệ thống AI, thử nghiệm và cải tiến hệ thống AI"
  text = text.replace(/(?:,\s*thử nghiệm và cải tiến hệ thống AI)+/gi, "");
  text = text.replace(/(?:,\s*an toàn, pháp luật và trách nhiệm)+/gi, "");
  text = text.replace(/(?:,\s*pháp luật và trách nhiệm)+/gi, "");
  text = text.replace(/(?:,\s*các kĩ thuật và ứng dụng AI)+/gi, "");
  text = text.replace(/(?:,\s*các kỹ thuật và ứng dụng AI)+/gi, "");

  // 2. Fix structured pattern: "Thành phần NL AI: NLD; Khối lớp: 12; Chủ đề: B2; Mã chỉ báo NL AI: NL-12.B2.2"
  text = text.replace(
    /(?:Thành phần(?:\s+NL)?\s+AI:\s*)?(NLa|NLb|NLc|NLd|NLA|NLB|NLC|NLD)(?:\s*-\s*[^;\n]+)?;\s*(Khối lớp:\s*(?:10|11|12));\s*(Chủ đề:\s*([A-D]\d*));\s*(Mã chỉ báo NL AI:\s*[^;\n\r]+)/gi,
    (_full, _comp, gradePart, topicPart, rawTopic, codePart) => {
      const topicLetter = String(rawTopic || "A").slice(0, 1).toUpperCase();
      const compCode = getComponentByTopicLetter(topicLetter);
      const compName = AI_COMPONENTS_MAP[compCode]?.name || "Năng lực AI";

      const rawCode = codePart.replace(/^Mã chỉ báo NL AI:\s*/i, "").trim();
      const cleanCode = formatAiCode2422(rawCode) || normalizeAiCode2422(rawCode) || rawCode;
      return `Thành phần NL AI: ${compCode} - ${compName}; ${gradePart}; ${topicPart}; Mã chỉ báo NL AI: ${cleanCode}`;
    }
  );

  // 3. Fix standalone or prefixed AI codes (e.g. NL-12.B2.2, NLD-12.B2.1, 10.A1.01)
  text = text.replace(
    /\b(?:\[?(NL[abcd]?|NLD|NLA|NLB|NLC)\]?\s*[-:\u2013\u2014]?\s*)?(10|11|12)\.([A-D]\d*)\.(MR\d+|\d+)\b/gi,
    (rawCode) => {
      const formatted = formatAiCode2422(rawCode);
      return formatted || normalizeAiCode2422(rawCode) || rawCode;
    }
  );

  return text;
};

export const isAiCodeValid2422 = (code: string, grade?: string): boolean => {
  if (!code) return false;
  const cleanCode = code.trim().replace(/\s+/g, "");
  const normalizedCode = normalizeAiCode2422(cleanCode);
  if (!normalizedCode) return false;

  const item = AI_REQUIREMENTS_2422_DB.find(i => i.code.toLowerCase() === normalizedCode.toLowerCase());
  if (!item || !item.isActive) return false;

  const canonicalBare = item.code.toLowerCase();
  const canonicalFull = `${item.component}-${item.code}`.toLowerCase();
  if (![canonicalBare, canonicalFull].includes(cleanCode.toLowerCase())) return false;
  if (grade && item.grade !== grade) return false;
  return true;
};

export const getAiRequirementByCode = (code: string): AiRequirementItem | undefined => {
  const normalizedCode = normalizeAiCode2422(code);
  if (!normalizedCode) return undefined;
  return AI_REQUIREMENTS_2422_DB.find(i => i.code.toLowerCase() === normalizedCode.toLowerCase());
};

export const getAiRequirementsByGrade = (grade: "10" | "11" | "12"): AiRequirementItem[] => {
  return AI_REQUIREMENTS_2422_DB.filter(i => i.grade === grade && i.isActive);
};
