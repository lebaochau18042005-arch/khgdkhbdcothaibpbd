/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Cơ sở dữ liệu Chuẩn Năng Lực Số theo Thông tư 02/2025/TT-BGDĐT & CV 3456/BGDĐT-GDPT
 * Dành riêng cho cấp THPT (Lớp 10, 11, 12) - Mức Nâng Cao (NC)
 * Cấu trúc mã: [miền].[NLTP].NC[chỉ báo] (Ví dụ: 1.1.NCa, 1.2.NCa, 6.2.NCa)
 */

export interface NlsIndicatorItem {
  id: string;
  code: string;
  domainNumber: string;
  domainName: string;
  competencyNumber: string;
  competencyName: string;
  level: "NC";
  indicatorLetter: string;
  indicatorText: string;
  sourceDocumentId: string;
  sourcePage?: number;
  isActive: boolean;
}

export const NLS_DOMAINS_MAP = {
  "1": { number: "1", name: "Khai thác dữ liệu và thông tin" },
  "2": { number: "2", name: "Giao tiếp và hợp tác trong môi trường số" },
  "3": { number: "3", name: "Sáng tạo nội dung số" },
  "4": { number: "4", name: "An toàn" },
  "5": { number: "5", name: "Giải quyết vấn đề" },
  "6": { number: "6", name: "Ứng dụng trí tuệ nhân tạo" }
};

