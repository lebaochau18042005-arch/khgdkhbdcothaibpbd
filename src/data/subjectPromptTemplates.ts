/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Thư viện Câu Lệnh Prompt Sư Phạm Chuẩn Hóa Tích Hợp NLS & NL AI
 * Áp dụng cho cấp THPT (Lớp 10, 11, 12) - Năm học 2026 - 2027
 * Tuân thủ:
 * - Khung Năng lực số: TT 02/2025/TT-BGDĐT & CV 3456/BGDĐT-GDPT (Mức NC)
 * - Khung Năng lực AI: QĐ 2422/QĐ-BGDĐT ngày 18/8/2026 & CV 5588/BGDĐT-GDPT
 * - Cấu trúc Kế hoạch bài dạy: CV 5512/BGDĐT-GDTrH
 */

export interface SubjectPromptScaffold {
  id: string;
  subject: string;
  category: "stem" | "humanities" | "languages" | "applied";
  applicableGrades: ("10" | "11" | "12")[];
  targetAudience: "student" | "teacher" | "both";
  skillDomain: string;
  title: string;
  description: string;
  nlsCode: string;
  nlsIndicator: string;
  aiCode: string;
  aiComponent: "NLa" | "NLb" | "NLc" | "NLd";
  aiRequirement: string;
  promptTemplate: string;
  studentTask: string;
  expectedProduct: string;
  evidence: string;
  verificationMethod: string;
  rubricCriteria: string[];
  offlineAlternative: string;
}