export const NLS_INDICATORS_DB: NlsIndicatorItem[] = [
  // ==================== MIỀN 1: KHAI THÁC DỮ LIỆU VÀ THÔNG TIN ====================
  {
    id: "NLS-1.1.NCa",
    code: "1.1.NCa",
    domainNumber: "1",
    domainName: "Khai thác dữ liệu và thông tin",
    competencyNumber: "1.1",
    competencyName: "Tìm kiếm và lọc dữ liệu, thông tin và nội dung số",
    level: "NC",
    indicatorLetter: "a",
    indicatorText: "Sử dụng các chiến lược tìm kiếm nâng cao, kết hợp nhiều từ khóa và toán tử logic để truy xuất dữ liệu chuyên sâu phục vụ học tập và nghiên cứu môn học.",
    sourceDocumentId: "DOC-2025-TT02",
    sourcePage: 12,
    isActive: true
  },
  {
    id: "NLS-1.1.NCb",
    code: "1.1.NCb",
    domainNumber: "1",
    domainName: "Khai thác dữ liệu và thông tin",
    competencyNumber: "1.1",
    competencyName: "Tìm kiếm và lọc dữ liệu, thông tin và nội dung số",
    level: "NC",
    indicatorLetter: "b",
    indicatorText: "Thiết lập các bộ lọc động, tự động hóa quá trình thu thập thông tin và quản lý nguồn dữ liệu đa định dạng từ các kho học liệu trực tuyến.",
    sourceDocumentId: "DOC-2025-TT02",
    sourcePage: 12,
    isActive: true
  },
  {
    id: "NLS-1.2.NCa",
    code: "1.2.NCa",
    domainNumber: "1",
    domainName: "Khai thác dữ liệu và thông tin",
    competencyNumber: "1.2",
    competencyName: "Đánh giá dữ liệu, thông tin và nội dung số",
    level: "NC",
    indicatorLetter: "a",
    indicatorText: "Phân tích, đánh giá độ tin cậy, tính chính xác và tính khách quan của các nguồn dữ liệu số; phát hiện các thông tin sai lệch, tin giả hoặc thiên kiến.",
    sourceDocumentId: "DOC-2025-TT02",
    sourcePage: 13,
    isActive: true
  },
  {
    id: "NLS-1.3.NCa",
    code: "1.3.NCa",
    domainNumber: "1",
    domainName: "Khai thác dữ liệu và thông tin",
    competencyNumber: "1.3",
    competencyName: "Quản lý dữ liệu, thông tin và nội dung số",
    level: "NC",
    indicatorLetter: "a",
    indicatorText: "Tổ chức, phân loại và lưu trữ dữ liệu số có cấu trúc trên các nền tảng đám mây an toàn; quản lý phiên bản và truy xuất dữ liệu nhanh chóng.",
    sourceDocumentId: "DOC-2025-TT02",
    sourcePage: 14,
    isActive: true
  },

  // ==================== MIỀN 2: GIAO TIẾP VÀ HỢP TÁC ====================
  {
    id: "NLS-2.1.NCa",
    code: "2.1.NCa",
    domainNumber: "2",
    domainName: "Giao tiếp và hợp tác trong môi trường số",
    competencyNumber: "2.1",
    competencyName: "Tương tác thông qua các công nghệ số",
    level: "NC",
    indicatorLetter: "a",
    indicatorText: "Lựa chọn và phối hợp linh hoạt các kênh truyền thông số đa phương thức phù hợp với đối tượng và bối cảnh học tập chuyên sâu.",
    sourceDocumentId: "DOC-2025-TT02",
    sourcePage: 15,
    isActive: true
  },
  {
    id: "NLS-2.2.NCa",
    code: "2.2.NCa",
    domainNumber: "2",
    domainName: "Giao tiếp và hợp tác trong môi trường số",
    competencyNumber: "2.2",
    competencyName: "Chia sẻ thông tin và nội dung qua công nghệ số",
    level: "NC",
    indicatorLetter: "a",
    indicatorText: "Chia sẻ tài liệu, kết quả nghiên cứu học tập kèm trích dẫn nguồn chuẩn xác, tuân thủ các quy định về giấy phép mở và bản quyền số.",
    sourceDocumentId: "DOC-2025-TT02",
    sourcePage: 16,
    isActive: true
  },
  {
    id: "NLS-2.4.NCa",
    code: "2.4.NCa",
    domainNumber: "2",
    domainName: "Giao tiếp và hợp tác trong môi trường số",
    competencyNumber: "2.4",
    competencyName: "Hợp tác thông qua các công nghệ số",
    level: "NC",
    indicatorLetter: "a",
    indicatorText: "Sử dụng thành thạo các công cụ làm việc nhóm trực tuyến (bảng tương tác, tài liệu chia sẻ đồng bộ, sơ đồ tư duy số) để cùng tạo ra sản phẩm học tập phức hợp.",
    sourceDocumentId: "DOC-2025-TT02",
    sourcePage: 17,
    isActive: true
  },

  // ==================== MIỀN 3: SÁNG TẠO NỘI DUNG SỐ ====================
  {
    id: "NLS-3.1.NCa",
    code: "3.1.NCa",
    domainNumber: "3",
    domainName: "Sáng tạo nội dung số",
    competencyNumber: "3.1",
    competencyName: "Phát triển nội dung số",
    level: "NC",
    indicatorLetter: "a",
    indicatorText: "Biên tập, thiết kế và sản xuất các sản phẩm số đa phương tiện chất lượng cao (infographic, video bài học, mô phỏng tương tác, bài báo cáo đa phương thức).",
    sourceDocumentId: "DOC-2025-TT02",
    sourcePage: 19,
    isActive: true
  },
  {
    id: "NLS-3.2.NCa",
    code: "3.2.NCa",
    domainNumber: "3",
    domainName: "Sáng tạo nội dung số",
    competencyNumber: "3.2",
    competencyName: "Tích hợp và xây dựng lại nội dung số",
    level: "NC",
    indicatorLetter: "a",
    indicatorText: "Tổng hợp, tái cấu trúc và tích hợp các nguồn học liệu số sẵn có để tạo ra tài liệu học tập mới có giá trị gia tăng cao.",
    sourceDocumentId: "DOC-2025-TT02",
    sourcePage: 20,
    isActive: true
  },
  {
    id: "NLS-3.3.NCa",
    code: "3.3.NCa",
    domainNumber: "3",
    domainName: "Sáng tạo nội dung số",
    competencyNumber: "3.3",
    competencyName: "Bản quyền và giấy phép",
    level: "NC",
    indicatorLetter: "a",
    indicatorText: "Áp dụng đúng các quy định về sở hữu trí tuệ, Creative Commons và bản quyền khi sử dụng và phân phối lại nội dung số.",
    sourceDocumentId: "DOC-2025-TT02",
    sourcePage: 21,
    isActive: true
  },

  // ==================== MIỀN 4: AN TOÀN ====================
  {
    id: "NLS-4.1.NCa",
    code: "4.1.NCa",
    domainNumber: "4",
    domainName: "An toàn",
    competencyNumber: "4.1",
    competencyName: "Bảo vệ thiết bị",
    level: "NC",
    indicatorLetter: "a",
    indicatorText: "Thực hiện các biện pháp an ninh mạng nâng cao (xác thực đa yếu tố, mã hóa dữ liệu, quét mã độc) để bảo vệ thiết bị và dữ liệu học tập.",
    sourceDocumentId: "DOC-2025-TT02",
    sourcePage: 23,
    isActive: true
  },
  {
    id: "NLS-4.2.NCa",
    code: "4.2.NCa",
    domainNumber: "4",
    domainName: "An toàn",
    competencyNumber: "4.2",
    competencyName: "Bảo vệ dữ liệu cá nhân và quyền riêng tư",
    level: "NC",
    indicatorLetter: "a",
    indicatorText: "Quản lý và kiểm soát nghiêm ngặt dấu chân kỹ thuật số (digital footprint), bảo vệ quyền riêng tư cá nhân khi tham gia các dịch vụ trực tuyến.",
    sourceDocumentId: "DOC-2025-TT02",
    sourcePage: 24,
    isActive: true
  },

  // ==================== MIỀN 5: GIẢI QUYẾT VẤN ĐỀ ====================
  {
    id: "NLS-5.1.NCa",
    code: "5.1.NCa",
    domainNumber: "5",
    domainName: "Giải quyết vấn đề",
    competencyNumber: "5.1",
    competencyName: "Giải quyết các sự cố kỹ thuật",
    level: "NC",
    indicatorLetter: "a",
    indicatorText: "Chẩn đoán và xử lý độc lập các lỗi kỹ thuật phần cứng/phần mềm phổ biến trong quá trình học tập và thực hành số.",
    sourceDocumentId: "DOC-2025-TT02",
    sourcePage: 26,
    isActive: true
  },
  {
    id: "NLS-5.2.NCa",
    code: "5.2.NCa",
    domainNumber: "5",
    domainName: "Giải quyết vấn đề",
    competencyNumber: "5.2",
    competencyName: "Xác định nhu cầu và phản hồi công nghệ",
    level: "NC",
    indicatorLetter: "a",
    indicatorText: "Đánh giá, so sánh và lựa chọn công cụ số tối ưu nhất để giải quyết một bài toán hoặc nhiệm vụ học tập phức tạp.",
    sourceDocumentId: "DOC-2025-TT02",
    sourcePage: 27,
    isActive: true
  },

  // ==================== MIỀN 6: ỨNG DỤNG TRÍ TUỆ NHÂN TẠO ====================
  {
    id: "NLS-6.2.NCa",
    code: "6.2.NCa",
    domainNumber: "6",
    domainName: "Ứng dụng trí tuệ nhân tạo",
    competencyNumber: "6.2",
    competencyName: "Sử dụng và tương tác với hệ thống AI",
    level: "NC",
    indicatorLetter: "a",
    indicatorText: "Khai thác công cụ AI một cách có ý thức, biết cách đặt prompt hiệu quả, đối chiếu và kiểm chứng kết quả từ các nguồn học liệu chính thống.",
    sourceDocumentId: "DOC-2025-TT02",
    sourcePage: 29,
    isActive: true
  },
  {
    id: "NLS-6.3.NCa",
    code: "6.3.NCa",
    domainNumber: "6",
    domainName: "Ứng dụng trí tuệ nhân tạo",
    competencyNumber: "6.3",
    competencyName: "Đánh giá và phát triển giải pháp AI",
    level: "NC",
    indicatorLetter: "a",
    indicatorText: "Đánh giá được độ tin cậy, phát hiện các điểm sai lệch của mô hình AI và đề xuất giải pháp cải tiến câu lệnh hoặc dữ liệu đầu vào.",
    sourceDocumentId: "DOC-2025-TT02",
    sourcePage: 30,
    isActive: true
  }
];

export const isNlsCodeValid = (code: string): boolean => {
  if (!code) return false;
  const cleanCode = code.trim();
  // Must match format [miền].[NLTP].NC[chỉ báo], e.g. 1.1.NCa
  if (!/^\d\.\d\.NC[a-z]$/i.test(cleanCode)) return false;
  const item = NLS_INDICATORS_DB.find(i => i.code.toLowerCase() === cleanCode.toLowerCase());
  return !!(item && item.isActive);
};

export const getNlsIndicatorByCode = (code: string): NlsIndicatorItem | undefined => {
  return NLS_INDICATORS_DB.find(i => i.code.toLowerCase() === code.trim().toLowerCase());
};