export const SUBJECT_PROMPT_TEMPLATES: SubjectPromptScaffold[] = [
  // ==========================================================================================
  // TOÁN HỌC & TIN HỌC
  // ==========================================================================================
  {
    id: "PROMPT-TOAN-01",
    subject: "Toán học",
    category: "stem",
    applicableGrades: ["10", "11", "12"],
    targetAudience: "student",
    skillDomain: "Mô hình hóa toán học & Đối chiếu nghiệm AI",
    title: "Phản biện và kiểm chứng lời giải bài toán thực tế của AI",
    description: "Học sinh yêu cầu AI giải một bài toán thực tế (tối ưu hóa, xác suất thống kê hoặc hình học không gian), sau đó tìm lỗi logic, kiểm chứng điều kiện nghiệm và đối chiếu công thức.",
    nlsCode: "1.2.NCa",
    nlsIndicator: "Đánh giá tính chính xác, tính đầy đủ và độ tin cậy của thông tin toán học do công cụ số cung cấp.",
    aiCode: "10.A1.1",
    aiComponent: "NLa",
    aiRequirement: "Nhận biết vai trò chủ đạo của con người trong việc kiểm soát, đánh giá và xác thực kết quả do AI tính toán.",
    promptTemplate: `Bạn là trợ lý toán học. Hãy giải chi tiết bài toán sau theo chương trình Toán {{grade}} (SGK Kết nối tri thức):
Đề bài: "{{task}}"
Yêu cầu:
1. Nêu rõ các giả thiết, điều kiện xác định và mô hình hóa bài toán.
2. Trình bày từng bước lập luận toán học có kèm công thức LaTeX.
3. Đưa ra kết luận thực tế và nhận xét về ý nghĩa của nghiệm.`,
    studentTask: "Nhập đề bài vào mô hình AI; sao chép lời giải và đối chiếu từng bước biến đổi với SGK; phát hiện ít nhất 01 điểm AI lập luận thiếu chặt chẽ hoặc bỏ quên điều kiện thực tế.",
    expectedProduct: "Bản báo cáo phản biện lời giải AI (nêu rõ bước AI làm đúng, bước làm sai/thiếu và lời giải chuẩn của nhóm).",
    evidence: "Phiếu học tập đối chiếu công thức, kèm chú thích các lỗi hallucination toán học của AI.",
    verificationMethod: "Thử lại nghiệm vào bài toán ban đầu, sử dụng phần mềm GeoGebra hoặc máy tính cầm tay để kiểm chứng tính đúng đắn.",
    rubricCriteria: [
      "Xác định chính xác các điều kiện toán học bị AI bỏ sót",
      "Viết câu lệnh prompt rõ ràng, có ràng buộc chặt chẽ",
      "Trình bày lời giải chính xác hóa hoàn chỉnh bằng tiếng Việt chuẩn mực"
    ],
    offlineAlternative: "Giáo viên in sẵn phiếu học tập chứa lời giải có chủ ý gài lỗi sai; học sinh làm việc nhóm dùng SGK để tìm lỗi và sửa."
  },
  {
    id: "PROMPT-TIN-01",
    subject: "Tin học",
    category: "stem",
    applicableGrades: ["10", "11", "12"],
    targetAudience: "student",
    skillDomain: "Lập trình thuật toán & Đạo đức dữ liệu",
    title: "Tối ưu hóa mã nguồn Python và kiểm tra lỗ hổng bảo mật cùng AI",
    description: "Học sinh sử dụng AI để gợi ý cấu trúc thuật toán, viết test-case kiểm thử và phân tích bản quyền mã nguồn.",
    nlsCode: "3.2.NCa",
    nlsIndicator: "Ứng dụng ngôn ngữ lập trình để thiết kế và tự động hóa giải pháp giải quyết vấn đề.",
    aiCode: "10.B1.1",
    aiComponent: "NLb",
    aiRequirement: "Nhận diện trách nhiệm đạo đức, bản quyền và tính minh bạch khi sử dụng mã nguồn do AI gợi ý.",
    promptTemplate: `Hãy phân tích đoạn mã Python sau dùng trong bài học Tin học lớp {{grade}}:
\`\`\`python
{{task}}
\`\`\`
Yêu cầu:
1. Đánh giá độ phức tạp thuật toán theo thời gian O(...) và không gian bộ nhớ.
2. Đề xuất 03 bộ test-case đặc biệt (biên, rỗng, số âm) để kiểm thử.
3. Cảnh báo các rủi ro bảo mật hoặc lỗi runtime tiềm ẩn.
4. Gợi ý phiên bản mã nguồn đã tối ưu kèm chú thích tiếng Việt.`,
    studentTask: "Chạy mã nguồn gốc và bộ test-case do AI sinh ra trên môi trường IDLE/VSCode; ghi nhận kết quả và chỉnh sửa tối ưu.",
    expectedProduct: "Tệp mã nguồn \`.py\` đã hoàn thiện, có bình luận giải thích thuật toán và bảng kết quả chạy test-case.",
    evidence: "Ảnh chụp màn hình terminal chạy thành công và báo cáo so sánh độ phức tạp.",
    verificationMethod: "Thực thi trực tiếp mã trên trình thông dịch Python với dữ liệu kiểm thử thực tế.",
    rubricCriteria: [
      "Chương trình chạy không lỗi cú pháp và đáp ứng đúng yêu cầu thuật toán",
      "Bộ test-case kiểm thử bao quát được các trường hợp biên",
      "Có ghi nguồn minh bạch việc sử dụng công cụ AI hỗ trợ theo đúng quy định"
    ],
    offlineAlternative: "Học sinh thực hiện chạy từng dòng mã trên giấy (dry-run/trace table) với bộ dữ liệu mẫu do giáo viên phát."
  },

  // ==========================================================================================
  // KHOA HỌC TỰ NHIÊN: VẬT LÍ - HÓA HỌC - SINH HỌC
  // ==========================================================================================
  {
    id: "PROMPT-VATLY-01",
    subject: "Vật lí",
    category: "stem",
    applicableGrades: ["10", "11", "12"],
    targetAudience: "student",
    skillDomain: "Thí nghiệm ảo & Phân tích hiện tượng vật lí",
    title: "Xây dựng kịch bản mô phỏng thí nghiệm và kiểm chứng định luật Vật lí",
    description: "Học sinh viết câu lệnh prompt yêu cầu AI mô tả các thông số cho thí nghiệm ảo (PhET), dự đoán đồ thị quan hệ và kiểm chứng tính phù hợp định luật.",
    nlsCode: "5.2.NCa",
    nlsIndicator: "Sử dụng công cụ số và phần mềm mô phỏng để giải quyết bài toán khoa học thực nghiệm.",
    aiCode: "10.C3.2",
    aiComponent: "NLc",
    aiRequirement: "Ứng dụng công cụ AI để tra cứu thông số và hỗ trợ mô hình hóa hiện tượng tự nhiên.",
    promptTemplate: `Bạn là trợ lý thí nghiệm Vật lí THPT. Hãy thiết kế kịch bản thực hành ảo cho bài: "{{task}}" (Vật lí lớp {{grade}}):
1. Liệt kê các biến số cần đo: Biến độc lập, biến phụ thuộc, biến cần giữ cố định.
2. Lập bảng giả định 5 điểm đo số liệu tuân theo định luật vật lí tương ứng.
3. Mô tả hình dạng đồ thị biểu diễn mối quan hệ giữa hai đại lượng và công thức suy ra hệ số góc.
4. Đưa ra 2 câu hỏi bẫy thường gặp về sai số đo lường trong thực tế.`,
    studentTask: "Nhập các thông số dự đoán từ AI vào phần mềm thí nghiệm ảo PhET/GeoGebra; vẽ đồ thị thực tế và đối chiếu với đồ thị lý thuyết của AI.",
    expectedProduct: "Bảng số liệu đo lường kèm đồ thị thực nghiệm và phần giải thích ý nghĩa vật lí của hệ số góc.",
    evidence: "File đồ thị hoặc phiếu báo cáo thực hành có nhận xét về sai số giữa mô hình AI và thực nghiệm.",
    verificationMethod: "Đối chiếu công thức định luật trong SGK Vật lí Kết nối tri thức và kiểm tra thứ nguyên của các đại lượng.",
    rubricCriteria: [
      "Nhận diện đúng bản chất hiện tượng và các biến số vật lí",
      "Phân tích đúng nguyên nhân gây ra sai số giữa mô hình AI và thực nghiệm",
      "Tuân thủ quy tắc an toàn trong phòng thí nghiệm (nếu có phần cứng)"
    ],
    offlineAlternative: "Sử dụng bộ dụng cụ thí nghiệm cơ - nhiệt - điện thực tế trong phòng bộ môn để đo đạc và ghi chép số liệu."
  },
  {
    id: "PROMPT-HOAHOC-01",
    subject: "Hóa học",
    category: "stem",
    applicableGrades: ["10", "11", "12"],
    targetAudience: "student",
    skillDomain: "Cơ chế phản ứng & Mô hình hóa phân tử",
    title: "Kiểm chứng phương trình hóa học và cơ chế phản ứng hữu cơ/vô cơ",
    description: "Học sinh dùng AI để tìm hiểu cơ chế phản ứng, sau đó đối chiếu quy tắc an toàn và kiểm tra bảo toàn nguyên tố/electron.",
    nlsCode: "1.1.NCa",
    nlsIndicator: "Sử dụng các chiến lược tìm kiếm nâng cao để tra cứu hằng số và cơ chế phản ứng hóa học chuyên sâu.",
    aiCode: "10.C3.2",
    aiComponent: "NLc",
    aiRequirement: "Khai thác công cụ AI để truy xuất cơ chế phản ứng và thông tin hóa chất phục vụ học tập.",
    promptTemplate: `Phân tích phản ứng hóa học sau trong chương trình Hóa học {{grade}}:
"{{task}}"
Yêu cầu:
1. Viết phương trình hóa học đầy đủ kèm trạng thái chất và điều kiện phản ứng.
2. Giải thích cơ chế phản ứng (sự chuyển dịch electron, liên kết bị bẻ gãy và liên kết mới tạo thành).
3. Đánh giá tính an toàn hóa chất theo bảng chỉ dẫn an toàn (MSDS) và biện pháp xử lý chất thải bảo vệ môi trường.`,
    studentTask: "Đối chiếu phương trình của AI với Bảng tính tan, Dãy thế điện cực chuẩn và SGK; phát hiện nếu AI cân bằng sai electron.",
    expectedProduct: "Bản đồ tư duy cơ chế phản ứng và bảng tóm tắt biện pháp an toàn phòng thí nghiệm xanh.",
    evidence: "Phiếu cân bằng phương trình ion thu gọn và ghi chép kiểm chứng thực tế.",
    verificationMethod: "Tra cứu Sổ tay hóa học chuẩn và Bảng tuần hoàn các nguyên tố hóa học của NXB Giáo dục.",
    rubricCriteria: [
      "Phương trình hóa học cân bằng chính xác điện tích và nguyên tố",
      "Nhận diện đúng điều kiện và hiện tượng quan sát được của phản ứng",
      "Đề xuất giải pháp xử lý chất thải hóa học phù hợp phát triển bền vững"
    ],
    offlineAlternative: "Học sinh sử dụng bộ mô hình phân tử que-nối bằng nhựa để lắp ráp cấu trúc không gian của chất."
  },
  {
    id: "PROMPT-SINHHOC-01",
    subject: "Sinh học",
    category: "stem",
    applicableGrades: ["10", "11", "12"],
    targetAudience: "student",
    skillDomain: "Mã di truyền, Sinh thái & Đạo đức sinh học",
    title: "Phân tích sơ đồ chuyển hóa sinh học và đạo đức công nghệ sinh học",
    description: "Học sinh dùng AI giải mã trình tự sinh học hoặc chu trình sinh thái, sau đó phản biện các vấn đề đạo đức sinh học.",
    nlsCode: "1.2.NCa",
    nlsIndicator: "Đánh giá tính chính xác của các sơ đồ sinh học và dữ liệu gene do AI cung cấp.",
    aiCode: "10.B1.1",
    aiComponent: "NLb",
    aiRequirement: "Phân tích tác động xã hội, nhân văn và đạo đức của các giải pháp sinh học có ứng dụng AI.",
    promptTemplate: `Hãy đóng vai là chuyên gia sinh học di truyền. Phân tích chủ đề sau theo chương trình Sinh học {{grade}}:
"{{task}}"
Yêu cầu:
1. Mô tả sơ đồ diễn biến quá trình sinh học ở cấp độ phân tử/tế bào.
2. Nêu ứng dụng thực tế trong nông nghiệp hoặc y học hiện đại.
3. Phân tích 02 vấn đề đạo đức sinh học (Bioethics) đặt ra khi ứng dụng công nghệ chỉnh sửa gene hoặc AI vào sinh vật.`,
    studentTask: "Lập bảng đối chiếu giữa lý thuyết SGK với câu trả lời của AI; thảo luận nhóm về khía cạnh đạo đức sinh học.",
    expectedProduct: "Bài thuyết trình ngắn (3 phút) hoặc poster số về ứng dụng và giới hạn đạo đức sinh học.",
    evidence: "Poster số (Canva/Padlet) hoặc biên bản thảo luận nhóm có chữ ký của các thành viên.",
    verificationMethod: "Đối chiếu tài liệu chuẩn của Viện Hàn lâm Khoa học hoặc SGK Sinh học Kết nối tri thức.",
    rubricCriteria: [
      "Trình bày chính xác thuật ngữ sinh học phân tử",
      "Lập luận thuyết phục về các nguyên tắc đạo đức sinh học",
      "Trình bày sản phẩm trực quan, mạch lạc"
    ],
    offlineAlternative: "Học sinh vẽ sơ đồ tư duy trên giấy khổ A3 và sử dụng thẻ bài in sẵn để ghép nối chu trình sinh học."
  },

  // ==========================================================================================
  // KHOA HỌC XÃ HỘI: NGỮ VĂN - LỊCH SỬ - ĐỊA LÍ - GDKT&PL
  // ==========================================================================================
  {
    id: "PROMPT-NGUVAN-01",
    subject: "Ngữ văn",
    category: "humanities",
    applicableGrades: ["10", "11", "12"],
    targetAudience: "student",
    skillDomain: "Đọc hiểu văn học (READ_LITERARY)",
    title: "Đối chiếu cảm thụ văn học con người và phản biện cảm thụ của AI",
    description: "Học sinh yêu cầu AI phân tích một chi tiết/hình tượng nghệ thuật, sau đó chỉ ra giới hạn vô cảm của AI và nêu bật cảm xúc nhân văn của con người.",
    nlsCode: "1.2.NCa",
    nlsIndicator: "Đánh giá tính chính xác, tính đầy đủ và độ tin cậy của thông tin văn học do công cụ số cung cấp.",
    aiCode: "10.A1.1",
    aiComponent: "NLa",
    aiRequirement: "Khẳng định chiều sâu cảm xúc, tư duy thẩm mỹ và tính độc đáo duy nhất của con người trước sản phẩm do AI sinh ra.",
    promptTemplate: `Bạn là trợ lý văn học. Hãy phân tích hình tượng nghệ thuật sau trong văn bản "{{task}}" (Ngữ văn {{grade}} - SGK Kết nối tri thức):
Yêu cầu:
1. Nêu vị trí, bối cảnh xuất hiện của chi tiết/hình tượng trong tác phẩm.
2. Phân tích nghệ thuật xây dựng hình tượng (ngôn từ, nhịp điệu, biện pháp tu từ).
3. Rút ra thông điệp tư tưởng và giá trị nhân đạo mà tác giả gửi gắm.`,
    studentTask: "Đọc kỹ phân tích của AI; khoanh vùng các câu văn khuôn mẫu, sáo rỗng; viết một đoạn văn 200 chữ thể hiện cảm xúc chân thực và góc nhìn sáng tạo của bản thân.",
    expectedProduct: "Đoạn văn nghị luận văn học hoàn chỉnh mang dấu ấn cá nhân, có phần phản biện lại điểm thiếu sót của AI.",
    evidence: "Bản thảo bài viết có đánh dấu đối chiếu giữa ý tưởng của AI và ý tưởng độc lập của học sinh.",
    verificationMethod: "Dẫn chứng trực tiếp từ nguyên văn tác phẩm văn học trong SGK Ngữ văn Kết nối tri thức.",
    rubricCriteria: [
      "Không sao chép nguyên văn câu chữ của AI; giữ vững phong cách cá nhân",
      "Lập luận chặt chẽ, giàu cảm xúc và bám sát ngữ cảnh tác phẩm",
      "Chỉ ra chính xác các nhận định hời hợt hoặc suy diễn không căn cứ của AI"
    ],
    offlineAlternative: "Học sinh đọc văn bản trong SGK, gạch chân từ ngữ then chốt và ghi chú nhật ký đọc sách (Reading journal) vào vở."
  },
  {
    id: "PROMPT-NGUVAN-02",
    subject: "Ngữ văn",
    category: "humanities",
    applicableGrades: ["10", "11", "12"],
    targetAudience: "student",
    skillDomain: "Đọc hiểu nghị luận (READ_ARGUMENTATIVE)",
    title: "Phân tích hệ thống luận điểm và phản biện ngụy biện logic cùng AI",
    description: "Học sinh sử dụng AI để sơ đồ hóa luận đề - luận điểm - lý lẽ - bằng chứng, sau đó kiểm chứng số liệu thực tế và phát hiện ngụy biện.",
    nlsCode: "1.2.NCa",
    nlsIndicator: "Đánh giá tính xác thực của thông tin và phát hiện các lập luận ngụy biện trong môi trường số.",
    aiCode: "10.A1.1",
    aiComponent: "NLa",
    aiRequirement: "Nhận biết vai trò chủ đạo của con người trong việc thẩm định tính đúng đắn của lập luận do AI đưa ra.",
    promptTemplate: `Hãy phân tích văn bản nghị luận sau theo chương trình Ngữ văn {{grade}}:
"{{task}}"
Yêu cầu:
1. Xác định luận đề chính và vẽ sơ đồ phân nhánh hệ thống luận điểm.
2. Với mỗi luận điểm, trích xuất: Lý lẽ (warrant) và Bằng chứng (evidence).
3. Đánh giá tính thuyết phục của dẫn chứng thực tế.
4. Phát hiện xem có điểm nào mắc lỗi suy luận tam đoạn luận hoặc ngụy biện hay không.`,
    studentTask: "Nhập văn bản vào AI; kiểm tra chéo các dẫn chứng thực tế bằng nguồn báo chí chính thống; viết đoạn văn phản biện nếu phát hiện ngụy biện.",
    expectedProduct: "Bảng phân tích Luận điểm - Lý lẽ - Dẫn chứng kèm phần phản biện ngụy biện logic.",
    evidence: "Phiếu học tập đối chiếu các liên kết logic và số liệu kiểm chứng.",
    verificationMethod: "Đối chiếu văn bản gốc và tra cứu số liệu tại Niên giám thống kê hoặc văn kiện chính thống.",
    rubricCriteria: [
      "Xác định đúng luận đề và logic triển khai bài viết",
      "Kiểm chứng tính chân thực của 100% dẫn chứng thực tế",
      "Chỉ ra chính xác các lỗ hổng lập luận nếu có"
    ],
    offlineAlternative: "Học sinh dùng bút màu gạch chân luận điểm (đỏ), lý lẽ (xanh), dẫn chứng (vàng) trực tiếp trên bản in văn bản."
  },
  {
    id: "PROMPT-NGUVAN-03",
    subject: "Ngữ văn",
    category: "humanities",
    applicableGrades: ["10", "11", "12"],
    targetAudience: "student",
    skillDomain: "Văn bản thông tin (READ_INFORMATIONAL)",
    title: "Kiểm chứng thông tin đa phương thức và phát hiện tin giả (Fake News)",
    description: "Học sinh khai thác văn bản thông tin đa phương thức, phân tích hiệu quả kênh hình/kênh chữ và kiểm định tính khách quan.",
    nlsCode: "1.1.NCb",
    nlsIndicator: "Thu thập, tổ chức và so sánh thông tin từ nhiều nguồn số đáng tin cậy phục vụ học tập.",
    aiCode: "10.B1.1",
    aiComponent: "NLb",
    aiRequirement: "Nhận diện nguy cơ tin giả, thông tin sai lệch và ảo giác khi tiếp nhận thông tin từ hệ thống AI.",
    promptTemplate: `Bạn là chuyên gia thẩm định truyền thông. Hãy phân tích văn bản thông tin sau:
"{{task}}"
Yêu cầu:
1. Tóm tắt thông điệp cốt lõi và mục đích của người viết.
2. Phân tích hiệu quả biểu đạt của các phương tiện phi ngôn ngữ (số liệu, sơ đồ, hình ảnh).
3. Lập danh mục 3 điểm cần kiểm chứng chéo (Fact-check) từ nguồn độc lập.`,
    studentTask: "Tra cứu 3 nguồn kiểm chứng độc lập trên Internet; lập ma trận so sánh thông tin; đánh giá độ tin cậy của bài báo số.",
    expectedProduct: "Bảng kiểm định thông tin đa nguồn (Fact-checking matrix có đường link trích dẫn xác thực).",
    evidence: "Ảnh chụp màn hình các nguồn đối chiếu và nhật ký thẩm định thông tin.",
    verificationMethod: "Tra cứu tên miền cổng thông tin chính phủ (.gov.vn), tổ chức học thuật (.edu.vn) và báo chí chính thống.",
    rubricCriteria: [
      "Trích dẫn tối thiểu 2 nguồn thẩm định độc lập đáng tin cậy",
      "Phân tích đúng tác dụng của phương tiện phi ngôn ngữ",
      "Nhận định khách quan, không định kiến"
    ],
    offlineAlternative: "Giáo viên phát 2 bản tin cùng đưa tin về một sự việc với 2 góc nhìn khác nhau để học sinh so sánh trên giấy."
  },
  {
    id: "PROMPT-NGUVAN-04",
    subject: "Ngữ văn",
    category: "humanities",
    applicableGrades: ["10", "11", "12"],
    targetAudience: "student",
    skillDomain: "Dạy học viết (WRITE)",
    title: "Lập dàn ý phân hóa, phản biện người đọc khó tính và nhật ký chỉnh sửa",
    description: "Học sinh giữ quyền tác giả làm chủ ý tưởng bài văn, sử dụng AI làm 'người đọc khó tính' (Devil's advocate) để tìm điểm yếu lập luận.",
    nlsCode: "3.1.NCa",
    nlsIndicator: "Sáng tạo nội dung bài viết và thể hiện tư duy độc lập trên nền tảng kỹ thuật số.",
    aiCode: "10.A1.1",
    aiComponent: "NLa",
    aiRequirement: "Khẳng định vai trò chủ thể sáng tạo của con người, không để AI viết thay bài làm của mình.",
    promptTemplate: `Hãy đóng vai là "người đọc phản biện khó tính". Tôi đang viết bài văn nghị luận theo đề bài:
"{{task}}"
Đây là dàn ý sơ bộ của tôi:
[Học sinh điền dàn ý cá nhân vào đây]
Hãy:
1. Chỉ ra 2 điểm mà lập luận của tôi chưa thuyết phục hoặc bằng chứng còn yếu.
2. Đặt ra 02 câu hỏi vặn lại (counter-arguments) mà tôi cần trả lời để bài viết sâu sắc hơn.
3. Tuyệt đối KHÔNG viết thay bài văn cho tôi.`,
    studentTask: "Tự lập dàn ý cá nhân; nhập dàn ý vào AI để nhận phản biện; tự viết bài văn và ghi chép nhật ký chỉnh sửa (Revision log).",
    expectedProduct: "Bài văn hoàn chỉnh do chính học sinh viết kèm bảng Nhật ký chỉnh sửa (nêu rõ phản hồi AI nào được tiếp thu và lý do).",
    evidence: "Bản thảo bài viết có bút tích chỉnh sửa và đường link file nhật ký revision log.",
    verificationMethod: "Kiểm tra tiến trình bản nháp, đối chiếu phong cách ngôn ngữ cá nhân của học sinh.",
    rubricCriteria: [
      "100% nội dung bài viết là sản phẩm tư duy của học sinh, không đạo văn AI",
      "Giải quyết thỏa đáng các luận điểm phản biện",
      "Diễn đạt trong sáng, giàu sức biểu cảm"
    ],
    offlineAlternative: "Học sinh đổi bài cho bạn cùng bàn để đóng vai người phản biện ghi chú trực tiếp vào lề bài làm."
  },
  {
    id: "PROMPT-NGUVAN-05",
    subject: "Ngữ văn",
    category: "humanities",
    applicableGrades: ["10", "11", "12"],
    targetAudience: "student",
    skillDomain: "Nói và nghe (SPEAK_LISTEN)",
    title: "Xây dựng kịch bản tranh biện và thiết kế bài thuyết trình trực quan",
    description: "Học sinh chuẩn bị bài nói/tranh biện, khai thác AI để giả lập các câu hỏi chất vấn từ người nghe và thiết kế slide đa phương tiện.",
    nlsCode: "2.1.NCa",
    nlsIndicator: "Tương tác và giao tiếp hiệu quả thông qua các phương tiện và nền tảng kỹ thuật số.",
    aiCode: "10.A1.1",
    aiComponent: "NLa",
    aiRequirement: "Làm chủ kỹ năng thuyết phục, ứng biến và cảm xúc con người trong giao tiếp trực tiếp.",
    promptTemplate: `Tôi chuẩn bị thuyết trình về chủ đề Ngữ văn {{grade}}:
"{{task}}"
Hãy giúp tôi:
1. Đề xuất 3 câu hỏi chất vấn bất ngờ mà khán giả có thể hỏi tôi.
2. Gợi ý 3 lưu ý về ngôn ngữ cơ thể, ngữ điệu giọng nói khi trình bày chủ đề này.
3. Gợi ý cấu trúc 4 slide trực quan (không quá 5 dòng chữ mỗi slide, ưu tiên hình ảnh/từ khóa).`,
    studentTask: "Thiết kế slide trên Canva/PowerPoint; tập dượt thuyết trình trả lời các câu hỏi giả định; thực hiện bài nói trước lớp.",
    expectedProduct: "Bộ slide trình chiếu trực quan và phần trình bày thuyết trình trực tiếp trước tập thể lớp.",
    evidence: "Tệp trình chiếu .pptx hoặc video ghi hình buổi thuyết trình kèm phiếu nhận xét của bạn học.",
    verificationMethod: "Đánh giá phong thái nói trực tiếp, sự mạch lạc và khả năng phản ứng tương tác lớp học.",
    rubricCriteria: [
      "Nói tự nhiên, không đọc nguyên văn slide hay giấy",
      "Lập luận thuyết phục và trả lời gãy gọn câu hỏi chất vấn",
      "Slide trực quan, thẩm mỹ và cô đọng"
    ],
    offlineAlternative: "Học sinh sử dụng thẻ ghi chú (flashcard) và bảng phụ để thuyết trình nhóm."
  },
  {
    id: "PROMPT-NGUVAN-06",
    subject: "Ngữ văn",
    category: "humanities",
    applicableGrades: ["10", "11", "12"],
    targetAudience: "student",
    skillDomain: "Thực hành tiếng Việt (VIETNAMESE)",
    title: "Phân tích ngữ liệu tiếng Việt và phản biện gợi ý sửa câu của AI",
    description: "Học sinh phân tích biện pháp tu từ hoặc lỗi ngữ pháp, kiểm chứng xem đề xuất sửa câu của AI có giữ gìn sự trong sáng của tiếng Việt hay không.",
    nlsCode: "3.1.NCa",
    nlsIndicator: "Sử dụng công cụ biên tập số để rà soát, chuẩn hóa chính tả và ngữ pháp tiếng Việt.",
    aiCode: "10.C3.2",
    aiComponent: "NLc",
    aiRequirement: "Khai thác công cụ AI xử lý ngôn ngữ tự nhiên để nhận diện lỗi cú pháp và nâng cao năng lực tiếng mẹ đẻ.",
    promptTemplate: `Phân tích đoạn ngữ liệu tiếng Việt sau (bài học Ngữ văn {{grade}}):
"{{task}}"
Yêu cầu:
1. Chỉ ra biện pháp tu từ/hiện tượng ngữ pháp nổi bật và nêu hiệu quả nghệ thuật.
2. Nhận diện 01 câu có thể viết mạch lạc hơn và đưa ra 02 phương án sửa chữa.
3. Giải thích sắc thái nghĩa của từng phương án theo chuẩn Từ điển tiếng Việt.`,
    studentTask: "Đối chiếu các phương án sửa chữa của AI với quy tắc ngữ pháp SGK; thảo luận xem cách diễn đạt nào giàu cảm xúc và tự nhiên nhất.",
    expectedProduct: "Phiếu học tập phân tích tiếng Việt có phần đối chiếu các phương án ngữ nghĩa.",
    evidence: "Phiếu học tập hoàn thiện kèm dẫn chứng số trang Từ điển tiếng Việt.",
    verificationMethod: "Tra cứu Từ điển tiếng Việt của Viện Ngôn ngữ học.",
    rubricCriteria: [
      "Phân tích đúng bản chất hiện tượng ngữ pháp/tu từ",
      "Lựa chọn từ ngữ chuẩn xác, giữ vững sự trong sáng của tiếng Việt",
      "Lý giải thuyết phục về sắc thái tu từ"
    ],
    offlineAlternative: "Học sinh sử dụng Từ điển tiếng Việt in giấy tại thư viện trường để tra cứu nghĩa từ."
  },
  {
    id: "PROMPT-NGUVAN-07",
    subject: "Ngữ văn",
    category: "humanities",
    applicableGrades: ["10", "11", "12"],
    targetAudience: "student",
    skillDomain: "Đọc mở rộng (EXTENDED_READING)",
    title: "Xây dựng nhật ký đọc số (Reading Journal) và podcast giới thiệu sách",
    description: "Học sinh đọc tác phẩm ngoài SGK theo chủ đề, lập hồ sơ đọc số trên Notion/Padlet và sản xuất podcast truyền cảm hứng.",
    nlsCode: "1.1.NCa",
    nlsIndicator: "Khai thác các kho sách số và nền tảng xuất bản để tìm kiếm tác phẩm văn học phù hợp.",
    aiCode: "10.C2.3",
    aiComponent: "NLc",
    aiRequirement: "Nêu ví dụ về việc sử dụng AI để gợi ý danh mục tài liệu đọc hiểu cá nhân hóa.",
    promptTemplate: `Tôi vừa đọc xong cuốn sách/tác phẩm: "{{task}}"
Hãy gợi ý cho tôi:
1. 03 tác phẩm văn học trong nước hoặc thế giới có cùng đề tài hoặc tư tưởng nhân đạo tương đồng.
2. 03 câu hỏi gợi mở sâu sắc để tôi ghi vào nhật ký đọc sách cá nhân.
3. Kịch bản tóm tắt 2 phút để tôi thu âm podcast giới thiệu cuốn sách này đến các bạn trong lớp.`,
    studentTask: "Lập hồ sơ đọc số trên Padlet/Notion; thu âm podcast 3 phút; chia sẻ lên diễn đàn học tập của lớp.",
    expectedProduct: "Hồ sơ nhật ký đọc số cá nhân kèm tệp âm thanh podcast giới thiệu tác phẩm.",
    evidence: "Đường link Padlet/podcast hoặc bản in nhật ký đọc sách có chữ ký phụ huynh/giáo viên.",
    verificationMethod: "Kiểm tra sự hiểu biết sâu sắc về tác phẩm qua đối thoại trực tiếp với học sinh.",
    rubricCriteria: [
      "Thể hiện niềm say mê và cảm thụ văn học chân thành",
      "Podcast truyền cảm, rõ ràng, âm lượng vừa phải",
      "Hồ sơ đọc trình bày khoa học, thẩm mỹ"
    ],
    offlineAlternative: "Học sinh viết nhật ký đọc sách vào sổ tay handmade trang trí bằng tranh vẽ minh họa."
  },
  {
    id: "PROMPT-NGUVAN-08",
    subject: "Ngữ văn",
    category: "humanities",
    applicableGrades: ["10", "11", "12"],
    targetAudience: "student",
    skillDomain: "Dự án Ngữ văn (PROJECT)",
    title: "Triển lãm văn hóa số & Nghiên cứu văn học địa phương",
    description: "Học sinh thực hiện dự án nghiên cứu di sản văn học, văn hóa dân gian địa phương và ứng dụng công nghệ để số hóa sản phẩm triển lãm.",
    nlsCode: "2.2.NCa",
    nlsIndicator: "Cộng tác trực tuyến trong nhóm để đồng sáng tạo sản phẩm tri thức và văn hóa số.",
    aiCode: "10.C3.2",
    aiComponent: "NLc",
    aiRequirement: "Khai thác AI hỗ trợ cấu trúc hóa tài liệu điều tra thực tế và phân loại di sản văn hóa phi vật thể.",
    promptTemplate: `Nhóm chúng tôi thực hiện dự án văn học địa phương theo chủ đề:
"{{task}}"
Hãy gợi ý:
1. Khung kế hoạch triển khai gồm 4 tuần (Khảo sát, Thu thập, Xử lý tư liệu, Nghiệm thu).
2. Các câu hỏi phỏng vấn nghệ nhân dân gian hoặc người dân địa phương.
3. Ý tưởng thiết kế không gian triển lãm số (Virtual gallery) giới thiệu di sản đến cộng đồng.`,
    studentTask: "Thu thập tư liệu thực tế (ghi âm, chụp ảnh); cộng tác trên Google Docs/Canva để làm tập san số hoặc tour bảo tàng ảo; báo cáo dự án.",
    expectedProduct: "Tập san số hoặc video phóng sự nghiên cứu văn học địa phương kèm nhật ký dự án.",
    evidence: "Sản phẩm số hoàn chỉnh, đường link triển lãm và biên bản đánh giá đóng góp của từng cá nhân.",
    verificationMethod: "Đánh giá tính chân thực của nguồn tư liệu địa phương và giá trị nhân văn của dự án.",
    rubricCriteria: [
      "Bảo đảm tính chính xác lịch sử và văn hóa bản địa",
      "Sản phẩm số sáng tạo, có tính lan tỏa cộng đồng",
      "Toàn bộ thành viên trong nhóm tham gia tích cực"
    ],
    offlineAlternative: "Nhóm học sinh làm tập san đóng bìa cứng trang trí bằng hiện vật và ảnh chụp thực tế dán tay."
  },
  {
    id: "PROMPT-NGUVAN-09",
    subject: "Ngữ văn",
    category: "humanities",
    applicableGrades: ["10", "11", "12"],
    targetAudience: "both",
    skillDomain: "Kiểm tra - Đánh giá (ASSESSMENT)",
    title: "Xây dựng ma trận đề kiểm tra đánh giá năng lực và Rubric chấm tự luận",
    description: "Giáo viên thiết lập ma trận đề thi phân hóa 4 mức độ theo Thông tư 22/2021; học sinh thực hiện cam kết liêm chính học thuật khi sử dụng công nghệ số.",
    nlsCode: "1.2.NCa",
    nlsIndicator: "Áp dụng các tiêu chí bảo đảm độ tin cậy và liêm chính học thuật trong đánh giá sản phẩm học tập số.",
    aiCode: "10.B1.1",
    aiComponent: "NLb",
    aiRequirement: "Nhận diện trách nhiệm đạo đức, bản quyền và tính trung thực học thuật khi ứng dụng AI trong học tập và thi cử.",
    promptTemplate: `Xây dựng khung ma trận và bảng đặc tả đề kiểm tra định kỳ môn Ngữ văn lớp {{grade}} cho chủ đề:
"{{task}}"
Yêu cầu:
1. Ma trận phân hóa 4 mức độ (Nhận biết 40%, Thông hiểu 30%, Vận dụng 20%, Vận dụng cao 10%).
2. Phần Đọc hiểu (ngữ liệu ngoài SGK): 5 câu hỏi có đáp án chi tiết.
3. Phần Viết (nghị luận văn học/xã hội): Rubric chấm điểm chi tiết 5 tiêu chí kèm mức điểm rõ ràng.
4. Quy định cụ thể về liêm chính học thuật số đối với thí sinh.`,
    studentTask: "Đọc kỹ yêu cầu đề thi và rubric chấm điểm; ký cam kết trung thực học thuật số; tự đánh giá bài làm theo bảng rubric trước khi nộp.",
    expectedProduct: "Đề kiểm tra chuẩn hóa kèm ma trận, bản đặc tả và thang rubric chấm điểm minh bạch.",
    evidence: "Đề kiểm tra đã được tổ chuyên môn duyệt và phiếu tự đánh giá rubric của học sinh.",
    verificationMethod: "Đối chiếu ma trận với YCCĐ của Chương trình GDPT 2018 môn Ngữ văn.",
    rubricCriteria: [
      "Ngữ liệu đọc hiểu mới mẻ, chuẩn mực tư tưởng và thẩm mỹ",
      "Thang điểm và tiêu chí rubric chi tiết, khách quan",
      "Tuân thủ đúng định hướng Thông tư 22/2021 của Bộ GDĐT"
    ],
    offlineAlternative: "In đề bài kiểm tra trên giấy thi chuẩn của nhà trường; chấm thi trực tiếp theo phiếu rubric bản cứng."
  },
  {
    id: "PROMPT-LICHSU-01",
    subject: "Lịch sử",
    category: "humanities",
    applicableGrades: ["10", "11", "12"],
    targetAudience: "student",
    skillDomain: "Tư liệu lịch sử & Kiểm chứng sự kiện",
    title: "Kiểm chứng niên đại, bối cảnh và ý nghĩa lịch sử từ nguồn tư liệu gốc",
    description: "Học sinh dùng AI để tóm tắt sự kiện, sau đó đối chiếu niên đại, số liệu và lập trường lịch sử với văn kiện chính thống.",
    nlsCode: "1.2.NCa",
    nlsIndicator: "Đánh giá tính xác thực của các nguồn sử liệu trực tuyến và phân biệt sự kiện với ý kiến suy diễn.",
    aiCode: "10.A1.1",
    aiComponent: "NLa",
    aiRequirement: "Bảo đảm tính khách quan, lập trường tư tưởng và tôn trọng sự thật lịch sử của dân tộc khi khai thác AI.",
    promptTemplate: `Tóm tắt sự kiện lịch sử sau trong chương trình Lịch sử lớp {{grade}}:
"{{task}}"
Yêu cầu:
1. Liệt kê mốc thời gian, địa điểm, các bên tham gia và diễn biến chính theo trình tự thời gian.
2. Phân tích nguyên nhân thắng lợi/bài học kinh nghiệm.
3. Nêu rõ các nguồn sử liệu chính thức (văn kiện, hồi ký, hiệp định) dùng làm căn cứ.`,
    studentTask: "Lập bảng đối chiếu chéo (Cross-check) giữa nội dung AI tóm tắt với SGK Lịch sử và Cổng thông tin Tư liệu Văn kiện Đảng; chỉ ra bất kỳ sai lệch nào về thời gian.",
    expectedProduct: "Bảng niên biểu sự kiện lịch sử đã được kiểm chứng tính xác thực kèm trích nguồn cụ thể.",
    evidence: "Bản in bảng đối chiếu có bút tích sửa chữa và viện dẫn số trang SGK.",
    verificationMethod: "Tra cứu trực tiếp trong SGK Lịch sử 10/11/12 Kết nối tri thức và các văn kiện lịch sử quốc gia.",
    rubricCriteria: [
      "Tuyệt đối chính xác về niên đại, địa danh và nhân vật lịch sử",
      "Nhận thức đúng đắn ý nghĩa lịch sử dưới góc nhìn lịch sử dân tộc",
      "Minh bạch nguồn gốc tư liệu tham khảo"
    ],
    offlineAlternative: "Học sinh làm việc với các phiếu trích dẫn tư liệu lịch sử in sẵn do giáo viên chuẩn bị."
  },
  {
    id: "PROMPT-DIALY-01",
    subject: "Địa lí",
    category: "humanities",
    applicableGrades: ["10", "11", "12"],
    targetAudience: "student",
    skillDomain: "GIS, Bản đồ số & Biểu đồ thống kê",
    title: "Khai thác dữ liệu bản đồ số và xử lý số liệu địa lí phát triển bền vững",
    description: "Học sinh kết hợp câu lệnh prompt AI và công cụ bản đồ số để phân tích cơ cấu dân số, khí hậu hoặc phát triển kinh tế vùng.",
    nlsCode: "1.1.NCb",
    nlsIndicator: "Thu thập và trích xuất dữ liệu không gian từ các nền tảng bản đồ số và cổng thống kê trực tuyến.",
    aiCode: "10.C3.2",
    aiComponent: "NLc",
    aiRequirement: "Khai thác AI để cấu trúc hóa dữ liệu địa phương và hỗ trợ phân tích xu hướng biến động tự nhiên/xã hội.",
    promptTemplate: `Bạn là chuyên gia địa lí học. Phân tích bảng số liệu/chủ đề sau theo Địa lí lớp {{grade}}:
"{{task}}"
Yêu cầu:
1. Gợi ý loại biểu đồ thích hợp nhất để thể hiện động thái/cơ cấu/quy mô và giải thích lý do lựa chọn.
2. Xử lý số liệu: Tính tốc độ tăng trưởng, tỷ trọng cơ cấu (ghi rõ công thức và đơn vị %).
3. Nhận xét xu hướng và giải thích nguyên nhân dựa trên quy luật địa lí.`,
    studentTask: "Dùng Excel/Google Sheets vẽ biểu đồ theo gợi ý; kiểm tra xem phép tính tỷ trọng của AI có làm tròn đúng 100% không.",
    expectedProduct: "Biểu đồ địa lí hoàn chỉnh có đầy đủ tên, đơn vị, chú giải và đoạn văn nhận xét địa lí chuẩn mực.",
    evidence: "File ảnh biểu đồ xuất từ bảng tính kèm bảng số liệu đã xử lý.",
    verificationMethod: "Đối chiếu số liệu với Niên giám thống kê quốc gia hoặc số liệu trong SGK Địa lí Kết nối tri thức.",
    rubricCriteria: [
      "Lựa chọn dạng biểu đồ chuẩn xác theo yêu cầu thể hiện",
      "Phép tính số liệu và quy tắc làm tròn chính xác 100%",
      "Nhận xét logic, nêu bật được mối quan hệ giữa các đối tượng địa lí"
    ],
    offlineAlternative: "Học sinh dùng thước kẻ, compa và bút chì màu vẽ biểu đồ trực tiếp vào vở bài tập theo số liệu SGK."
  },
  {
    id: "PROMPT-GDKTPL-01",
    subject: "Giáo dục kinh tế và pháp luật",
    category: "humanities",
    applicableGrades: ["10", "11", "12"],
    targetAudience: "student",
    skillDomain: "Pháp luật thực tiễn & Đạo đức công dân",
    title: "Phân tích tình huống pháp luật và kiểm tra hiệu lực văn bản quy phạm",
    description: "Học sinh yêu cầu AI phân tích một tình huống pháp luật thực tế, sau đó tra cứu Cơ sở dữ liệu Quốc gia về Văn bản Pháp luật để xác minh điều khoản.",
    nlsCode: "4.1.NCa",
    nlsIndicator: "Bảo vệ quyền lợi, tuân thủ pháp luật và an toàn thông tin trong môi trường xã hội số.",
    aiCode: "10.B1.1",
    aiComponent: "NLb",
    aiRequirement: "Đánh giá tính chuẩn xác pháp lý và trách nhiệm công dân trước các lời khuyên do AI cung cấp.",
    promptTemplate: `Hãy đóng vai chuyên gia pháp lý. Hãy phân tích tình huống sau theo môn GDKT&PL lớp {{grade}}:
"{{task}}"
Yêu cầu:
1. Nhận diện các chủ thể, hành vi và quan hệ pháp luật phát sinh trong tình huống.
2. Nêu rõ hành vi nào đúng luật, hành vi nào vi phạm pháp luật; trích dẫn số hiệu điều luật tương ứng.
3. Đề xuất cách ứng xử văn minh và biện pháp giải quyết đúng pháp luật cho công dân.`,
    studentTask: "Tra cứu điều luật do AI trích dẫn trên Cổng thông tin điện tử Bộ Tư pháp; xác minh văn bản luật đó còn hiệu lực hay đã được sửa đổi.",
    expectedProduct: "Bản báo cáo tư vấn pháp lý học đường ngắn gọn kèm sơ đồ xử lý tình huống.",
    evidence: "Bản tóm tắt tình huống có ghi chú link tra cứu văn bản pháp luật chính thức.",
    verificationMethod: "Kiểm tra tình trạng hiệu lực trên Cơ sở dữ liệu quốc gia về văn bản quy phạm pháp luật (vbpl.vn).",
    rubricCriteria: [
      "Xác định đúng hành vi vi phạm và chế tài áp dụng",
      "Trích dẫn chính xác tên luật, điều khoản còn hiệu lực hiện hành",
      "Định hướng giải pháp phù hợp với chuẩn mực đạo đức và pháp luật"
    ],
    offlineAlternative: "Giáo viên phát bản in tài liệu trích lục các điều luật liên quan trong Bộ luật để học sinh đối chiếu."
  },

  // ==========================================================================================
  // NGOẠI NGỮ: TIẾNG ANH
  // ==========================================================================================
  {
    id: "PROMPT-TIENGANH-01",
    subject: "Tiếng Anh",
    category: "languages",
    applicableGrades: ["10", "11", "12"],
    targetAudience: "student",
    skillDomain: "Giao tiếp tương tác & Đánh giá văn phong CEFR",
    title: "Đóng vai hội thoại giao tiếp tình huống và chữa lỗi ngữ cảnh (CEFR B1-B2)",
    description: "Học sinh đóng vai tương tác với AI trong tình huống thực tế, sau đó yêu cầu AI phân tích collocations và nâng cao chất lượng bài viết.",
    nlsCode: "2.1.NCa",
    nlsIndicator: "Sử dụng công cụ số để giao tiếp, cộng tác và trao đổi thông tin bằng ngoại ngữ trong bối cảnh đa văn hóa.",
    aiCode: "10.C3.2",
    aiComponent: "NLc",
    aiRequirement: "Sử dụng mô hình ngôn ngữ lớn để luyện tập giao tiếp phản xạ và phân tích cấu trúc ngôn ngữ.",
    promptTemplate: `Act as a supportive English communication tutor for Grade {{grade}} students (CEFR B1 level).
Topic: "{{task}}"
Instructions:
1. Start a natural conversational dialogue by asking me ONE engaging question about the topic.
2. Keep your response under 50 words, using vocabulary suitable for High School students.
3. After I answer, provide brief constructive feedback: highlight 1 good phrase I used, correct any grammatical errors, and suggest 1 more advanced collocation.
4. Then continue the conversation with the next question.`,
    studentTask: "Thực hiện ít nhất 3 lượt hội thoại tương tác bằng tiếng Anh với AI; ghi chép lại 3 từ vựng/collocations mới học được vào sổ tay từ vựng.",
    expectedProduct: "Biên bản đối thoại tiếng Anh kèm nhật ký từ vựng và đoạn văn tóm tắt ngắn (80 từ) về nội dung đã trao đổi.",
    evidence: "Lịch sử đoạn chat tương tác và bảng tổng hợp lỗi ngữ pháp đã được chính học sinh sửa đổi.",
    verificationMethod: "Tra cứu từ điển Oxford / Cambridge Learner's Dictionary để kiểm chứng nghĩa và cách dùng từ của AI.",
    rubricCriteria: [
      "Sử dụng ngôn ngữ tự nhiên, mạch lạc, đúng ngữ cảnh chủ đề",
      "Ghi nhận và sửa chữa được các lỗi phát âm/ngữ pháp được AI chỉ ra",
      "Chủ động kiểm tra lại ngữ nghĩa trong từ điển chuẩn trước khi áp dụng"
    ],
    offlineAlternative: "Học sinh bắt cặp thực hành hội thoại trực tiếp theo thẻ đóng vai (Role-play cue cards) do giáo viên cung cấp."
  },

  // ==========================================================================================
  // CÔNG NGHỆ
  // ==========================================================================================
  {
    id: "PROMPT-CONGNGHE-01",
    subject: "Công nghệ",
    category: "applied",
    applicableGrades: ["10", "11", "12"],
    targetAudience: "student",
    skillDomain: "Bản vẽ kỹ thuật, Mạch điện & Công nghệ thông minh",
    title: "Tối ưu hóa quy trình công nghệ và thiết kế giải pháp kỹ thuật số",
    description: "Học sinh sử dụng AI để lập quy trình chế tạo hoặc thiết kế mạch điện tử, sau đó phân tích các yếu tố an toàn lao động.",
    nlsCode: "5.1.NCa",
    nlsIndicator: "Ứng dụng công nghệ kỹ thuật số để giải quyết các vấn đề kỹ thuật và đời sống thực tế.",
    aiCode: "10.C3.2",
    aiComponent: "NLc",
    aiRequirement: "Vận dụng công cụ AI để tìm kiếm giải pháp kỹ thuật, so sánh các phương án thiết kế công nghệ.",
    promptTemplate: `Bạn là kỹ sư công nghệ giáo dục. Hãy thiết kế quy trình kỹ thuật cho chủ đề "{{task}}" (Công nghệ {{grade}} - SGK Kết nối tri thức):
1. Nêu mục đích kỹ thuật và yêu cầu sản phẩm.
2. Liệt kê dụng cụ, vật liệu cần thiết kèm thông số tiêu chuẩn.
3. Lập bảng quy trình gồm 4-5 bước: Tên bước, thao tác kỹ thuật, yêu cầu chất lượng và cảnh báo an toàn.`,
    studentTask: "Lập sơ đồ quy trình công nghệ bằng sơ đồ khối; đối chiếu yêu cầu an toàn với các quy chuẩn kỹ thuật trong SGK.",
    expectedProduct: "Bản vẽ phác thảo sơ đồ khối quy trình công nghệ và bảng kiểm tra an toàn kỹ thuật.",
    evidence: "Bản vẽ hoặc file tài liệu sơ đồ quy trình có ghi chú thông số kỹ thuật.",
    verificationMethod: "Kiểm tra thực tế tính khả thi của quy trình trên các linh kiện mô phỏng hoặc SGK Công nghệ Kết nối tri thức.",
    rubricCriteria: [
      "Quy trình kỹ thuật hợp lý, khả thi và khoa học",
      "Các tiêu chuẩn an toàn lao động được nêu rõ ràng, chi tiết",
      "Sơ đồ hóa trực quan, đúng quy chuẩn bản vẽ kỹ thuật"
    ],
    offlineAlternative: "Học sinh sử dụng giấy kẻ ô vẽ tay bản vẽ kỹ thuật và sơ đồ khối quy trình theo mẫu SGK."
  }
];

export const getPromptTemplatesBySubject = (subject: string): SubjectPromptScaffold[] => {
  const cleanSubject = (subject || "").trim().toLowerCase();
  return SUBJECT_PROMPT_TEMPLATES.filter(p => {
    const pSub = p.subject.toLowerCase();
    return pSub.includes(cleanSubject) || cleanSubject.includes(pSub);
  });
};

export const getPromptTemplatesByGrade = (grade: "10" | "11" | "12"): SubjectPromptScaffold[] => {
  return SUBJECT_PROMPT_TEMPLATES.filter(p => p.applicableGrades.includes(grade));
};

export const getPromptTemplateById = (id: string): SubjectPromptScaffold | undefined => {
  return SUBJECT_PROMPT_TEMPLATES.find(p => p.id === id);
};
