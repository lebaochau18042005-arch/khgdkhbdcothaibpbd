/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
// @ts-ignore
import html2pdf from "html2pdf.js";
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, WidthType, BorderStyle, HeadingLevel, VerticalAlign } from "docx";
import { saveAs } from "file-saver";
import {
  BookOpen,
  Calendar,
  Plus,
  FileText,
  Download,
  Copy,
  Printer,
  ChevronRight,
  Sparkles,
  Search,
  School,
  BrainCircuit,
  Loader2,
  FileJson,
  FileDown,
  LayoutGrid,
  ClipboardCheck,
  CheckCircle2,
  AlertCircle,
  Settings
} from "lucide-react";
import { generateLessonPlan, generateEducationalPlan, generateDepartmentPlan, generateCompetencyEvaluation, LessonPlanInput } from "./services/geminiService";

type AppMode = "dashboard" | "khbd-gen" | "khgd-gen" | "kh-tcm-gen";

const SUBJECTS = [
  "Toán học",
  "Ngữ văn",
  "Tiếng Anh",
  "Vật lý",
  "Hóa học",
  "Sinh học",
  "Lịch sử",
  "Địa lý",
  "Giáo dục kinh tế và pháp luật",
  "Tin học",
  "Công nghệ",
  "Giáo dục quốc phòng và an ninh",
  "Giáo dục thể chất",
  "Hoạt động trải nghiệm, hướng nghiệp",
  "Giáo dục địa phương"
];

const GRADES = ["10", "11", "12"];

const PROVINCES = [
  "Hà Nội (Thành phố)", "TP. Hồ Chí Minh (Thành phố)", "Hải Phòng (Thành phố)", "Đà Nẵng (Thành phố)", "Cần Thơ (Thành phố)", "Thừa Thiên Huế (Thành phố)",
  "An Giang", "Bà Rịa - Vũng Tàu", "Bắc Giang", "Bắc Ninh", "Bình Định", "Bình Dương", "Bình Phước", "Bình Thuận",
  "Cà Mau", "Đắk Lắk", "Đồng Nai", "Đồng Tháp", "Gia Lai", "Hà Tĩnh", "Hải Dương", "Hòa Bình", "Khánh Hòa",
  "Kiên Giang", "Lâm Đồng", "Lạng Sơn", "Long An", "Nam Định", "Nghệ An", "Ninh Bình", "Phú Thọ", "Quảng Ninh",
  "Thái Bình", "Thanh Hóa"
];

const CURRICULUM_DB: Record<string, Record<string, any[]>> = {
  "Lịch sử": {
    "10": [
      {
        topic: "Hiện thực lịch sử và nhận thức lịch sử",
        duration: "2 tiết",
        contextStudents: "Học sinh bước đầu làm quen với phương pháp nghiên cứu lịch sử.",
        contextSchool: "Phòng học tiêu chuẩn, tivi kết nối internet.",
        objectivesKnowledge: "Trình bày được khái niệm lịch sử; hiện thực lịch sử và nhận thức lịch sử.",
        objectivesCompetency: "Năng lực tự chủ và tự học; năng lực tư duy lịch sử.",
        objectivesQuality: "Trung thực trong trình bày các sự kiện lịch sử."
      },
      {
        topic: "Tri thức lịch sử và cuộc sống",
        duration: "2 tiết",
        contextStudents: "Học sinh có ý thức học tập tốt, tò mò về cội nguồn lịch sử.",
        contextSchool: "Phòng học có đầy đủ máy tính, máy chiếu.",
        objectivesKnowledge: "Giải thích được khái niệm sử học, tri thức lịch sử; vai trò và ý nghĩa của tri thức lịch sử.",
        objectivesCompetency: "Năng lực tìm hiểu lịch sử; năng lực giao tiếp và hợp tác.",
        objectivesQuality: "Trân trọng lịch sử, có ý thức bảo vệ di sản văn hóa."
      },
      {
        topic: "Sử học with các lĩnh vực khoa học khác",
        duration: "2 tiết",
        contextStudents: "Học sinh khá giỏi, có khả năng liên hệ liên môn.",
        contextSchool: "Thư viện trường có tài liệu tham khảo phong phú.",
        objectivesKnowledge: "Phân tích mối quan hệ giữa Sử học với các ngành khoa học xã hội và nhân văn.",
        objectivesCompetency: "Năng lực giải quyết vấn đề xã hội; tư duy phản biện.",
        objectivesQuality: "Khách quan, khoa học trong đánh giá vấn đề."
      }
    ],
    "11": [
      {
        topic: "Cách mạng công nghiệp thời cận đại",
        duration: "3 tiết",
        contextStudents: "Học sinh có kiến thức cơ bản về lịch sử thế giới cận đại.",
        contextSchool: "Phòng máy chiếu ổn định.",
        objectivesKnowledge: "Trình bày được những thành tựu tiêu biểu của các cuộc cách mạng công nghiệp thời cận đại.",
        objectivesCompetency: "Năng lực tìm hiểu và xử lý thông tin lịch sử.",
        objectivesQuality: "Biết trân trọng những giá trị sáng tạo của con người."
      }
    ]
  },
  "Toán học": {
    "10": [
      {
        topic: "Mệnh đề toán học",
        duration: "2 tiết",
        contextStudents: "Học sinh bắt đầu làm quen with logic toán học.",
        contextSchool: "Bảng tương tác, máy tính cầm tay.",
        objectivesKnowledge: "Nắm vững các khái niệm mệnh đề, mệnh đề chứa biến, phủ định của một mệnh đề.",
        objectivesCompetency: "Năng lực tư duy and lập luận toán học.",
        objectivesQuality: "Chính xác, kiên trì trong suy luận."
      },
      {
        topic: "Tập hợp and các phép toán trên tập hợp",
        duration: "2 tiết",
        contextStudents: "Học sinh nắm chắc khái niệm tập hợp từ cấp 2.",
        contextSchool: "Phần mềm GeoGebra hỗ trợ minh họa.",
        objectivesKnowledge: "Sử dụng thành thạo các ký hiệu về tập hợp; thực hiện các phép giao, hợp, hiệu.",
        objectivesCompetency: "Năng lực giải quyết vấn đề toán học.",
        objectivesQuality: "Cẩn thận trong tính toán."
      }
    ],
    "11": [
      {
        topic: "Chương 1: Hàm số lượng giác và phương trình lượng giác",
        duration: "7 tiết",
        contextStudents: "Học sinh làm quen với các hàm số vòng tròn mở rộng.",
        contextSchool: "Giáo cụ mô hình đường tròn lượng giác.",
        objectivesKnowledge: "Học sinh nhận biết các hàm số lượng giác cơ bản; giải được phương trình lượng giác.",
        objectivesCompetency: "Năng lực mô hình hóa toán học; giải quyết vấn đề.",
        objectivesQuality: "Tư duy logic, cẩn thận."
      },
      {
        topic: "Chương 2: Dãy số. Cấp số cộng và cấp số nhân",
        duration: "7 tiết",
        contextStudents: "Học sinh hiểu quy luật dãy số.",
        contextSchool: "Máy tính cầm tay, bảng tính.",
        objectivesKnowledge: "Nắm khái niệm dãy số, công thức tổng quát và tính chất cấp số cộng, cấp số nhân.",
        objectivesCompetency: "Tư duy tính toán, nhận biết tính quy luật.",
        objectivesQuality: "Sự kiên nhẫn, tính hệ thống."
      },
      {
        topic: "Chương 3: Giới hạn. Hàm số liên tục",
        duration: "6 tiết",
        contextStudents: "Học sinh tiếp cận với khái niệm vô cực và sự liên tục.",
        contextSchool: "Phần mềm hỗ trợ đồ thị.",
        objectivesKnowledge: "Tính giới hạn dãy số, hàm số; xét tính liên tục của hàm số.",
        objectivesCompetency: "Khả năng tư duy phân tích, lập luận Logic.",
        objectivesQuality: "Khoa học, khách quan."
      },
      {
        topic: "Chương 4: Đường thẳng và mặt phẳng trong không gian. Quan hệ song song",
        duration: "8 tiết",
        contextStudents: "Học sinh chuyển từ không gian 2D sang 3D.",
        contextSchool: "Mô hình khối đa diện.",
        objectivesKnowledge: "Hiểu quan hệ song song trong không gian, giao tuyến, hình biểu diễn.",
        objectivesCompetency: "Năng lực không gian, tưởng tượng hình học.",
        objectivesQuality: "Sáng tạo, thực tế."
      },
      {
        topic: "Chương 5: Các số đặc trưng đo xu thế trung tâm cho mẫu số liệu ghép nhóm",
        duration: "4 tiết",
        contextStudents: "Học sinh làm quen với xử lý thống kê nâng cao.",
        contextSchool: "Phòng máy tính, Excel.",
        objectivesKnowledge: "Tính được các số đặc trưng của mẫu số liệu ghép nhóm.",
        objectivesCompetency: "Năng lực thống kê và giải quyết bài toán thực tế.",
        objectivesQuality: "Chính xác, tôn trọng dữ liệu."
      },
      {
        topic: "Chương 6: Hàm số mũ và hàm số lôgarit",
        duration: "6 tiết",
        contextStudents: "Học sinh tìm hiểu sự liên kết mũ và lôgarit, tăng trưởng hàm.",
        contextSchool: "Thiết bị tính toán thông minh.",
        objectivesKnowledge: "Giải phương trình, bất phương trình mũ và logarit cơ bản.",
        objectivesCompetency: "Giải quyết vấn đề tăng trưởng (lãi suất, phân rã).",
        objectivesQuality: "Nhanh nhạy, chính xác."
      },
      {
        topic: "Chương 7: Đạo hàm",
        duration: "5 tiết",
        contextStudents: "Học sinh tiếp cận đại lượng biến thiên, tốc độ tức thời.",
        contextSchool: "Bảng hoặc TV liên kết máy tính.",
        objectivesKnowledge: "Tính đạo hàm theo định nghĩa và công thức.",
        objectivesCompetency: "Tư duy giải tích cơ bản.",
        objectivesQuality: "Tỉ mỉ, hệ thống."
      },
      {
        topic: "Chương 8: Quan hệ vuông góc trong không gian",
        duration: "7 tiết",
        contextStudents: "Học sinh mở rộng thêm kiến thức về hình chiếu, khoảng cách 3D.",
        contextSchool: "Mô hình không gian trực quan.",
        objectivesKnowledge: "Xác định góc, khoảng cách, chứng minh vuông góc.",
        objectivesCompetency: "Lập luận hình học sâu.",
        objectivesQuality: "Kỷ luật khối óc."
      },
      {
        topic: "Chương 9: Xác suất",
        duration: "4 tiết",
        contextStudents: "Học sinh tính toán biến cố kết hợp ngẫu nhiên.",
        contextSchool: "Xúc xắc, đồng xu.",
        objectivesKnowledge: "Sử dụng quy tắc cộng, nhân xác suất cho biến cố độc lập.",
        objectivesCompetency: "Đánh giá, dự đoán rủi ro.",
        objectivesQuality: "Khách quan, tuân thủ dữ kiện thực tế."
      }
    ]
  },
  "Tin học": {
    "10": [
      {
        topic: "Trí tuệ nhân tạo and cuộc sống",
        duration: "2 tiết",
        contextStudents: "Học sinh năng động, thích khám phá công nghệ mới.",
        contextSchool: "Phòng máy tính, internet.",
        objectivesKnowledge: "Hiểu khái niệm AI cơ bản, phân biệt AI hẹp và AI tổng quát.",
        objectivesCompetency: "Năng lực sử dụng công cụ AI an toàn và hiệu quả.",
        objectivesQuality: "Ý thức trách nhiệm khi sử dụng công nghệ số."
      }
    ]
  },
  "Ngữ văn": {
    "10": [
      {
        topic: "Thần thoại và sử thi",
        duration: "4 tiết",
        contextStudents: "Học sinh có khả năng cảm thụ văn học tốt.",
        contextSchool: "Không gian học tập yên tĩnh.",
        objectivesKnowledge: "Nhận biết các yếu tố cốt truyện, nhân vật, không gian trong thần thoại.",
        objectivesCompetency: "Năng lực đọc hiểu văn bản; năng lực thẩm mỹ.",
        objectivesQuality: "Trân trọng di sản văn hóa phi vật thể của nhân loại."
      }
    ]
  },
  "Địa lý": {
    "10": [
      {
        topic: "Bài 1. Môn Địa lí với định hướng nghề nghiệp",
        duration: "1 tiết",
        contextStudents: "Học sinh lớp 10 mới bước vào THPT, cần hiểu về môn học và nghề nghiệp liên quan.",
        contextSchool: "Video giới thiệu về các ngành nghề: quy hoạch, du lịch, khí tượng...",
        objectivesKnowledge: "Nêu được đặc điểm, vai trò của môn Địa lí. Xác định được các ngành nghề liên quan đến địa lí.",
        objectivesCompetency: "Định hướng nghề nghiệp; Tự chủ và tự học.",
        objectivesQuality: "Trách nhiệm; Chăm chỉ."
      },
      {
        topic: "Bài 2. Phương pháp biểu hiện các đối tượng địa lí trên bản đồ",
        duration: "2 tiết",
        contextStudents: "Học sinh đã làm quen bản đồ ở cấp dưới nhưng chưa sâu về phương pháp biểu hiện.",
        contextSchool: "Atlat Địa lí, bản đồ treo tường.",
        objectivesKnowledge: "Phân biệt được các phương pháp: kí hiệu, kí hiệu đường chuyển động, chấm điểm, khoanh vùng, bản đồ - biểu đồ.",
        objectivesCompetency: "Sử dụng bản đồ; Giải quyết vấn đề.",
        objectivesQuality: "Trung thực; Thận trọng."
      },
      {
        topic: "Bài 3. Sử dụng bản đồ trong học tập và đời sống, một số ứng dụng của GPS và bản đồ số",
        duration: "1 tiết",
        contextStudents: "Học sinh thường xuyên sử dụng Google Maps.",
        contextSchool: "Smartphone, máy tính kết nối internet.",
        objectivesKnowledge: "Biết cách sử dụng Atlat, bản đồ số. Hiểu vai trò của GPS.",
        objectivesCompetency: "Ứng dụng công nghệ; Tìm kiếm thông tin.",
        objectivesQuality: "Sáng tạo; Thích ứng."
      },
      {
        topic: "Bài 4. Nguồn gốc hình thành Trái Đất, vỏ Trái Đất và thuyết kiến tạo mảng",
        duration: "1 tiết",
        contextStudents: "Học sinh tò mò về sự hình thành hành tinh.",
        contextSchool: "Mô hình quả địa cầu, bản đồ kiến tạo mảng.",
        objectivesKnowledge: "Nêu được nguồn gốc Trái Đất. Trình bày đặc điểm vỏ Trái Đất và thuyết kiến tạo mảng.",
        objectivesCompetency: "Nhận thức khoa học địa lí.",
        objectivesQuality: "Ham học hỏi; Yêu thiên nhiên."
      },
      {
        topic: "Bài 5. Hệ quả địa lí các chuyển động của Trái Đất",
        duration: "2 tiết",
        contextStudents: "Học sinh quan sát hiện tượng ngày đêm dài ngắn khác nhau.",
        contextSchool: "Mô hình Trái Đất - Mặt Trời.",
        objectivesKnowledge: "Giải thích được sự luân phiên ngày đêm, giờ trên Trái Đất, các mùa, ngày đêm dài ngắn theo vĩ độ.",
        objectivesCompetency: "Sử dụng mô hình; Giải thích các hiện tượng tự nhiên.",
        objectivesQuality: "Chăm chỉ; Chính xác."
      },
      {
        topic: "Bài 6. Thạch quyển. Nội lực và tác động của nội lực đến địa hình",
        duration: "1 tiết",
        contextStudents: "Học sinh biết về động đất, núi lửa qua truyền thông.",
        contextSchool: "Video về các trận động đất, phun trào núi lửa.",
        objectivesKnowledge: "Khái niệm thạch quyển, nội lực. Trình bày tác động của nội lực (uốn nếp, đứt gãy) đến địa hình.",
        objectivesCompetency: "Phân tích tranh ảnh, sơ đồ.",
        objectivesQuality: "Ý thức phòng chống thiên tai."
      },
      {
        topic: "Bài 7. Ngoại lực và tác động của ngoại lực đến địa hình",
        duration: "2 tiết",
        contextStudents: "Học sinh thấy được hiện tượng xói mòn, sạt lở ở thực tế.",
        contextSchool: "Tranh ảnh về địa hình Karst, địa hình do gió.",
        objectivesKnowledge: "Khái niệm ngoại lực. Phân tích tác động của phong hóa, bóc mòn, vận chuyển, bồi tụ.",
        objectivesCompetency: "Quan sát thực tế địa hình.",
        objectivesQuality: "Bảo vệ môi trường tự nhiên."
      },
      {
        topic: "Bài 9. Khí quyển, các nhân tố hình thành khí hậu",
        duration: "1 tiết",
        contextStudents: "Học sinh chịu ảnh hưởng trực tiếp của thời tiết, khí hậu.",
        contextSchool: "Lược đồ phân bố nhiệt độ, các đai khí áp.",
        objectivesKnowledge: "Nêu khái niệm khí quyển. Phân tích sự phân bố nhiệt độ; khí áp và gió.",
        objectivesCompetency: "Sử dụng bản đồ khí hậu.",
        objectivesQuality: "Trách nhiệm with biến đổi khí hậu."
      },
      {
        topic: "Bài 10. Mưa",
        duration: "1 tiết",
        contextStudents: "Học sinh quan tâm đến các loại mưa địa phương.",
        contextSchool: "Bản đồ phân bố lượng mưa thế giới.",
        objectivesKnowledge: "Phân tích các nhân tố ảnh hưởng đến lượng mưa và sự phân bố mưa.",
        objectivesCompetency: "Phân tích biểu đồ lượng mưa.",
        objectivesQuality: "Ý thức sử dụng nguồn nước mưa sạch."
      },
      {
        topic: "Bài 12. Thủy quyển, nước trên lục địa",
        duration: "2 tiết",
        contextStudents: "Học sinh hiểu về vòng tuần hoàn của nước.",
        contextSchool: "Sơ đồ chu trình nước, bản đồ sông ngòi.",
        objectivesKnowledge: "Khái niệm thủy quyển. Phân tích các nhân tố ảnh hưởng đến chế độ nước sông.",
        objectivesCompetency: "Vẽ sơ đồ; phân tích biến động dòng chảy.",
        objectivesQuality: "Tiết kiệm và bảo vệ nguồn nước."
      },
      {
        topic: "Bài 13. Nước biển và đại dương",
        duration: "1 tiết",
        contextStudents: "Học sinh thích biển, ham học hỏi về thủy triều.",
        contextSchool: "Video về sóng thần, thủy triều, dòng biển.",
        objectivesKnowledge: "Trình bày được tính chất nước biển. Giải thích nguyên nhân hình thành sóng, thủy triều, dòng biển.",
        objectivesCompetency: "Giải thích các quy luật của biển.",
        objectivesQuality: "Yêu biển đảo quê hương; bảo vệ môi trường biển."
      },
      {
        topic: "Bài 14. Đất",
        duration: "1 tiết",
        contextStudents: "Học sinh hiểu về nguồn tài nguyên quý giá gần gũi.",
        contextSchool: "Mẫu đất thực tế, sơ đồ phẫu diện đất.",
        objectivesKnowledge: "Nêu được các nhân tố hình thành đất. Hiểu tầm quan trọng của việc bảo vệ đất.",
        objectivesCompetency: "Quan sát; Nhận biết các loại đất.",
        objectivesQuality: "Trân trọng đất đai; bảo vệ đất chống sói mòn."
      },
      {
        topic: "Bài 15. Sinh quyển",
        duration: "1 tiết",
        contextStudents: "Học sinh yêu động thực vật.",
        contextSchool: "Bản đồ thảm thực vật thế giới.",
        objectivesKnowledge: "Nêu khái niệm sinh quyển. Phân tích các nhân tố ảnh hưởng đến sự phân bố sinh vật.",
        objectivesCompetency: "Phân tích mối liên hệ sinh thái.",
        objectivesQuality: "Bảo vệ đa dạng sinh học."
      },
      {
        topic: "Bài 17. Vỏ địa lí, các quy luật của vỏ địa lí",
        duration: "2 tiết",
        contextStudents: "Học sinh bắt đầu hiểu về tính tổng hợp của tự nhiên.",
        contextSchool: "Sơ đồ các quyển của Trái Đất.",
        objectivesKnowledge: "Trình bày quy luật thống nhất và hoàn chỉnh; quy luật địa đới; quy luật phi địa đới.",
        objectivesCompetency: "Tư duy hệ thống.",
        objectivesQuality: "Tư duy biện chứng."
      },
      {
        topic: "Bài 19. Quy mô dân số, gia tăng dân số và cơ cấu dân số thế giới",
        duration: "2 tiết",
        contextStudents: "Học sinh quan tâm đến các tin tức về bùng nổ dân số.",
        contextSchool: "Bảng số liệu dân số, tháp dân số thế giới.",
        objectivesKnowledge: "Trình bày tình hình phát triển dân số thế giới. Phân tích các loại cơ cấu dân số.",
        objectivesCompetency: "Xử lý số liệu dân số; Phân tích tháp tuổi.",
        objectivesQuality: "Trách nhiệm với cộng đồng."
      },
      {
        topic: "Bài 20. Phân bố dân cư và đô thị hóa trên thế giới",
        duration: "1 tiết",
        contextStudents: "Học sinh quan sát sự phát triển của các thành phố lớn.",
        contextSchool: "Bản đồ phân bố dân cư thế giới.",
        objectivesKnowledge: "Phân tích các nhân tố ảnh hưởng đến phân bố dân cư. Trình bày đặc điểm đô thị hóa.",
        objectivesCompetency: "Phân tích bản đồ dân cư.",
        objectivesQuality: "Tư duy quy hoạch."
      },
      {
        topic: "Bài 22. Các nguồn lực phát triển kinh tế",
        duration: "1 tiết",
        contextStudents: "Học sinh muốn tìm hiểu tại sao có nước giàu nước nghèo.",
        contextSchool: "Sơ đồ phân loại các nguồn lực.",
        objectivesKnowledge: "Khái niệm and phân loại các nguồn lực (vị trí, tự nhiên, KT-XH).",
        objectivesCompetency: "Đánh giá thế mạnh lãnh thổ.",
        objectivesQuality: "Trung thực trong nhận định."
      },
      {
        topic: "Bài 23. Cơ cấu nền kinh tế, tổng sản phẩm trong nước và tổng thu nhập quốc gia",
        duration: "1 tiết",
        contextStudents: "Học sinh bắt đầu tiếp xúc kiến thức kinh tế vĩ mô.",
        contextSchool: "Bảng số liệu GDP, GNI.",
        objectivesKnowledge: "Hiểu về cơ cấu ngành, cơ cấu thành phần, cơ cấu lãnh thổ. Phân biệt GDP và GNI.",
        objectivesCompetency: "Tính toán và vẽ biểu đồ kinh tế.",
        objectivesQuality: "Chính xác; trung thực."
      },
      {
        topic: "Bài 25. Địa lí ngành nông nghiệp, lâm nghiệp, thủy sản",
        duration: "3 tiết",
        contextStudents: "Học sinh hiểu về tầm quan trọng của lương thực.",
        contextSchool: "Bản đồ nông nghiệp thế giới.",
        objectivesKnowledge: "Trình bày vai trò, đặc điểm và các nhân tố ảnh hưởng. Tình hình phát triển và phân bố các ngành.",
        objectivesCompetency: "Phân tích số liệu nông nghiệp.",
        objectivesQuality: "Yêu lao động; bảo vệ tài nguyên rừng/biển."
      },
      {
        topic: "Bài 28. Địa lí ngành công nghiệp",
        duration: "3 tiết",
        contextStudents: "Học sinh sống trong xã hội công nghiệp.",
        contextSchool: "Bản đồ công nghiệp thế giới.",
        objectivesKnowledge: "Vai trò, đặc điểm công nghiệp. Các nhân tố ảnh hưởng. Phân bố một số ngành then chốt.",
        objectivesCompetency: "Khai thác lược đồ sản xuất công nghiệp.",
        objectivesQuality: "Tư duy hiện đại; bảo vệ môi trường."
      },
      {
        topic: "Bài 31. Địa lí ngành dịch vụ",
        duration: "2 tiết",
        contextStudents: "Học sinh tiếp xúc nhiều với thương mại, du lịch.",
        contextSchool: "Sơ đồ phân loại ngành dịch vụ.",
        objectivesKnowledge: "Cơ cấu, vai trò và các nhân tố ảnh hưởng đến phát triển dịch vụ.",
        objectivesCompetency: "Vận dụng vào thực tiễn địa phương.",
        objectivesQuality: "Năng động; Sáng tạo."
      },
      {
        topic: "Bài 32. Địa lí ngành giao thông vận tải và bưu chính viễn thông",
        duration: "3 tiết",
        contextStudents: "Học sinh sử dụng internet và phương tiện giao thông.",
        contextSchool: "Bản đồ giao thông, mạng lưới viễn thông.",
        objectivesKnowledge: "Vai trò, đặc điểm, tình hình phát triển các loại hình vận tải và viễn thông.",
        objectivesCompetency: "Đánh giá sự phát triển hạ tầng.",
        objectivesQuality: "Văn hóa giao thông; An toàn thông tin."
      },
      {
        topic: "Bài 35. Địa lí ngành thương mại, tài chính ngân hàng và du lịch",
        duration: "3 tiết",
        contextStudents: "Học sinh thích du lịch và tìm hiểu về tiền tệ.",
        contextSchool: "Bảng tỉ giá, bản đồ du lịch thế giới.",
        objectivesKnowledge: "Thị trường thế giới, hoạt động xuất nhập khẩu. Vai trò du lịch.",
        objectivesCompetency: "Xử lý thông tin thị trường.",
        objectivesQuality: "Hội nhập; Trách nhiệm."
      },
      {
        topic: "Bài 39. Môi trường và sự phát triển bền vững",
        duration: "1 tiết",
        contextStudents: "Học sinh nhận thấy biến đổi khí hậu là vấn đề cấp bách.",
        contextSchool: "Video về biến đổi khí hậu, phát triển bền vững.",
        objectivesKnowledge: "Hiểu mối quan hệ môi trường - phát triển. Các giải pháp bảo vệ môi trường.",
        objectivesCompetency: "Xây dựng dự án xanh.",
        objectivesQuality: "Trách nhiệm với tương lai."
      }
    ],
    "11": [
      {
        topic: "Bài 1. Sự khác biệt về trình độ phát triển kinh tế - xã hội của các nhóm nước",
        duration: "1 tiết",
        contextStudents: "Học sinh tò mò về sự phân hóa giàu - nghèo trên thế giới.",
        contextSchool: "Bản đồ các nước trên thế giới, số liệu GNI/người.",
        objectivesKnowledge: "Phân biệt được các nhóm nước phát triển và đang phát triển. Hiểu các chỉ tiêu GNI/người, HDI, cơ cấu kinh tế.",
        objectivesCompetency: "Xử lý số liệu; So sánh đối chiếu.",
        objectivesQuality: "Nhân ái; Trách nhiệm toàn cầu."
      },
      {
        topic: "Bài 2. Toàn cầu hóa, khu vực hóa kinh tế",
        duration: "2 tiết",
        contextStudents: "Học sinh tiếp xúc với hàng hóa và văn hóa toàn cầu hằng ngày.",
        contextSchool: "Video về các tập đoàn đa quốc gia, liên kết kinh tế.",
        objectivesKnowledge: "Trình bày được các biểu hiện và hệ quả của toàn cầu hóa, khu vực hóa kinh tế.",
        objectivesCompetency: "Giải quyết vấn đề hội nhập.",
        objectivesQuality: "Hội nhập; Giữ gìn bản sắc dân tộc."
      },
      {
        topic: "Bài 3. Một số tổ chức khu vực và quốc tế",
        duration: "1 tiết",
        contextStudents: "Học sinh nghe nói nhiều về UN, WTO, ASEAN.",
        contextSchool: "Tư liệu về các tổ chức quốc tế lớn.",
        objectivesKnowledge: "Hiểu vai trò của UN, WTO, IMF, APEC trong nền kinh tế thế giới.",
        objectivesCompetency: "Thu thập và hệ thống hóa thông tin.",
        objectivesQuality: "Tiếp thu tinh hoa nhân loại."
      },
      {
        topic: "Bài 4. Thực hành: Tìm hiểu về toàn cầu hóa, khu vực hóa",
        duration: "1 tiết",
        contextStudents: "Học sinh rèn luyện kỹ năng viết báo cáo.",
        contextSchool: "Máy tính có kết nối internet.",
        objectivesKnowledge: "Nắm vững biểu hiện của toàn cầu hóa qua các dữ liệu thực tế.",
        objectivesCompetency: "Viết báo cáo địa lí; làm việc nhóm.",
        objectivesQuality: "Trung thực; Trách nhiệm."
      },
      {
        topic: "Bài 6. Vị trí địa lí, điều kiện tự nhiên, dân cư và xã hội khu vực Mỹ La-tinh",
        duration: "2 tiết",
        contextStudents: "Học sinh yêu thích văn hóa sôi động của Mỹ La-tinh.",
        contextSchool: "Bản đồ tự nhiên khu vực Mỹ La-tinh.",
        objectivesKnowledge: "Phân tích ảnh hưởng của vị trí và tự nhiên đến phát triển kinh tế. Hiểu vấn đề đô thị hóa.",
        objectivesCompetency: "Sử dụng bản đồ; Phân tích mối liên hệ.",
        objectivesQuality: "Tôn trọng sự khác biệt văn hóa."
      },
      {
        topic: "Bài 7. Kinh tế khu vực Mỹ La-tinh",
        duration: "2 tiết",
        contextStudents: "Học sinh tìm hiểu lý do kinh tế Mỹ La-tinh chậm phát triển.",
        contextSchool: "Bảng số liệu kinh tế các nước Mỹ La-tinh.",
        objectivesKnowledge: "Trình bày tình hình phát triển kinh tế chung và các ngành kinh tế nổi bật.",
        objectivesCompetency: "Xử lý số liệu thống kê.",
        objectivesQuality: "Tư duy phản biện."
      },
      {
        topic: "Bài 8. Thực hành: Viết báo cáo về tình hình phát triển kinh tế - xã hội ở Cộng hòa Liên bang Bra-xin",
        duration: "1 tiết",
        contextStudents: "Học sinh tìm hiểu về quốc gia lớn nhất Nam Mỹ.",
        contextSchool: "Tài liệu về kinh tế Bra-xin.",
        objectivesKnowledge: "Hiểu về chuyển dịch cơ cấu kinh tế ở Bra-xin.",
        objectivesCompetency: "Lập dàn ý và hoàn thiện báo cáo địa lí.",
        objectivesQuality: "Chăm chỉ; Tỉ mỉ."
      },
      {
        topic: "Bài 9. EU - Một liên kết kinh tế khu vực lớn",
        duration: "2 tiết",
        contextStudents: "Học sinh biết về sức mạnh của đồng Euro.",
        contextSchool: "Bản đồ các nước EU.",
        objectivesKnowledge: "Xác định quy mô, mục tiêu và vị thế của EU trong nền kinh tế thế giới.",
        objectivesCompetency: "Tiếp cận thông tin chính trị - kinh tế quốc tế.",
        objectivesQuality: "Hợp tác; Hội nhập."
      },
      {
        topic: "Bài 10. Thực hành: Tìm hiểu về công nghiệp của Liên minh Châu Âu",
        duration: "1 tiết",
        contextStudents: "Học sinh tìm hiểu về hàng không Airbus, ô tô Đức.",
        contextSchool: "Tư liệu về các ngành sản xuất của EU.",
        objectivesKnowledge: "Thấy được sự hợp tác sản xuất đỉnh cao giữa các quốc gia EU.",
        objectivesCompetency: "Trình bày báo cáo chuyên đề.",
        objectivesQuality: "Sáng tạo; Học hỏi."
      },
      {
        topic: "Bài 11. Vị trí địa lí, điều kiện tự nhiên, dân cư và xã hội khu vực Đông Nam Á",
        duration: "2 tiết",
        contextStudents: "Học sinh hiểu về ngôi nhà chung của Việt Nam.",
        contextSchool: "Bản đồ hành chính/tự nhiên Đông Nam Á.",
        objectivesKnowledge: "Phân tích được thế mạnh và khó khăn của tự nhiên ĐNA. Hiểu về đa dạng văn hóa.",
        objectivesCompetency: "Sử dụng Atlat, bản đồ.",
        objectivesQuality: "Yêu nước; Tình hữu nghị quốc tế."
      },
      {
        topic: "Bài 12. Kinh tế khu vực Đông Nam Á",
        duration: "3 tiết",
        contextStudents: "Học sinh quan sát sự phát triển kinh tế của các nước láng giềng.",
        contextSchool: "Bảng số liệu nông nghiệp, công nghiệp ĐNA.",
        objectivesKnowledge: "Trình bày được tình hình phát triển nông nghiệp, công nghiệp, dịch vụ ĐNA.",
        objectivesCompetency: "Phân tích biểu đồ chuyển dịch cơ cấu.",
        objectivesQuality: "Hợp tác cùng phát triển."
      },
      {
        topic: "Bài 13. Hiệp hội các quốc gia Đông Nam Á (ASEAN)",
        duration: "1 tiết",
        contextStudents: "Học sinh tìm hiểu về mục tiêu tiến tới cộng đồng ASEAN.",
        contextSchool: "Văn tài liệu về tổ chức ASEAN.",
        objectivesKnowledge: "Xác định mục tiêu, cơ chế và thành tựu của ASEAN. Vai trò của VN.",
        objectivesCompetency: "Tư duy chính trị hội nhập.",
        objectivesQuality: "Trách nhiệm công dân quốc tế."
      },
      {
        topic: "Bài 15. Vị trí địa lí, điều kiện tự nhiên, dân cư và xã hội khu vực Tây Nam Á",
        duration: "2 tiết",
        contextStudents: "Học sinh biết Tây Nam Á là tâm điểm của dầu mỏ và xung đột.",
        contextSchool: "Bản đồ thế giới, bản đồ khu vực Tây Nam Á.",
        objectivesKnowledge: "Giải thích được tầm quan trọng của vị trí địa - chính trị. Hiểu về tài nguyên dầu mỏ.",
        objectivesCompetency: "Theo dõi tin tức thời sự quốc tế.",
        objectivesQuality: "Yêu chuộng hòa bình."
      },
      {
        topic: "Bài 16. Kinh tế khu vực Tây Nam Á",
        duration: "2 tiết",
        contextStudents: "Học sinh tìm hiểu sự thịnh vượng dựa trên dầu mỏ.",
        contextSchool: "Số liệu xuất khẩu dầu mỏ của các quốc gia Tây Nam Á.",
        objectivesKnowledge: "Trình bày được vai trò của ngành khai thác dầu khí và dịch vụ tài chính.",
        objectivesCompetency: "Phân tích tác động kinh tế từ tài nguyên.",
        objectivesQuality: "Khai thác bền vững."
      },
      {
        topic: "Bài 17. Thực hành: Viết báo cáo về vấn đề dầu mỏ ở khu vực Tây Nam Á",
        duration: "1 tiết",
        contextStudents: "Học sinh rèn luyện kỹ năng tổng hợp thông tin.",
        contextSchool: "Tài liệu về giá dầu và chính trị thế giới.",
        objectivesKnowledge: "Hiểu mối liên hệ giữa dầu mỏ, kinh tế và chính trị.",
        objectivesCompetency: "Tổng hợp thông tin đa chiều.",
        objectivesQuality: "Trung thực; Khách quan."
      },
      {
        topic: "Bài 18. Vị trí địa lí, điều kiện tự nhiên, dân cư và xã hội Hoa Kỳ",
        duration: "2 tiết",
        contextStudents: "Học sinh tò mò về siêu cường quốc số 1 thế giới.",
        contextSchool: "Bản đồ Hoa Kỳ, tranh ảnh về các bang.",
        objectivesKnowledge: "Phân tích thế mạnh từ vị trí, đất đai, khoáng sản. Hiểu về đặc điểm nhập cư.",
        objectivesCompetency: "Phân tích đặc điểm cường quốc kinh tế.",
        objectivesQuality: "Đổi mới; Sáng tạo."
      },
      {
        topic: "Bài 19. Kinh tế Hoa Kỳ",
        duration: "2 tiết",
        contextStudents: "Học sinh biết về Thung lũng Silicon, phố Wall.",
        contextSchool: "Biểu đồ GDP của Hoa Kỳ so với thế giới.",
        objectivesKnowledge: "Phân tích đặc điểm dịch vụ, công nghiệp, nông nghiệp Hoa Kỳ.",
        objectivesCompetency: "Giải thích các quy luật kinh tế hiện đại.",
        objectivesQuality: "Tinh thần khởi nghiệp."
      },
      {
        topic: "Bài 20. Thực hành: Tìm hiểu về sự phân hóa lãnh thổ nông nghiệp của Hoa Kỳ",
        duration: "1 tiết",
        contextStudents: "Học sinh sử dụng kỹ năng đọc bản đồ kinh tế.",
        contextSchool: "Bản đồ nông nghiệp Hoa Kỳ.",
        objectivesKnowledge: "Thấy được sự phân hóa các vành đai nông nghiệp chuyên môn hóa.",
        objectivesCompetency: "Nhận xét phân bố lãnh thổ.",
        objectivesQuality: "Chăm chỉ; Tỉ mỉ."
      },
      {
        topic: "Bài 21. Vị trí địa lí, điều kiện tự nhiên, dân cư và xã hội Liên bang Nga",
        duration: "2 tiết",
        contextStudents: "Học sinh biết về đất nước rộng lớn nhất Trái Đất.",
        contextSchool: "Bản đồ Liên bang Nga, tranh ảnh rừng Taiga.",
        objectivesKnowledge: "Phân tích ảnh hưởng của diện tích, vị trí và tài nguyên đến kinh tế.",
        objectivesCompetency: "Vận dụng tư duy không gian.",
        objectivesQuality: "Bảo tồn tài nguyên thiên nhiên."
      },
      {
        topic: "Bài 22. Kinh tế Liên bang Nga",
        duration: "2 tiết",
        contextStudents: "Học sinh tìm hiểu về cường quốc quân sự and khí đốt.",
        contextSchool: "Bảng số liệu các ngành kinh tế Nga.",
        objectivesKnowledge: "Trình bày tình hình phát triển kinh tế, các ngành then chốt and vùng kinh tế.",
        objectivesCompetency: "Phân tích chuyển dịch kinh tế quốc gia.",
        objectivesQuality: "Hợp tác đa phương."
      },
      {
        topic: "Bài 23. Thực hành: Tìm hiểu về sự thay đổi kinh tế của Liên bang Nga",
        duration: "1 tiết",
        contextStudents: "Học sinh xử lý các bảng số liệu phức tạp.",
        contextSchool: "Dữ liệu kinh tế Nga qua các năm.",
        objectivesKnowledge: "Nhận thấy sự biến động của GDP và sản lượng các ngành.",
        objectivesCompetency: "Vẽ and nhận xét biểu đồ.",
        objectivesQuality: "Kiên trì; Chính xác."
      },
      {
        topic: "Bài 24. Vị trí địa lí, điều kiện tự nhiên, dân cư và xã hội Nhật Bản",
        duration: "1 tiết",
        contextStudents: "Học sinh hâm mộ ý chí của người Nhật sau thiên tai.",
        contextSchool: "Bản đồ Nhật Bản, video về sóng thần.",
        objectivesKnowledge: "Nêu đặc điểm vị trí quần đảo. Phân tích ảnh hưởng của dân cư (già hóa).",
        objectivesCompetency: "Phân tích đặc điểm nhân văn.",
        objectivesQuality: "Ý chí; Kỷ luật."
      },
      {
        topic: "Bài 25. Kinh tế Nhật Bản",
        duration: "2 tiết",
        contextStudents: "Học sinh biết về chất lượng hàng 'Made in Japan'.",
        contextSchool: "Bản đồ các vùng kinh tế Nhật Bản.",
        objectivesKnowledge: "Giải thích các giai đoạn phát triển and đặc điểm các ngành hàng đầu.",
        objectivesCompetency: "Lập sơ đồ tư duy sự phát triển kinh tế.",
        objectivesQuality: "Trách nhiệm; Chất lượng."
      },
      {
        topic: "Bài 26. Thực hành: Viết báo cáo về hoạt động kinh tế đối ngoại của Nhật Bản",
        duration: "1 tiết",
        contextStudents: "Học sinh rèn kỹ năng viết phân tích thương mại.",
        contextSchool: "Số liệu xuất nhập khẩu Nhật - Thế giới.",
        objectivesKnowledge: "Thấy được vai trò chủ chốt của ngoại thương đối với Nhật.",
        objectivesCompetency: "Kỹ năng lập luận and trình bày.",
        objectivesQuality: "Hội nhập; Trung thực."
      },
      {
        topic: "Bài 27. Vị trí địa lí, điều kiện tự nhiên, dân cư và xã hội Trung Quốc",
        duration: "2 tiết",
        contextStudents: "Học sinh quan sát nước láng giềng đông dân nhất.",
        contextSchool: "Bản đồ Trung Quốc, tư liệu phân hóa Miền Đông - Miền Tây.",
        objectivesKnowledge: "Phân tích sự khác biệt tự nhiên and dân cư giữa hai miền Đông - Tây.",
        objectivesCompetency: "So sánh đối chiếu lãnh thổ.",
        objectivesQuality: "Hữu nghị; Hợp tác."
      },
      {
        topic: "Bài 28. Kinh tế Trung Quốc",
        duration: "2 tiết",
        contextStudents: "Học sinh biết Trung Quốc là 'công xưởng của thế giới'.",
        contextSchool: "Số liệu về tốc độ tăng trưởng GDP Trung Quốc.",
        objectivesKnowledge: "Trình bày thành tựu hiện đại hóa nông nghiệp, công nghiệp.",
        objectivesCompetency: "Nhận định về sức mạnh kinh tế mới.",
        objectivesQuality: "Cầu tiến; Nỗ lực."
      },
      {
        topic: "Bài 29. Thực hành: Tìm hiểu về sự thay đổi của kinh tế Trung Quốc",
        duration: "1 tiết",
        contextStudents: "Học sinh luyện tập kỹ năng biểu đồ cột chồng.",
        contextSchool: "Dữ liệu sản lượng công nghiệp Trung Quốc.",
        objectivesKnowledge: "Minh chứng cho sự lớn mạnh của ngành công nghiệp Trung Quốc.",
        objectivesCompetency: "Vẽ biểu đồ thành thạo.",
        objectivesQuality: "Cẩn thận; tỉ mỉ."
      },
      {
        topic: "Bài 30. Vị trí địa lí, điều kiện tự nhiên, dân cư và xã hội Ô-xtrây-li-a",
        duration: "1 tiết",
        contextStudents: "Học sinh thích thú với các loài động vật đặc hữu.",
        contextSchool: "Bản đồ Ô-xtrây-li-a, hình ảnh Kangaroo.",
        objectivesKnowledge: "Nêu đặc điểm độc đáo của tự nhiên and dân cư Ô-xtrây-li-a.",
        objectivesCompetency: "Tìm kiếm tư liệu địa lí.",
        objectivesQuality: "Yêu thiên nhiên; Khám phá."
      }
    ],
    "12": [
      {
        topic: "Bài 1. Vị trí địa lí và phạm vi lãnh thổ",
        duration: "1 tiết",
        contextStudents: "Học sinh hiểu về ý nghĩa chiến lược của vị trí nước ta.",
        contextSchool: "Bản đồ hành chính VN, Atlat Địa lí VN.",
        objectivesKnowledge: "Xác định đặc điểm vị trí and phạm vi lãnh thổ. Hiểu ý nghĩa đối với tự nhiên, kinh tế and an ninh.",
        objectivesCompetency: "Sử dụng bản đồ; Nhận thức không gian.",
        objectivesQuality: "Yêu nước; Trách nhiệm bảo vệ chủ quyền."
      },
      {
        topic: "Bài 2. Thiên nhiên nhiệt đới ẩm gió mùa",
        duration: "2 tiết",
        contextStudents: "Học sinh quan sát được các biểu hiện khí hậu tại địa phương.",
        contextSchool: "Máy tính, máy chiếu, biểu đồ khí hậu.",
        objectivesKnowledge: "Chứng minh đặc điểm nhiệt độ, độ ẩm and gió mùa của VN. Hiểu ảnh hưởng đến sản xuất.",
        objectivesCompetency: "Giải thích các hiện tượng khí hậu.",
        objectivesQuality: "Bảo vệ môi trường tự nhiên."
      },
      {
        topic: "Bài 3. Sự phân hóa đa dạng của thiên nhiên",
        duration: "2 tiết",
        contextStudents: "Học sinh thấy được sự khác biệt Bắc - Nam.",
        contextSchool: "Bản đồ tự nhiên VN, hình ảnh các vùng miền.",
        objectivesKnowledge: "Hiểu quy luật phân hóa theo Bắc - Nam, Đông - Tây and theo độ cao.",
        objectivesCompetency: "Kỹ năng so sánh; Sử dụng bản đồ.",
        objectivesQuality: "Tôn trọng đa dạng thiên nhiên."
      },
      {
        topic: "Bài 4. Thực hành: Tìm hiểu thế mạnh và hạn chế của thiên nhiên Việt Nam",
        duration: "1 tiết",
        contextStudents: "Học sinh rèn kỹ năng tổng hợp kiến thức.",
        contextSchool: "Tài liệu học tập, phiếu bài tập.",
        objectivesKnowledge: "Đánh giá được các nguồn lực tự nhiên đối với phát triển kinh tế.",
        objectivesCompetency: "Tổng hợp thông tin; Phân tích đa chiều.",
        objectivesQuality: "Trung thực; Khách quan."
      },
      {
        topic: "Bài 6. Dân số Việt Nam",
        duration: "2 tiết",
        contextStudents: "Học sinh quan tâm đến các vấn đề việc làm and dân số vàng.",
        contextSchool: "Số liệu dân số, tháp tuổi Việt Nam.",
        objectivesKnowledge: "Trình bày đặc điểm dân số, phân bố dân cư and sự chuyển dịch cơ cấu dân số.",
        objectivesCompetency: "Phân tích số liệu thống kê.",
        objectivesQuality: "Trách nhiệm với cộng đồng."
      },
      {
        topic: "Bài 7. Lao động và việc làm",
        duration: "1 tiết",
        contextStudents: "Học sinh chuẩn bị lựa chọn nghề nghiệp.",
        contextSchool: "Thông tin thị trường lao động.",
        objectivesKnowledge: "Đánh giá chất lượng nguồn lao động and vấn đề giải quyết việc làm.",
        objectivesCompetency: "Định hướng nghề nghiệp.",
        objectivesQuality: "Chăm chỉ; Cầu tiến."
      },
      {
        topic: "Bài 8. Đô thị hóa",
        duration: "1 tiết",
        contextStudents: "Học sinh quan sát tốc độ đô thị hóa nhanh tại địa phương.",
        contextSchool: "Bản đồ mạng lưới đô thị Việt Nam.",
        objectivesKnowledge: "Đặc điểm đô thị hóa and mạng lưới đô thị ở Việt Nam.",
        objectivesCompetency: "Nhận xét phân bố đô thị.",
        objectivesQuality: "Ý thức quy hoạch văn minh."
      },
      {
        topic: "Bài 9. Thực hành: Tìm hiểu về dân số, lao động và đô thị hóa ở địa phương",
        duration: "1 tiết",
        contextStudents: "Học sinh điều tra thực tế địa phương.",
        contextSchool: "Niên giám thống kê địa phương.",
        objectivesKnowledge: "Hiểu rõ tình hình dân cư xã hội tại nơi mình sống.",
        objectivesCompetency: "Thu thập and xử lý thông tin thực tế.",
        objectivesQuality: "Yêu quê hương; Trực quan."
      },
      {
        topic: "Bài 10. Chuyển dịch cơ cấu kinh tế",
        duration: "1 tiết",
        contextStudents: "Học sinh bắt đầu hiểu về CNH - HĐH.",
        contextSchool: "Biểu đồ chuyển dịch cơ cấu ngành kinh tế.",
        objectivesKnowledge: "Ưu tiên chuyển dịch theo ngành, thành phần and lãnh thổ.",
        objectivesCompetency: "Vẽ and nhận xét biểu đồ miền.",
        objectivesQuality: "Tin tưởng vào đường lối đổi mới."
      },
      {
        topic: "Bài 11. Vấn đề phát triển nông nghiệp, lâm nghiệp và thủy sản",
        duration: "3 tiết",
        contextStudents: "Học sinh hiểu vai trò của 'bệ đỡ' kinh tế.",
        contextSchool: "Bản đồ nông nghiệp, lâm nghiệp and thủy sản VN.",
        objectivesKnowledge: "Thế mạnh and thực trạng phát triển các ngành nông lâm ngư.",
        objectivesCompetency: "Sử dụng Atlat Địa lí Việt Nam.",
        objectivesQuality: "Yêu lao động; Bảo vệ tài nguyên."
      },
      {
        topic: "Bài 12. Tổ chức lãnh thổ nông nghiệp",
        duration: "1 tiết",
        contextStudents: "Học sinh tìm hiểu về các vùng chuyên canh.",
        contextSchool: "Bản đồ các vùng nông nghiệp VN.",
        objectivesKnowledge: "Các vùng nông nghiệp and hình thức tổ chức lãnh thổ nông nghiệp.",
        objectivesCompetency: "Tư duy lãnh thổ.",
        objectivesQuality: "Trách nhiệm quản lý đất đai."
      },
      {
        topic: "Bài 13. Thực hành: Tìm hiểu vai trò và đặc điểm ngành nông nghiệp, lâm nghiệp và thủy sản",
        duration: "1 tiết",
        contextStudents: "Học sinh củng cố kỹ năng phân tích.",
        contextSchool: "Số liệu sản lượng nông lâm thủy sản.",
        objectivesKnowledge: "Minh chứng cho sự phát triển của khu vực I.",
        objectivesCompetency: "Xử lý and giải thích số liệu.",
        objectivesQuality: "Tỉ mỉ; Chính xác."
      },
      {
        topic: "Bài 14. Vấn đề phát triển công nghiệp",
        duration: "2 tiết",
        contextStudents: "Học sinh sống trong xã hội đang đẩy mạnh công nghiệp.",
        contextSchool: "Atlat Địa lí, bản đồ công nghiệp VN.",
        objectivesKnowledge: "Cơ cấu ngành công nghiệp and sự phân hóa lãnh thổ công nghiệp.",
        objectivesCompetency: "Đọc bản đồ công nghiệp.",
        objectivesQuality: "Hăng say lao động; Bảo vệ môi trường."
      },
      {
        topic: "Bài 15. Tổ chức lãnh thổ công nghiệp",
        duration: "1 tiết",
        contextStudents: "Học sinh biết về các khu công nghiệp, khu chế xuất.",
        contextSchool: "Lược đồ các khu công nghiệp Việt Nam.",
        objectivesKnowledge: "Các hình thức tổ chức: điểm, cụm, khu, trung tâm công nghiệp.",
        objectivesCompetency: "Phân tích mô hình tổ chức.",
        objectivesQuality: "Tư duy khoa học."
      },
      {
        topic: "Bài 16. Thực hành: Tìm hiểu sự phát triển và phân bố một số ngành công nghiệp",
        duration: "1 tiết",
        contextStudents: "Học sinh làm báo cáo về một ngành công nghiệp cụ thể.",
        contextSchool: "Tài liệu về ngành công nghiệp điện lực/thực phẩm.",
        objectivesKnowledge: "Nắm vững thực trạng and phân bố ngành đã chọn.",
        objectivesCompetency: "Viết báo cáo chuyên đề.",
        objectivesQuality: "Trung thực; Chăm chỉ."
      },
      {
        topic: "Bài 17. Vấn đề phát triển ngành dịch vụ",
        duration: "2 tiết",
        contextStudents: "Học sinh thấy được sự năng động của ngành dịch vụ.",
        contextSchool: "Bản đồ giao thông, thương mại, du lịch VN.",
        objectivesKnowledge: "Thực trạng and phân bố ngành GTVT, thông tin liên lạc, thương mại, du lịch.",
        objectivesCompetency: "Vận dụng kiến thức vào tiêu dùng, du lịch.",
        objectivesQuality: "Giao tiếp; Văn hóa dịch vụ."
      },
      {
        topic: "Bài 18. Thực hành: Tìm hiểu thực tế một số hoạt động dịch vụ tại địa phương",
        duration: "1 tiết",
        contextStudents: "Học sinh tìm hiểu về chợ, siêu thị and bưu điện gần nhà.",
        contextSchool: "Máy ảnh, phiếu phỏng vấn.",
        objectivesKnowledge: "Mô tả được hoạt động dịch vụ tại nơi cư trú.",
        objectivesCompetency: "Khảo sát thực địa.",
        objectivesQuality: "Yêu quê hương; Năng động."
      },
      {
        topic: "Bài 19. Khai thác thế mạnh ở Trung du và miền núi phía Bắc",
        duration: "2 tiết",
        contextStudents: "Học sinh tìm hiểu vùng giàu khoáng sản and thủy điện nhất.",
        contextSchool: "Atlat Địa lí, bản đồ kinh tế miền Bắc.",
        objectivesKnowledge: "Thế mạnh về thủy điện, khoáng sản, cây công nghiệp cận nhiệt.",
        objectivesCompetency: "Đánh giá lợi thế so sánh vùng.",
        objectivesQuality: "Bảo vệ môi trường vùng cao."
      },
      {
        topic: "Bài 20. Phát triển kinh tế - xã hội ở Đồng bằng sông Hồng",
        duration: "2 tiết",
        contextStudents: "Học sinh tìm hiểu về vùng trọng điểm lương thực and dân cư.",
        contextSchool: "Bản đồ kinh tế ĐBSH.",
        objectivesKnowledge: "Vấn đề chuyển dịch cơ cấu kinh tế theo ngành and không gian.",
        objectivesCompetency: "Phân tích mối quan hệ giữa dân cư and kinh tế.",
        objectivesQuality: "Giữ gìn truyền thống văn hóa."
      },
      {
        topic: "Bài 21. Thực hành: Tìm hiểu về các vùng kinh tế trọng điểm",
        duration: "1 tiết",
        contextStudents: "Học sinh xác định được 'đầu tàu' kinh tế.",
        contextSchool: "Bản đồ các vùng kinh tế trọng điểm VN.",
        objectivesKnowledge: "Vai trò and thực trạng của các vùng kinh tế trọng điểm.",
        objectivesCompetency: "So sánh các chỉ số kinh tế.",
        objectivesQuality: "Tinh thần cống hiến."
      },
      {
        topic: "Bài 17. Thương mại và du lịch",
        duration: "2 tiết",
        contextStudents: "Học sinh quan tâm đến thương mại điện tử và du lịch xanh.",
        contextSchool: "Bản đồ thương mại và du lịch; video các thắng cảnh.",
        objectivesKnowledge: "Trình bày được sự phát triển và phân hóa lãnh thổ ngành thương mại, du lịch ở Việt Nam.",
        objectivesCompetency: "Phân tích sự phân hóa lãnh thổ; Sử dụng bản đồ.",
        objectivesQuality: "Quảng bá hình ảnh đất nước; Trách nhiệm bền vững."
      },
      {
        topic: "Bài 18. Thực hành: Tìm hiểu thực tế về một số hoạt động và sản phẩm dịch vụ của địa phương",
        duration: "1 tiết",
        contextStudents: "Học sinh đi thực tế hoặc phỏng vấn tại địa phương.",
        contextSchool: "Phiếu khảo sát, máy ghi âm/chụp hình.",
        objectivesKnowledge: "Viết được đoạn văn giới thiệu, quảng bá sản phẩm dịch vụ độc đáo của địa phương.",
        objectivesCompetency: "Thu thập thực tế; Kỹ năng truyền đạt thông tin.",
        objectivesQuality: "Tự hào quê hương; Sáng tạo."
      },
      {
        topic: "Bài 19. Khai thác thế mạnh ở Trung du và miền núi phía Bắc",
        duration: "2 tiết",
        contextStudents: "Học sinh tìm hiểu về vùng có tiềm năng khai khoáng lớn nhất.",
        contextSchool: "Atlat Địa lí VN, bản đồ vùng TDMNPB.",
        objectivesKnowledge: "Phân tích được vị trí, thế mạnh và thực trạng khai thác tài nguyên, thủy điện, cây công nghiệp đặc thù.",
        objectivesCompetency: "Sử dụng bản đồ phân tích; Nhận thức đặc điểm vùng.",
        objectivesQuality: "Trách nhiệm bảo vệ môi trường vùng núi."
      },
      {
        topic: "Bài 20. Phát triển kinh tế - xã hội ở Đồng bằng sông Hồng",
        duration: "3 tiết",
        contextStudents: "Học sinh tìm hiểu về tâm điểm phát triển của miền Bắc.",
        contextSchool: "Atlat Địa lí VN, trang bản đồ vùng ĐBSH.",
        objectivesKnowledge: "Phân tích thế mạnh, hạn chế và thực trạng phát triển công nghiệp, dịch vụ, kinh tế biển của vùng.",
        objectivesCompetency: "Xác định vị trí giới hạn; Phân tích vấn đề phát triển vùng.",
        objectivesQuality: "Bảo tồn văn hóa; Tư duy bền vững."
      },
      {
        topic: "Bài 21. Phát triển kinh tế - xã hội ở Bắc Trung Bộ",
        duration: "2 tiết",
        contextStudents: "Học sinh tìm hiểu về vùng eo đất miền Trung.",
        contextSchool: "Bản đồ kinh tế vùng Bắc Trung Bộ.",
        objectivesKnowledge: "Phân tích đặc điểm vị trí, thế mạnh và hạn chế trong phát triển nông, lâm, thủy sản và du lịch vùng.",
        objectivesCompetency: "Nhận xét cơ cấu nông-lâm-ngư; Sử dụng bản đồ.",
        objectivesQuality: "Yêu quê hương; Tinh thần vượt khó."
      },
      {
        topic: "Bài 22+23. Phát triển kinh tế - xã hội ở Nam Trung Bộ",
        duration: "5 tiết",
        contextStudents: "Học sinh tìm hiểu về vùng biển xanh, cát trắng và kinh tế biển.",
        contextSchool: "Atlat Địa lí VN, bản đồ vùng Nam Trung Bộ.",
        objectivesKnowledge: "Phân tích thế mạnh, định hướng phát triển tổng hợp kinh tế biển; công nghiệp và dịch vụ của vùng.",
        objectivesCompetency: "Phân tích KT-XH vùng; Vận dụng bảo vệ biển đảo.",
        objectivesQuality: "Ý thức bảo vệ chủ quyền; Trách nhiệm."
      },
      {
        topic: "Bài 24. Phát triển kinh tế - xã hội ở Đông Nam Bộ",
        duration: "2 tiết",
        contextStudents: "Học sinh sống tại vùng kinh tế năng động nhất VN.",
        contextSchool: "Bản đồ kinh tế vùng Đông Nam Bộ.",
        objectivesKnowledge: "Phân tích vị trí, thế mạnh và thực trạng phát triển công nghiệp, dịch vụ và kinh tế biển của vùng.",
        objectivesCompetency: "Vận dụng bản đồ ôn tập; Hệ thống hóa kiến thức.",
        objectivesQuality: "Chăm chỉ; Tinh thần năng động."
      },
      {
        topic: "Bài 25. Sử dụng hợp lí tự nhiên để phát triển kinh tế ở Đồng bằng sông Cửu Long",
        duration: "2 tiết",
        contextStudents: "Học sinh tìm hiểu về vựa lúa và an ninh lương thực.",
        contextSchool: "Bản đồ Tự nhiên và Kinh tế ĐBSCL.",
        objectivesKnowledge: "Trình bày vị trí, đặc điểm dân sô; Chứng minh thế mạnh và giải thích tại sao phải sử dụng hợp lí tự nhiên vùng.",
        objectivesCompetency: "Sử dụng bản đồ; Giải thích thực trạng; Nhận xét kinh tế-xã hội.",
        objectivesQuality: "Trách nhiệm với môi trường nước."
      },
      {
        topic: "Bài 26. Thực hành: Tìm hiểu ảnh hưởng của biến đổi khí hậu đối với Đồng bằng sông Cửu Long và các giải pháp ứng phó",
        duration: "1 tiết",
        contextStudents: "Học sinh nhận thức rõ nguy cơ xâm nhập mặn.",
        contextSchool: "Tư liệu về BĐKH, internet.",
        objectivesKnowledge: "Thu thập tài liệu và viết báo cáo về ảnh hưởng BĐKH đối với ĐBSCL; đề xuất giải pháp.",
        objectivesCompetency: "Tìm kiếm xử lý thông tin; Giao tiếp hợp tác; GQVĐ thực tiễn.",
        objectivesQuality: "Trách nhiệm cao với môi trường."
      },
      {
        topic: "Bài 28. Phát triển kinh tế và đảm bảo an ninh quốc phòng ở Biển Đông và các đảo, quần đảo",
        duration: "2 tiết",
        contextStudents: "Học sinh nhận thức rõ chủ quyền biển đảo Tây Sa, Trường Sa.",
        contextSchool: "Bản đồ Biển Đông; phim tư liệu quốc phòng.",
        objectivesKnowledge: "Khái quát Biển Đông; chứng minh vùng biển giàu tài nguyên; Ý nghĩa chiến lược biển đảo với KH-XH và ANQP.",
        objectivesCompetency: "Sử dụng bản đồ (Biển Đông); Phân tích đánh giá dữ liệu.",
        objectivesQuality: "Lòng yêu nước đặc biệt là chủ quyền biển đảo."
      },
      {
        topic: "Bài 29. Thực hành: Viết và trình bày báo cáo tuyên truyền về bảo vệ chủ quyền biển đảo của Việt Nam",
        duration: "1 tiết",
        contextStudents: "Học sinh thực hiện dự án truyền thông sáng tạo.",
        contextSchool: "Công cụ thiết kế (Canva), internet.",
        objectivesKnowledge: "Thu thập tài liệu; thiết kế và trình bày báo cáo tuyên truyền bảo vệ chủ quyền biển đảo.",
        objectivesCompetency: "Thu thập xử lý thông tin; Sáng tạo trong thiết kế và thuyết trình.",
        objectivesQuality: "Ý thức trách nhiệm cao; Trung thực."
      },
      {
        topic: "Bài 30. Thực hành: Tìm hiểu địa lí địa phương",
        duration: "2 tiết",
        contextStudents: "Học sinh tìm hiểu về tỉnh/thành phố mình đang sống.",
        contextSchool: "Atlat địa phương, tài liệu kinh tế-xã hội tỉnh.",
        objectivesKnowledge: "Trình bày vị trí, phạm vi lãnh thổ và các đặc điểm tự nhiên, dân cư tiêu biểu của địa phương.",
        objectivesCompetency: "Phân tích lược đồ/biểu đồ địa phương; Kỹ năng thu thập liên hệ thực tế.",
        objectivesQuality: "Yêu quê hương; Trách nhiệm phát triển vùng."
      }
    ]
  },
  "Tiếng Anh": {
    "10": [
      {
        topic: "Unit 1. Family Life",
        duration: "7 tiết",
        contextStudents: "Học sinh hiểu về vai trò của các thành viên trong gia đình.",
        contextSchool: "Phòng học ngoại ngữ, Cassette, băng đĩa.",
        objectivesKnowledge: "Learn about vocabulary related to family life; Use present simple vs. present continuous; Read about benefits of doing housework.",
        objectivesCompetency: "Communication; Collaboration; Critical thinking.",
        objectivesQuality: "Responsibility; Loving family."
      },
      {
        topic: "Unit 2. Humans and the Environment",
        duration: "7 tiết",
        contextStudents: "Học sinh có ý thức bảo vệ môi trường, quan tâm đến lối sống xanh.",
        contextSchool: "Máy tính, máy chiếu, hình ảnh về môi trường.",
        objectivesKnowledge: "Learn about vocabulary related to Humans and the environment; Use the future with will and be going to; passive voice.",
        objectivesCompetency: "Problem solving; Autonomy.",
        objectivesQuality: "Responsibility; Environmental protection."
      },
      {
        topic: "Unit 3. Music",
        duration: "7 tiết",
        contextStudents: "Học sinh yêu thích âm nhạc và các chương trình thực tế.",
        contextSchool: "Hệ thống loa, tivi kết nối internet.",
        objectivesKnowledge: "Learn about vocabulary related to the topic Music; Use compound sentences; To-infinitive and bare infinitives.",
        objectivesCompetency: "Aesthetic competence; Communication.",
        objectivesQuality: "Appreciation of art and culture."
      },
      {
        topic: "Unit 4. For a better community",
        duration: "7 tiết",
        contextStudents: "Học sinh chuẩn bị cho các hoạt động tình nguyện.",
        contextSchool: "Tài liệu học tập, các bài báo về tình nguyện viên.",
        objectivesKnowledge: "Learn about vocabulary related to community; Use past simple vs. past continuous with when and while.",
        objectivesCompetency: "Communication; Social awareness.",
        objectivesQuality: "Benevolence; Responsibility."
      },
      {
        topic: "Unit 5. Inventions",
        duration: "7 tiết",
        contextStudents: "Học sinh quan tâm đến công nghệ và trí tuệ nhân tạo.",
        contextSchool: "Máy tính, mô hình robot đơn giản.",
        objectivesKnowledge: "Learn about vocabulary related to inventions; Use the present perfect tense; Read about artificial intelligence.",
        objectivesCompetency: "ICT competence; Critical thinking.",
        objectivesQuality: "Creativity; Diligence."
      },
      {
        topic: "Unit 6. Gender equality",
        duration: "7 tiết",
        contextStudents: "Học sinh quan tâm đến công bằng xã hội và quyền bình đẳng.",
        contextSchool: "Tài liệu thảo luận, video về bình đẳng giới.",
        objectivesKnowledge: "Learn about vocabulary related to gender equality; Use passive voice with modal verbs.",
        objectivesCompetency: "Communication; Critical thinking.",
        objectivesQuality: "Justice; Respect."
      },
      {
        topic: "Unit 7. Viet Nam and international organisations",
        duration: "7 tiết",
        contextStudents: "Học sinh quan tâm đến vị trí của Việt Nam trên thế giới.",
        contextSchool: "Bản đồ thế giới, thông tin về WTO, UN, ASEAN.",
        objectivesKnowledge: "Learn about vocabulary related to international organisations; Use comparative and superlative adjectives.",
        objectivesCompetency: "International integration; Communication.",
        objectivesQuality: "National pride; Global mindset."
      },
      {
        topic: "Unit 8. New ways to learn",
        duration: "7 tiết",
        contextStudents: "Học sinh sử dụng công nghệ trong học tập.",
        contextSchool: "Máy tính, internet, ứng dụng học tập.",
        objectivesKnowledge: "Learn about vocabulary related to modern learning; Use relative clauses: who, which, that.",
        objectivesCompetency: "ICT competence; Self-study.",
        objectivesQuality: "Innovativeness; Diligence."
      },
      {
        topic: "Unit 9. Protecting the environment",
        duration: "7 tiết",
        contextStudents: "Học sinh hành động vì môi trường xanh.",
        contextSchool: "Tài liệu về bảo vệ môi trường, thực hành phân loại rác.",
        objectivesKnowledge: "Learn about vocabulary related to environment protection; Use reported speech.",
        objectivesCompetency: "Environmental management; Problem solving.",
        objectivesQuality: "Responsibility; Eco-friendly lifestyle."
      },
      {
        topic: "Unit 10. Ecotourism",
        duration: "7 tiết",
        contextStudents: "Học sinh thích khám phá thiên nhiên và du lịch bền vững.",
        contextSchool: "Cẩm nang du lịch, hình ảnh các khu du lịch sinh thái.",
        objectivesKnowledge: "Learn about vocabulary related to ecotourism; Use conditional sentences type 1 and 2.",
        objectivesCompetency: "Social awareness; Planning.",
        objectivesQuality: "Eco-consciousness; Cultural respect."
      }
    ],
    "11": [
      {
        topic: "Unit 1. A long and healthy life",
        duration: "7 tiết",
        contextStudents: "Học sinh quan tâm đến chế độ ăn uống và tập luyện.",
        contextSchool: "Phòng học đa năng, tranh ảnh về tháp dinh dưỡng.",
        objectivesKnowledge: "Understand vocabulary related to healthy life; Distinguish past simple vs. present perfect.",
        objectivesCompetency: "Self-care; Decision making.",
        objectivesQuality: "Healthy lifestyle; Discipline."
      },
      {
        topic: "Unit 2. Generational differences",
        duration: "7 tiết",
        contextStudents: "Học sinh gặp các vấn đền về khoảng cách thế hệ trong gia đình.",
        contextSchool: "Video về xung đột và hòa giải gia đình.",
        objectivesKnowledge: "Understand vocabulary related to generational differences; Apply modal verbs (should/must/have to).",
        objectivesCompetency: "Self-expression; Empathy.",
        objectivesQuality: "Respect; Harmony."
      },
      {
        topic: "Unit 3. Cities of the future",
        duration: "7 tiết",
        contextStudents: "Học sinh tò mò về cuộc sống hiện đại và bền vững.",
        contextSchool: "Video về các thành phố thông minh trên thế giới.",
        objectivesKnowledge: "Understand vocabulary related to smart cities; Use linking verbs and to-infinitive.",
        objectivesCompetency: "Visionary thinking; Planning.",
        objectivesQuality: "Responsibility; Sustainability mind-set."
      },
      {
        topic: "Unit 4. ASEAN and Viet Nam",
        duration: "7 tiết",
        contextStudents: "Học sinh muốn tìm hiểu về cơ hội hội nhập khu vực.",
        contextSchool: "Sơ đồ các quốc gia ASEAN.",
        objectivesKnowledge: "Understand vocabulary related to ASEAN; Use gerunds.",
        objectivesCompetency: "Cross-cultural communication; Political awareness.",
        objectivesQuality: "Patriotism; Cooperation."
      },
      {
        topic: "Unit 5. Global warming",
        duration: "7 tiết",
        contextStudents: "Học sinh trực tiếp trải nghiệm sự thay đổi thời tiết.",
        contextSchool: "Dữ liệu về nhiệt độ Trái Đất tăng dần.",
        objectivesKnowledge: "Understand vocabulary related to global warming; Use perfect participles in clauses.",
        objectivesCompetency: "Critical thinking; Environmental protection.",
        objectivesQuality: "Responsibility; Love for nature."
      },
      {
        topic: "Unit 6. Preserving our heritage",
        duration: "7 tiết",
        contextStudents: "Học sinh tự hào về các di sản văn hóa Việt Nam.",
        contextSchool: "Hình ảnh về các di sản thế giới tại VN.",
        objectivesKnowledge: "Understand vocabulary related to heritage; Use present participle and past participle clauses.",
        objectivesCompetency: "Cultural sensitivity; Presentation.",
        objectivesQuality: "Pride; Conservation mindset."
      },
      {
        topic: "Unit 7. Education options for school-leavers",
        duration: "7 tiết",
        contextStudents: "Học sinh chuẩn bị cho các lựa chọn sau lớp 12.",
        contextSchool: "Brochures các trường đại học, cao đẳng.",
        objectivesKnowledge: "Understand vocabulary related to higher education; Use perfect gerunds and perfect participles.",
        objectivesCompetency: "Decision making; Career planning.",
        objectivesQuality: "Ambition; Active learning."
      },
      {
        topic: "Unit 8. Becoming independent",
        duration: "7 tiết",
        contextStudents: "Học sinh mong muốn được tự lập.",
        contextSchool: "Case studies về kỹ năng sống.",
        objectivesKnowledge: "Understand vocabulary related to independence; Use cleft sentences.",
        objectivesCompetency: "Self-reliance; Social skills.",
        objectivesQuality: "Responsibility; Confidence."
      },
      {
        topic: "Unit 9. Social issues",
        duration: "7 tiết",
        contextStudents: "Học sinh thảo luận về bạo lực học đường, thất nghiệp.",
        contextSchool: "Các bài báo thời sự về vấn đề xã hội.",
        objectivesKnowledge: "Understand vocabulary related to social issues; Use relative clauses with prepositions.",
        objectivesCompetency: "Social awareness; Persuasion.",
        objectivesQuality: "Empathy; Integrity."
      },
      {
        topic: "Unit 10. The ecosystem",
        duration: "7 tiết",
        contextStudents: "Học sinh thích khám phá đa dạng sinh học.",
        contextSchool: "Mô hình hệ sinh thái vườn trường.",
        objectivesKnowledge: "Understand vocabulary related to ecosystems; Use reported speech with various structures.",
        objectivesCompetency: "Nature observation; Problem solving.",
        objectivesQuality: "Nature-loving; Responsibility."
      }
    ],
    "12": [
      {
        topic: "Unit 1. Life stories",
        duration: "7 tiết",
        contextStudents: "Học sinh quan tâm đến tiểu sử các vĩ nhân.",
        contextSchool: "Bộ ảnh các danh nhân thế giới.",
        objectivesKnowledge: "Vocabulary related to life stories; Use past simple and past continuous.",
        objectivesCompetency: "Narrating; Research.",
        objectivesQuality: "Inspiration; Persistence."
      },
      {
        topic: "Unit 2. A multiculural world",
        duration: "7 tiết",
        contextStudents: "Học sinh muốn tìm hiểu về các nền văn hóa khác nhau.",
        contextSchool: "Phòng học ngoại ngữ có internet.",
        objectivesKnowledge: "Vocabulary related to culture and traditions; Use articles.",
        objectivesCompetency: "Cross-cultural communication; Critical thinking.",
        objectivesQuality: "Cultural sensitivity; Open-mindedness."
      },
      {
        topic: "Unit 3. Green living",
        duration: "7 tiết",
        contextStudents: "Học sinh có ý thức bảo vệ môi trường.",
        contextSchool: "Thùng rác phân loại, thiết bị tiết kiệm điện.",
        objectivesKnowledge: "Vocabulary related to environment and green living; Use causative verbs.",
        objectivesCompetency: "Problem solving; Planning.",
        objectivesQuality: "Responsibility; Eco-consciousness."
      },
      {
        topic: "Unit 4. Urbanisation",
        duration: "7 tiết",
        contextStudents: "Học sinh sống ở các đô thị lớn.",
        contextSchool: "Biểu đồ phát triển đô thị.",
        objectivesKnowledge: "Vocabulary related to urbanisation; Use compound adjectives.",
        objectivesCompetency: "Critical thinking; Presentation.",
        objectivesQuality: "Adaptive spirit; Responsibility."
      },
      {
        topic: "Unit 5. The fourth industrial revolution",
        duration: "7 tiết",
        contextStudents: "Học sinh quan tâm đến AI và công nghệ 4.0.",
        contextSchool: "Máy tính, phòng thực hành STEM.",
        objectivesKnowledge: "Vocabulary related to technology; Use relative clauses.",
        objectivesCompetency: "Technological literacy; Innovation.",
        objectivesQuality: "Curiosity; Digital citizenship."
      },
      {
        topic: "Unit 6. Artificial intelligence",
        duration: "7 tiết",
        contextStudents: "Học sinh hào hứng với ChatGPT, Gemini và robot.",
        contextSchool: "Phòng máy tính có internet, trải nghiệm các chatbot AI.",
        objectivesKnowledge: "Understand vocabulary related to AI; Use various types of relative clauses; Compare human and artificial intelligence.",
        objectivesCompetency: "Technological literacy; Critical analysis; AI prompt engineering basics.",
        objectivesQuality: "Ethical mindset; Adaptability."
      },
      {
        topic: "Unit 7. Mass media",
        duration: "7 tiết",
        contextStudents: "Học sinh sử dụng mạng xã hội hàng ngày.",
        contextSchool: "Ví dụ về các chiến dịch truyền thông xã hội.",
        objectivesKnowledge: "Understand vocabulary related to mass media; Use reported speech with to-infinitive and gerund.",
        objectivesCompetency: "Media literacy; Communication.",
        objectivesQuality: "Critical thinking; Information ethics."
      },
      {
        topic: "Unit 8. Wildlife conservation",
        duration: "7 tiết",
        contextStudents: "Học sinh quan tâm đến bảo vệ động vật hoang dã.",
        contextSchool: "Tranh ảnh về các loài động vật có nguy cơ tuyệt chủng.",
        objectivesKnowledge: "Understand vocabulary related to wildlife; Use conditional sentences Type 2.",
        objectivesCompetency: "Environmental awareness; Research.",
        objectivesQuality: "Compassion; Environmental responsibility."
      },
      {
        topic: "Unit 9. Career paths",
        duration: "7 tiết",
        contextStudents: "Học sinh định hướng nghề nghiệp sau trung học.",
        contextSchool: "Tài liệu về các trường đại học, cao đẳng và nghề.",
        objectivesKnowledge: "Understand vocabulary related to careers; Use defining and non-defining relative clauses.",
        objectivesCompetency: "Career planning; Decision making.",
        objectivesQuality: "Ambition; Diligence."
      },
      {
        topic: "Unit 10. Lifelong learning",
        duration: "7 tiết",
        contextStudents: "Học sinh hiểu về tầm quan trọng của việc học tập suốt đời.",
        contextSchool: "Gương các nhân vật tự học thành công.",
        objectivesKnowledge: "Understand vocabulary related to learning; Use the past perfect and future perfect.",
        objectivesCompetency: "Learning to learn; Adaptability.",
        objectivesQuality: "Perseverance; Life-long learning mindset."
      }
    ]
  },
  "Giáo dục địa phương": {
    "10": [
      {
        topic: "Chủ đề 1. Biến đổi khí hậu và phòng, chống thiên tai ở Thành phố Hồ Chí Minh",
        duration: "5 tiết",
        contextStudents: "Học sinh nhận thức được tác động của biến đổi khí hậu tại địa phương.",
        contextSchool: "Phòng học có tivi/máy chiếu, internet.",
        objectivesKnowledge: "Trình bày được đặc điểm khí hậu địa phương; Biểu hiện của biến đổi khí hậu; Tác động và giải pháp ứng phó.",
        objectivesCompetency: "Thích ứng với biến đổi khí hậu; Giải quyết vấn đề địa phương.",
        objectivesQuality: "Trách nhiệm với môi trường; Tình yêu quê hương."
      },
      {
        topic: "Chủ đề 2. Đạo lí “Uống nước nhớ nguồn” qua các nghi lễ dân gian ở TP.HCM",
        duration: "5 tiết",
        contextStudents: "Học sinh hiểu về truyền thống tôn sư trọng đạo.",
        contextSchool: "Tài liệu về các lễ hội dân gian tại TP.HCM.",
        objectivesKnowledge: "Nêu được các nghi lễ dân gian tiêu biểu; Giải thích được ý nghĩa đạo lí; Đề xuất giải pháp bảo tồn.",
        objectivesCompetency: "Giao tiếp văn hóa; Thẩm mỹ nghệ thuật dân gian.",
        objectivesQuality: "Biết ơn; Trân trọng truyền thống."
      },
      {
        topic: "Chủ đề 3. Văn học dân gian Thành phố Hồ Chí Minh",
        duration: "6 tiết",
        contextStudents: "Học sinh yêu thích các câu chuyện kể, ca dao địa phương.",
        contextSchool: "Thư viện trường, các bản sưu tầm văn học dân gian.",
        objectivesKnowledge: "Nêu được các thể loại văn học dân gian địa phương; Phân tích giá trị nội dung và nghệ thuật.",
        objectivesCompetency: "Năng lực ngôn ngữ; Cảm thu văn học.",
        objectivesQuality: "Tình yêu tiếng Việt; Ý thức giữ gìn văn hóa."
      },
      {
        topic: "Chủ đề 4. Chân dung nhân vật nghệ thuật ở Thành phố Hồ Chí Minh",
        duration: "4 tiết",
        contextStudents: "Học sinh quan tâm đến các nghệ sĩ tiêu biểu của thành phố.",
        contextSchool: "Tư liệu về các nghệ sĩ, buổi giao lưu trực tuyến (nếu có).",
        objectivesKnowledge: "Kể tên và nêu đóng góp của các nhân vật nghệ thuật tiêu biểu; Phân tích phong cách nghệ thuật.",
        objectivesCompetency: "Đánh giá nghệ thuật; Tư duy phản biện.",
        objectivesQuality: "Tôn trọng sự sáng tạo; Biết ơn thế hệ đi trước."
      },
      {
        topic: "Chủ đề 5. Ô nhiễm môi trường ở Thành phố Hồ Chí Minh",
        duration: "6 tiết",
        contextStudents: "Học sinh thấy được thực trạng rác thải đô thị.",
        contextSchool: "Các báo cáo môi trường thành phố, video thực địa.",
        objectivesKnowledge: "Trình bày tình hình ô nhiễm môi trường tại TP.HCM; Phân tích nguyên nhân và hậu quả; Đề xuất giải pháp xanh.",
        objectivesCompetency: "Giải quyết vấn đề thực tiễn; Năng lực tự học.",
        objectivesQuality: "Trách nhiệm với môi trường sống."
      },
      {
        topic: "Chủ đề 6. Định hướng nghề nghiệp",
        duration: "3 tiết",
        contextStudents: "Học sinh lớp 10 bắt đầu suy nghĩ về nghề nghiệp tương lai.",
        contextSchool: "Thông tin về các ngành kinh tế trọng điểm của thành phố.",
        objectivesKnowledge: "Nhận biết các nhóm ngành nghề phát triển tại địa phương; Đánh giá mức độ phù hợp của bản thân.",
        objectivesCompetency: "Định hướng nghề nghiệp; Năng lực tự chủ.",
        objectivesQuality: "Chăm chỉ; Có kế hoạch cho tương lai."
      }
    ],
    "11": [
      {
        topic: "Chủ đề 1. Phát triển du lịch ở Thành phố Hồ Chí Minh",
        duration: "4 tiết",
        contextStudents: "Học sinh tự hào về các danh lam thắng cảnh địa phương.",
        contextSchool: "Bản đồ du lịch thành phố, cẩm nang du lịch.",
        objectivesKnowledge: "Nêu được thực trạng và tiềm năng phát triển du lịch; Đề xuất giải pháp quảng bá du lịch địa phương.",
        objectivesCompetency: "Giao tiếp; Marketing cơ bản; Lập kế hoạch du lịch.",
        objectivesQuality: "Yêu quê hương; Ý thức phát triển bền vững."
      },
      {
        topic: "Chủ đề 2. Danh nhân lịch sử của Thành phố Hồ Chí Minh",
        duration: "4 tiết",
        contextStudents: "Học sinh yêu thích tìm hiểu về các anh hùng dân tộc.",
        contextSchool: "Tư liệu lịch sử địa phương, tham quan bảo tàng.",
        objectivesKnowledge: "Nêu được tiểu sử và đóng góp của các danh nhân lịch sử tiêu biểu gắn liền với TP.HCM.",
        objectivesCompetency: "Tư duy lịch sử; Thu thập thông tin.",
        objectivesQuality: "Lòng tự hào; Biết ơn."
      },
      {
        topic: "Chủ đề 3. Văn học Thành phố Hồ Chí Minh trước năm 1975",
        duration: "4 tiết",
        contextStudents: "Học sinh muốn tìm hiểu về dòng chảy văn học đô thị.",
        contextSchool: "Các tác phẩm văn học tiêu biểu thời kỳ trước 1975.",
        objectivesKnowledge: "Trình bày được đặc điểm và các tác giả, tác phẩm tiêu biểu của văn học TP.HCM giai đoạn này.",
        objectivesCompetency: "Phân tích văn học; Tư duy lịch sử văn hóa.",
        objectivesQuality: "Trân trọng di sản tinh thần."
      },
      {
        topic: "Chủ đề 4. Âm nhạc trong đời sống hiện nay Thành phố Hồ Chí Minh",
        duration: "4 tiết",
        contextStudents: "Học sinh thường xuyên tiếp xúc với âm nhạc hiện đại.",
        contextSchool: "Phòng nhạc, thiết bị nghe nhìn.",
        objectivesKnowledge: "Nhận biết các xu hướng âm nhạc hiện nay; Đánh giá vai trò của âm nhạc trong đời sống tinh thần cộng đồng.",
        objectivesCompetency: "Cảm thụ âm nhạc; Thềm mỹ hiện đại.",
        objectivesQuality: "Lối sống lành mạnh; Yêu nghệ thuật."
      },
      {
        topic: "Chủ đề 5. Mĩ thuật truyền thống ở Thành phố Hồ Chí Minh",
        duration: "4 tiết",
        contextStudents: "Học sinh quan tâm đến kiến trúc cổ và làng nghề mĩ nghệ.",
        contextSchool: "Hình ảnh di tích kiến trúc mĩ thuật địa phương.",
        objectivesKnowledge: "Nêu được đặc trưng của mĩ thuật truyền thống tại TP.HCM thông qua các công trình tiêu biểu.",
        objectivesCompetency: "Quan sát; Đánh giá giá trị thẩm mỹ.",
        objectivesQuality: "Giữ gìn bản sắc."
      },
      {
        topic: "Chủ đề 6. Tác động của hoạt động kinh tế đến môi trường tự nhiên ở Thành phố Hồ Chí Minh",
        duration: "4 tiết",
        contextStudents: "Học sinh hiểu về mối quan hệ giữa công nghiệp và thiên nhiên.",
        contextSchool: "Số liệu về xả thải và các khu công nghiệp tập trung.",
        objectivesKnowledge: "Phân tích ảnh hưởng của các ngành kinh tế mũi nhọn đến môi trường tự nhiên; Đề xuất giải pháp giảm thiểu.",
        objectivesCompetency: "Tư duy hệ thống; Giải quyết vấn đề môi trường.",
        objectivesQuality: "Trách nhiệm xã hội; Phát triển xanh."
      },
      {
        topic: "Chủ đề 7. Giáo dục STEM và định hướng nghề nghiệp trong kỉ nguyên mới",
        duration: "4 tiết",
        contextStudents: "Học sinh yêu thích công nghệ và sáng tạo.",
        contextSchool: "Bộ kit STEM, phòng máy tính.",
        objectivesKnowledge: "Nhận biết vai trò của STEM trong các ngành nghề hiện đại; Thực hành dự án STEM giải quyết vấn đề địa phương.",
        objectivesCompetency: "Sáng tạo; Ứng dụng công nghệ; Làm việc nhóm.",
        objectivesQuality: "Kiên trì; Ham học hỏi."
      },
      {
        topic: "Chủ đề 8. Phong tục, luật tục và giáo dục pháp luật ở Thành phố Hồ Chí Minh",
        duration: "4 tiết",
        contextStudents: "Học sinh sống trong môi trường đa dạng văn hóa.",
        contextSchool: "Văn bản quy định địa phương, các câu chuyện luật tục.",
        objectivesKnowledge: "Nêu được nét đẹp trong phong tục và các quy định pháp luật đặc thù tại thành phố; Ý thức thượng tôn pháp luật.",
        objectivesCompetency: "Tuân thủ pháp luật; Kỹ năng sống cộng đồng.",
        objectivesQuality: "Trách nhiệm công dân; Kỷ luật."
      }
    ],
    "12": [
      {
        topic: "Chủ đề 1. Lao động và việc ở Thành phố Hồ Chí Minh",
        duration: "5 tiết",
        contextStudents: "Học sinh sắp tốt nghiệp, cần thông tin thị trường lao động.",
        contextSchool: "Dữ liệu việc làm thành phố, các trang web tuyển dụng.",
        objectivesKnowledge: "Trình bày được đặc điểm nguồn lao động; Xu hướng việc làm và nhu cầu nhân lực chất lượng cao tại thành phố.",
        objectivesCompetency: "Tự đánh giá năng lực; Lập kế hoạch nghề nghiệp.",
        objectivesQuality: "Chủ động; Trách nhiệm với nghề nghiệp."
      },
      {
        topic: "Chủ đề 2. Phát triển giao thông vận tải ở Thành phố Hồ Chí Minh",
        duration: "5 tiết",
        contextStudents: "Học sinh tham gia giao thông hàng ngày.",
        contextSchool: "Bản đồ giao thông thành phố, các dự án Metro.",
        objectivesKnowledge: "Phân tích thực trạng và định hướng phát triển mạng lưới giao thông; Ý thức xây dựng văn hóa giao thông đô thị.",
        objectivesCompetency: "Kỹ năng tham gia giao thông an toàn; Tư duy quy hoạch.",
        objectivesQuality: "Tuân thủ pháp luật; Văn minh đô thị."
      },
      {
        topic: "Chủ đề 3. Những thành tựu cơ bản và bài học kinh nghiệm trong công cuộc Đổi mới của Thành phố Hồ Chí Minh (1991 – nay)",
        duration: "3 tiết",
        contextStudents: "Học sinh tìm hiểu về lịch sử hiện đại của thành phố.",
        contextSchool: "Phim tư liệu về sự thay đổi diện mạo thành phố qua các thập kỷ.",
        objectivesKnowledge: "Nêu được các thành tựu nổi bật trên các lĩnh vực; Rút ra bài học về tinh thần năng động, sáng tạo của thành phố.",
        objectivesCompetency: "Tổng hợp kiến thức; Tư duy lịch sử hiện đại.",
        objectivesQuality: "Lòng tự hào; Khát vọng cống hiến."
      },
      {
        topic: "Chủ đề 4. Văn học Thành phố Hồ Chí Minh từ năm 1975",
        duration: "3 tiết",
        contextStudents: "Học sinh tiếp cận văn học đương đại.",
        contextSchool: "Các tác phẩm tiêu biểu của Hội Nhà văn thành phố.",
        objectivesKnowledge: "Trình bày diện mạo và các tác giả, tác phẩm tiêu biểu của văn học thành phố giai đoạn sau giải phóng.",
        objectivesCompetency: "Cảm thụ tác phẩm hiện đại; Đọc hiểu văn bản.",
        objectivesQuality: "Tâm hồn nhân hậu; Yêu tiếng Việt."
      },
      {
        topic: "Chủ đề 5. Một số loại hình nghệ thuật truyền thống ở Thành phố Hồ Chí Minh",
        duration: "4 tiết",
        contextStudents: "Học sinh quan tâm đến các loại hình nghệ thuật sân khấu.",
        contextSchool: "Tư liệu về các đoàn nghệ thuật truyền thống (Cải lương, hát bội...).",
        objectivesKnowledge: "Nhận biết và trân trọng các loại hình nghệ thuật đặc sắc của phương Nam gắn liền with thành phố.",
        objectivesCompetency: "Đánh giá giá trị văn hóa sân khấu; Thầm mỹ.",
        objectivesQuality: "Gìn giữ hồn cốt dân tộc."
      },
      {
        topic: "Chủ đề 6. Mĩ thuật ứng dụng hiện đại ở Thành phố Hồ Chí Minh",
        duration: "3 tiết",
        contextStudents: "Học sinh thích thiết kế đồ họa, thời trang.",
        contextSchool: "Các sản phẩm mĩ thuật ứng dụng thực tế.",
        objectivesKnowledge: "Trình bày sự phát triển mĩ thuật ứng dụng tại địa phương; Vai trò của thềm mỹ trong đời sống công nghiệp.",
        objectivesCompetency: "Sáng tạo mĩ thuật; Tư duy thiết kế.",
        objectivesQuality: "Yêu cái đẹp; Tôn trọng bản quyền."
      },
      {
        topic: "Chủ đề 7. Vai trò của lễ hội truyền thống tại Thành phố Hồ Chí Minh trong việc duy trì, phát huy các giá trị văn hoá dân tộc",
        duration: "4 tiết",
        contextStudents: "Học sinh thường đi lễ hội dịp Tết, lễ.",
        contextSchool: "Hình ảnh về các lễ hội lớn của thành phố (Lễ Nghinh Ông, Lễ hội chùa Bà...).",
        objectivesKnowledge: "Phân tích giá trị tích cực của lễ hội trong đời sống tinh thần; Đề xuất cách thức tổ chức văn minh.",
        objectivesCompetency: "Giao tiếp xã hội; Tổ chức hoạt động cộng đồng.",
        objectivesQuality: "Ý thức giữ gìn truyền thống; Văn minh."
      },
      {
        topic: "Chủ đề 8. Ý tưởng khởi nghiệp cho học sinh tại Thành phố Hồ Chí Minh",
        duration: "4 tiết",
        contextStudents: "Học sinh có tinh thần khởi nghiệp, sáng tạo.",
        contextSchool: "Các dự án khởi nghiệp trẻ thành công tại thành phố.",
        objectivesKnowledge: "Lập được ý tưởng khởi nghiệp dựa trên lợi thế địa phương; Hiểu quy trình khởi nghiệp cơ bản.",
        objectivesCompetency: "Năng lực khởi nghiệp; Giải quyết vấn đề; Quản lý tài chính.",
        objectivesQuality: "Tự tin; Dám nghĩ dám làm."
      }
    ]
  }
};

export default function App() {
  const [mode, setMode] = useState<AppMode>("dashboard");
  const [loading, setLoading] = useState(false);
  const [evaluationLoading, setEvaluationLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [evaluationResult, setEvaluationResult] = useState<any>(null);
  const [departmentPlanRef, setDepartmentPlanRef] = useState<any[] | null>(null);
  const [province, setProvince] = useState("TP. Hồ Chí Minh (Thành phố)");
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("GEMINI_API_KEY") || "");
  const [aiModel, setAiModel] = useState(() => localStorage.getItem("GEMINI_MODEL") || "gemini-3-flash-preview");
  const contentRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const [availableLessons, setAvailableLessons] = useState<any[]>([]);

  const handleSubjectOrGradeChange = (subject: string, grade: string) => {
    // Chỉ nạp dữ liệu từ DB nếu môn học không phải Giáo dục địa phương 
    // HOẶC nếu địa phương là TP.HCM (vì DB hiện tại chỉ có dữ liệu TP.HCM)
    const lessons = (subject === "Giáo dục địa phương" && province !== "TP. Hồ Chí Minh (Thành phố)")
      ? []
      : (CURRICULUM_DB[subject]?.[grade] || []);

    setAvailableLessons(lessons);
    setLessonPlanInput(prev => ({
      ...prev,
      subject,
      grade,
      topic: "",
      duration: "2 tiết",
      contextStudents: "",
      contextSchool: "",
      objectivesKnowledge: "",
      objectivesCompetency: "",
      objectivesQuality: "",
      additionalNotes: ""
    }));
  };

  const handleLessonSelect = (lessonTitle: string) => {
    const lesson = availableLessons.find(l => l.topic === lessonTitle);
    if (lesson) {
      setLessonPlanInput(prev => ({
        ...prev,
        ...lesson
      }));
    } else {
      setLessonPlanInput(prev => ({
        ...prev,
        topic: lessonTitle
      }));
    }
  };

  // Lesson Plan Form State
  const [lessonPlanInput, setLessonPlanInput] = useState<LessonPlanInput>({
    subject: "",
    grade: "10",
    topic: "",
    duration: "2 tiết",
    contextStudents: "",
    contextSchool: "",
    objectivesKnowledge: "",
    objectivesCompetency: "",
    objectivesQuality: "",
    additionalNotes: "",
    useLaTeX: false,
    detailDrawings: false
  });

  // Edu Plan Form State
  const [eduPlanInput, setEduPlanInput] = useState({
    subject: "",
    grade: "10",
    useLaTeX: false,
    detailDrawings: false
  });

  const highlightAI = (text: string) => {
    if (!text) return text;
    const parts = text.split(/(<bold>.*?<\/bold>|<ai>.*?<\/ai>|\*\*.*?\*\*|AI|Trí tuệ nhân tạo|Prompt|ChatGPT|Gemini)/gi);
    return parts.map((part, i) => {
      if (/^<bold>(.*)<\/bold>$/i.test(part)) return <span key={i} className="font-extrabold">{part.replace(/<bold>|<\/bold>/gi, '')}</span>;
      if (/^<ai>(.*)<\/ai>$/i.test(part)) return <span key={i} className="text-red-600 font-bold">{part.replace(/<ai>|<\/ai>/gi, '')}</span>;
      if (/^\*\*(.*?)\*\*$/i.test(part)) return <span key={i} className="font-bold">{part.replace(/\*\*/g, '')}</span>;
      if (/^(AI|Trí tuệ nhân tạo|Prompt|ChatGPT|Gemini)$/i.test(part)) return <span key={i} className="text-red-500 font-bold">{part}</span>;
      return part;
    });
  };

  const saveApiKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem("GEMINI_API_KEY", apiKey.trim());
      localStorage.setItem("GEMINI_MODEL", aiModel);
      setShowSettings(false);
      alert("Đã lưu Cài đặt thành công!");
    } else {
      localStorage.removeItem("GEMINI_API_KEY");
      setApiKey("");
      alert("Đã xóa API Key!");
    }
  };

  const handleGenerateKHBD = async () => {
    if (!apiKey.trim()) {
      alert("Vui lòng lấy API key để sử dụng app!");
      setShowSettings(true);
      return;
    }
    setLoading(true);
    setResult(null);
    setEvaluationResult(null);
    try {
      const data = await generateLessonPlan(lessonPlanInput);
      setResult({ type: "khbd", data });
    } catch (err) {
      alert("Có lỗi xảy ra khi tạo kế hoạch bài dạy. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateEvaluation = async () => {
    if (!apiKey.trim()) {
      setShowSettings(true);
      return;
    }
    if (!result || result.type !== "khbd") return;
    setEvaluationLoading(true);
    try {
      const data = await generateCompetencyEvaluation(result.data);
      setEvaluationResult(data);
    } catch (err) {
      alert("Có lỗi xảy ra khi tạo hệ thống đánh giá. Vui lòng thử lại.");
    } finally {
      setEvaluationLoading(false);
    }
  };

  const handleGenerateKHGD = async (customRef?: any[]) => {
    if (!apiKey.trim()) {
      setShowSettings(true);
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const activeRef = customRef || (departmentPlanRef && departmentPlanRef[0]?.subject === eduPlanInput.subject && departmentPlanRef[0]?.grade === eduPlanInput.grade ? departmentPlanRef : null);
      const data = await generateEducationalPlan(eduPlanInput.subject, eduPlanInput.grade, province, activeRef || undefined, { useLaTeX: eduPlanInput.useLaTeX, detailDrawings: eduPlanInput.detailDrawings });
      setResult({ type: "khgd", data });
    } catch (err) {
      alert("Có lỗi xảy ra khi tạo kế hoạch giáo dục. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateKHTCM = async () => {
    if (!apiKey.trim()) {
      setShowSettings(true);
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const data = await generateDepartmentPlan(eduPlanInput.subject, eduPlanInput.grade, province, { useLaTeX: eduPlanInput.useLaTeX, detailDrawings: eduPlanInput.detailDrawings });
      setResult({ type: "kh-tcm", data });
      setDepartmentPlanRef(data);
    } catch (err) {
      alert("Có lỗi xảy ra khi tạo kế hoạch tổ chuyên môn. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(result.data, null, 2));
    alert("Đã sao chép vào bộ nhớ tạm!");
  };

  const downloadPDF = () => {
    const element = result.type === "khbd" ? contentRef.current : tableRef.current;
    if (!element) return;

    // Use a small timeout to ensure DOM is fully rendered
    setTimeout(() => {
      const opt = {
        margin: [10, 10, 10, 10] as [number, number, number, number],
        filename: `${result.type.toUpperCase()}_${lessonPlanInput.subject || eduPlanInput.subject}_Lop${lessonPlanInput.grade || eduPlanInput.grade}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          letterRendering: true
        },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: (result.type === "kh-tcm" ? 'landscape' : 'portrait') as 'landscape' | 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };

      html2pdf().from(element).set(opt).save().catch((err: any) => {
        console.error("PDF generation error:", err);
        alert("Có lỗi xảy ra khi tạo PDF. Vui lòng thử lại hoặc sử dụng tính năng In (Tới PDF).");
      });
    }, 100);
  };

  const downloadWord = async () => {
    if (!result || !result.data) return;

    const currentSubject = lessonPlanInput.subject || eduPlanInput.subject;
    const isEnglish = currentSubject === "Tiếng Anh" || currentSubject.toLowerCase().includes("english");

    const t = (text: string) => {
      if (!isEnglish) return text;
      const dict: Record<string, string> = {
        "KẾ HOẠCH BÀI DẠY (KHBD)": "LESSON PLAN",
        "Tên bài dạy:": "Lesson topic:",
        "I. MỤC TIÊU": "I. OBJECTIVES",
        "1. Kiến thức:": "1. Knowledge:",
        "2. Năng lực môn học:": "2. Subject-Specific Competencies:",
        "3. Năng lực AI:": "3. AI Competencies:",
        "4. Năng lực chung:": "4. General Competencies:",
        "5. Phẩm chất:": "5. Core Qualities:",
        "II. THIẾT BỊ DẠY HỌC VÀ HỌC LIỆU": "II. TEACHING AIDS & MATERIALS",
        "1. Thiết bị truyền thống:": "1. Traditional Aids:",
        "2. CÔNG CỤ SỐ AI:": "2. DIGITAL & AI TOOLS:",
        "Phương án triển khai:": "Implementation Method:",
        "Học liệu/công cụ cụ thể:": "Specific Tools:",
        "III. TIẾN TRÌNH DẠY HỌC": "III. TEACHING PROCEDURE",
        "a) Mục tiêu:": "a) Objectives:",
        "b) Nội dung:": "b) Content:",
        "c) Sản phẩm:": "c) Product:",
        "d) Tổ chức thực hiện:": "d) Execution Organization:",
        "IV. KẾ HOẠCH ĐÁNH GIÁ": "IV. ASSESSMENT PLAN",
        "V. PHỤ LỤC": "V. APPENDIX",
        "Hoạt động của GV và HS:": "Teacher & Student Activities:",
        "Dự kiến sản phẩm:": "Expected Product:",
        "Mẫu Prompt:": "Prompt Template:",
        "Bảng kiểm:": "Checklist:",
        "Thứ tự tiết": "Period",
        "Bài học": "Topic",
        "Số tiết": "Duration",
        "Thời điểm": "Timing",
        "Thiết bị": "Equipment",
        "Địa điểm": "Location",
        "Định hướng năng lực số": "Digital Competency",
        "KẾ HOẠCH GIÁO DỤC CỦA GIÁO VIÊN": "TEACHER'S EDUCATIONAL PLAN",
        "Môn:": "Subject:",
        "Lớp:": "Grade:",
        "TRUYỀN THỐNG:": "TRADITIONAL:",
        "CÔNG CỤ SỐ AI:": "DIGITAL & AI TOOLS:",
        "STT": "No.",
        "Tên bài học/Chủ đề": "Topic/Theme",
        "Mục tiêu bài học": "Lesson Goal",
        "Tiết": "Period",
        "Năng lực AI": "AI Competency",
        "Mục tiêu GD AI": "AI Edu Goal",
        "Hình thức triển khai": "Implementation Form",
        "KẾ HOẠCH GIÁO DỤC TỔ CHUYÊN MÔN TÍCH HỢP AI": "DEPARTMENTAL EDUCATIONAL PLAN WITH AI",
        "Căn cứ QĐ 3439/QĐ-BGDĐT": "Based on Decision 3439/QĐ-BGDĐT"
      };
      return dict[text] || text;
    };

    const parseMarkdownToTextRunsDocx = (text: string) => {
      if (!text) return [new TextRun({ text: "" })];
      const parts = text.split(/(<bold>.*?<\/bold>|<ai>.*?<\/ai>|\*\*.*?\*\*)/g);
      return parts.filter(p => p).map(part => {
        if (part.startsWith('<bold>') && part.endsWith('</bold>')) {
          return new TextRun({ text: part.slice(6, -7), bold: true });
        } else if (part.startsWith('<ai>') && part.endsWith('</ai>')) {
          return new TextRun({ text: part.slice(4, -5), color: "FF0000", bold: true });
        } else if (part.startsWith('**') && part.endsWith('**')) {
          return new TextRun({ text: part.slice(2, -2), bold: true });
        }
        return new TextRun({ text: part });
      });
    };

    const fileName = `${result.type.toUpperCase()}_${currentSubject}_Lop${lessonPlanInput.grade || eduPlanInput.grade}.docx`;

    let doc;

    if (result.type === "khbd") {
      const d = result.data;
      doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              children: [new TextRun({ text: t("KẾ HOẠCH BÀI DẠY (KHBD)"), bold: true, size: 28 })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [new TextRun({ text: `${t("Tên bài dạy:")} ${d.title}`, bold: true, size: 24 })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),

            new Paragraph({ children: [new TextRun({ text: t("I. MỤC TIÊU"), bold: true, size: 24 })], spacing: { before: 200, after: 100 } }),
            new Paragraph({ children: [new TextRun({ text: t("1. Kiến thức:"), bold: true })] }),
            ...d.objectives.knowledge.map((c: string) => new Paragraph({ children: [new TextRun({ text: `- ${c}` })], indent: { left: 720 } })),

            new Paragraph({ children: [new TextRun({ text: t("2. Năng lực môn học:"), bold: true })], spacing: { before: 100 } }),
            ...d.objectives.subjectSpecific.map((c: string) => new Paragraph({ children: [new TextRun({ text: `- ${c}` })], indent: { left: 720 } })),

            new Paragraph({ children: [new TextRun({ text: t("3. Năng lực AI:"), bold: true, color: "FF0000" })], spacing: { before: 100 } }),
            ...d.objectives.aiSpecific.map((c: string) => new Paragraph({ children: [new TextRun({ text: `- ${c}`, color: "FF0000" })], indent: { left: 720 } })),

            new Paragraph({ children: [new TextRun({ text: t("4. Năng lực chung:"), bold: true })], spacing: { before: 100 } }),
            ...d.objectives.general.map((c: string) => new Paragraph({ children: [new TextRun({ text: `- ${c}` })], indent: { left: 720 } })),

            new Paragraph({ children: [new TextRun({ text: t("5. Phẩm chất:"), bold: true })], spacing: { before: 100 } }),
            ...d.objectives.qualities.map((q: string) => new Paragraph({ children: [new TextRun({ text: `- ${q}` })], indent: { left: 720 } })),

            new Paragraph({ children: [new TextRun({ text: t("II. THIẾT BỊ DẠY HỌC VÀ HỌC LIỆU"), bold: true, size: 24 })], spacing: { before: 200, after: 100 } }),
            new Paragraph({ children: [new TextRun({ text: t("1. Thiết bị truyền thống:"), bold: true })] }),
            new Paragraph({ children: [new TextRun({ text: d.materials.traditional.join(", ") })], indent: { left: 720 } }),

            new Paragraph({ children: [new TextRun({ text: t("2. CÔNG CỤ SỐ AI:"), bold: true, color: "FF0000" })], spacing: { before: 100 } }),
            new Paragraph({ children: [new TextRun({ text: `${t("Phương án triển khai:")} ${d.materials.digitalAndAI.implementationMethod}`, color: "FF0000", italics: true })], indent: { left: 720 } }),
            new Paragraph({ children: [new TextRun({ text: `${t("Học liệu/công cụ cụ thể:")} ${d.materials.digitalAndAI.specificTools.join(", ")}`, color: "FF0000" })], indent: { left: 720 } }),

            new Paragraph({ children: [new TextRun({ text: t("III. TIẾN TRÌNH DẠY HỌC"), bold: true, size: 24 })], spacing: { before: 200, after: 100 } }),
            ...d.activities.flatMap((a: any) => [
              new Paragraph({ children: [new TextRun({ text: a.name, bold: true })], spacing: { before: 200 } }),
              new Paragraph({ children: [new TextRun({ text: `${t("a) Mục tiêu:")} ${a.objective}` })], indent: { left: 360 } }),
              new Paragraph({ children: [new TextRun({ text: `${t("b) Nội dung:")} ${a.content}` })], indent: { left: 360 } }),
              new Paragraph({ children: [new TextRun({ text: `${t("c) Sản phẩm:")} ${a.product}` })], indent: { left: 360 } }),
              new Paragraph({ children: [new TextRun({ text: t("d) Tổ chức thực hiện:") })], indent: { left: 360 } }),
              ...a.procedure.flatMap((p: any) => [
                new Paragraph({ children: [new TextRun({ text: p.stepName, bold: true })], indent: { left: 720 }, spacing: { before: 100 } }),
                new Paragraph({ children: [new TextRun({ text: t("Hoạt động của GV và HS:"), bold: true })], indent: { left: 1080 } }),
                new Paragraph({ children: parseMarkdownToTextRunsDocx(p.teacherStudentActivities), indent: { left: 1080 } }),
                new Paragraph({ children: [new TextRun({ text: t("Dự kiến sản phẩm:"), bold: true })], indent: { left: 1080 } }),
                new Paragraph({ children: parseMarkdownToTextRunsDocx(p.expectedProduct), indent: { left: 1080 } })
              ])
            ]),

            new Paragraph({ children: [new TextRun({ text: t("IV. KẾ HOẠCH ĐÁNH GIÁ"), bold: true, size: 24 })], spacing: { before: 200, after: 100 } }),
            ...d.assessment.flatMap((a: string) => a.split('\n').filter((l: string) => l.trim()).map((line: string) => new Paragraph({ children: parseMarkdownToTextRunsDocx(`- ${line.trim()}`), indent: { left: 720 } }))),

            new Paragraph({ children: [new TextRun({ text: t("V. PHỤ LỤC"), bold: true, size: 24 })], spacing: { before: 200, after: 100 } }),
            new Paragraph({ children: [new TextRun({ text: `${t("Mẫu Prompt:")} ${d.appendix.prompts.join(", ")}` })] }),
            new Paragraph({ children: [new TextRun({ text: t("Bảng kiểm:"), bold: true })] }),
            ...d.appendix.checklist.flatMap((c: string) => c.split('\n').filter((l: string) => l.trim()).map((line: string) => new Paragraph({ children: parseMarkdownToTextRunsDocx(`- ${line.trim()}`), indent: { left: 720 } })))
          ]
        }]
      });
    } else if (result.type === "khgd") {
      const rows = [
        new TableRow({
          children: [
            t("Thứ tự tiết"), t("Bài học"), t("Số tiết"), t("Thời điểm"), t("Thiết bị"), t("Địa điểm"), t("Định hướng năng lực số")
          ].map(h => new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })], alignment: AlignmentType.CENTER })],
            verticalAlign: VerticalAlign.CENTER,
            shading: { fill: "F1F5F9" }
          }))
        }),
        ...result.data.map((item: any) => new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ text: String(item.order), alignment: AlignmentType.CENTER })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.lesson, bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ text: String(item.periods), alignment: AlignmentType.CENTER })] }),
            new TableCell({ children: [new Paragraph({ text: String(item.timing) })] }),
            new TableCell({
              children: [
                new Paragraph({ children: [new TextRun({ text: t("TRUYỀN THỐNG:"), bold: true, size: 16 })] }),
                new Paragraph({ children: [new TextRun({ text: item.equipment, italics: true, size: 16 })] }),
                new Paragraph({ children: [new TextRun({ text: "" })], spacing: { before: 100 } }),
                new Paragraph({ children: [new TextRun({ text: t("CÔNG CỤ SỐ AI:"), bold: true, color: "FF0000", size: 16 })] }),
                new Paragraph({ children: [new TextRun({ text: `- Phương án: ${item.digitalToolsAndAI?.method}`, color: "FF0000", italics: true, size: 16 })] }),
                new Paragraph({ children: [new TextRun({ text: `- Công cụ: ${item.digitalToolsAndAI?.tools}`, color: "FF0000", size: 16 })] }),
              ]
            }),
            new TableCell({ children: [new Paragraph({ text: String(item.location) })] }),
            new TableCell({ children: [new Paragraph({ text: String(item.digitalCompetency) })] }),
          ]
        }))
      ];

      doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              children: [new TextRun({ text: t("KẾ HOẠCH GIÁO DỤC CỦA GIÁO VIÊN"), bold: true, size: 28 })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [new TextRun({ text: `${t("Môn:")} ${eduPlanInput.subject} - ${t("Lớp:")} ${eduPlanInput.grade}`, size: 24 })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: rows
            })
          ]
        }]
      });
    } else if (result.type === "kh-tcm") {
      const rows = [
        new TableRow({
          children: [
            t("STT"), t("Tên bài học/Chủ đề"), t("Mục tiêu bài học"), t("Tiết"), t("Năng lực AI"), t("Mục tiêu GD AI"), t("Hình thức triển khai")
          ].map(h => new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })], alignment: AlignmentType.CENTER })],
            verticalAlign: VerticalAlign.CENTER,
            shading: { fill: "F1F5F9" }
          }))
        }),
        ...result.data.map((item: any, i: number) => new TableRow({
          children: [
            i + 1, item.lessonName, item.lessonGoal, item.periods, item.aiCompetency, item.aiObjective, item.implementationForm
          ].map(v => new TableCell({ children: [new Paragraph({ text: String(v) })] }))
        }))
      ];

      doc = new Document({
        sections: [{
          properties: { page: { size: { orientation: "landscape" as any } } },
          children: [
            new Paragraph({
              children: [new TextRun({ text: t("KẾ HOẠCH GIÁO DỤC TỔ CHUYÊN MÔN TÍCH HỢP AI"), bold: true, size: 28 })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [new TextRun({ text: `${t("Môn:")} ${eduPlanInput.subject} - ${t("Lớp:")} ${eduPlanInput.grade}`, size: 24 })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: rows
            })
          ]
        }]
      });
    }

    if (doc) {
      const blob = await Packer.toBlob(doc);
      saveAs(blob, fileName);
    }
  };

  const downloadText = () => {
    let content = "";

    const currentSubject = lessonPlanInput.subject || eduPlanInput.subject;
    const isEnglish = currentSubject === "Tiếng Anh" || currentSubject.toLowerCase().includes("english");

    const t = (text: string) => {
      if (!isEnglish) return text;
      const dict: Record<string, string> = {
        "KẾ HOẠCH BÀI DẠY (KHBD)": "LESSON PLAN",
        "Tên bài dạy:": "Lesson topic:",
        "I. MỤC TIÊU": "I. OBJECTIVES",
        "1. Kiến thức:": "1. Knowledge:",
        "2. Năng lực môn học:": "2. Subject-Specific Competencies:",
        "3. Năng lực AI:": "3. AI Competencies:",
        "4. Năng lực chung:": "4. General Competencies:",
        "5. Phẩm chất:": "5. Core Qualities:",
        "II. THIẾT BỊ DẠY HỌC VÀ HỌC LIỆU": "II. TEACHING AIDS & MATERIALS",
        "1. Thiết bị truyền thống:": "1. Traditional Aids:",
        "2. Công cụ số và AI:": "2. Digital & AI Tools:",
        "Phương án triển khai:": "Implementation Method:",
        "Học liệu/công cụ cụ thể:": "Specific Tools:",
        "III. TIẾN TRÌNH DẠY HỌC": "III. TEACHING PROCEDURE",
        "a) Mục tiêu:": "a) Objectives:",
        "b) Nội dung:": "b) Content:",
        "c) Sản phẩm:": "c) Product:",
        "d) Tổ chức thực hiện:": "d) Execution Organization:",
        "IV. KẾ HOẠCH ĐÁNH GIÁ": "IV. ASSESSMENT PLAN",
        "V. PHỤ LỤC": "V. APPENDIX",
        "Hoạt động của GV và HS:": "Teacher & Student Activities:",
        "Dự kiến sản phẩm:": "Expected Product:",
        "Mẫu Prompt:": "Prompt Template:",
        "Bảng kiểm:": "Checklist:",
        "Thứ tự tiết": "Period",
        "Bài học": "Topic",
        "Số tiết": "Duration",
        "Thời điểm": "Timing",
        "Thiết bị": "Equipment",
        "Địa điểm": "Location",
        "Định hướng năng lực số": "Digital Competency",
        "KẾ HOẠCH GIÁO DỤC CỦA GIÁO VIÊN": "TEACHER'S EDUCATIONAL PLAN",
        "Môn:": "Subject:",
        "Lớp:": "Grade:",
        "STT": "No.",
        "Tên bài học/Chủ đề": "Topic/Theme",
        "Mục tiêu bài học": "Lesson Goal",
        "Tiết": "Period",
        "Năng lực AI": "AI Competency",
        "Mục tiêu GD AI": "AI Edu Goal",
        "Hình thức triển khai": "Implementation Form",
        "KẾ HOẠCH GIÁO DỤC TỔ CHUYÊN MÔN TÍCH HỢP AI": "DEPARTMENTAL EDUCATIONAL PLAN WITH AI",
        "Căn cứ QĐ 3439/QĐ-BGDĐT": "Based on Decision 3439/QĐ-BGDĐT"
      };
      return dict[text] || text;
    };

    const strip = (text: string) => text ? text.replace(/<bold>|<\/bold>|<ai>|<\/ai>|\*\*|#/gi, '') : '';

    if (result.type === "khbd") {
      const d = result.data;
      content = `${t("KẾ HOẠCH BÀI DẠY (KHBD)")}\n\n${t("Tên bài dạy:")} ${d.title}\n\n${t("I. MỤC TIÊU")}\n${t("1. Kiến thức:")}\n${d.objectives.knowledge.map((c: string) => `- ${c}`).join("\n")}\n\n${t("2. Năng lực môn học:")}\n${d.objectives.subjectSpecific.map((c: string) => `- ${c}`).join("\n")}\n\n${t("3. Năng lực AI:")}\n${d.objectives.aiSpecific.map((c: string) => `- ${c}`).join("\n")}\n\n${t("4. Năng lực chung:")}\n${d.objectives.general.map((c: string) => `- ${c}`).join("\n")}\n\n${t("5. Phẩm chất:")}\n${d.objectives.qualities.map((q: string) => `- ${q}`).join("\n")}\n\n${t("II. THIẾT BỊ DẠY HỌC VÀ HỌC LIỆU")}\n${t("1. Thiết bị truyền thống:")} ${d.materials.traditional.join(", ")}\n${t("2. Công cụ số và AI:")}\n- ${t("Phương án triển khai:")} ${d.materials.digitalAndAI.implementationMethod}\n- ${t("Học liệu/công cụ cụ thể:")} ${d.materials.digitalAndAI.specificTools.join(", ")}\n\n${t("III. TIẾN TRÌNH DẠY HỌC")}\n${d.activities.map((a: any) => `${a.name}\n${t("a) Mục tiêu:")} ${a.objective}\n${t("b) Nội dung:")} ${a.content}\n${t("c) Sản phẩm:")} ${a.product}\n${t("d) Tổ chức thực hiện:")}\n${a.procedure.map((p: any) => `${p.stepName}\n  - ${t("Hoạt động của GV và HS:")} ${strip(p.teacherStudentActivities)}\n  - ${t("Dự kiến sản phẩm:")} ${strip(p.expectedProduct)}`).join("\n")}`).join("\n\n")}\n\n${t("IV. KẾ HOẠCH ĐÁNH GIÁ")}\n${d.assessment.map((a: string) => `- ${strip(a)}`).join("\n")}\n\n${t("V. PHỤ LỤC")}\n- ${t("Mẫu Prompt:")} ${d.appendix.prompts.join(", ")}\n- ${t("Bảng kiểm:")}\n${d.appendix.checklist.map((c: string) => `- ${strip(c)}`).join("\n")}`;
    } else if (result.type === "khgd") {
      content = `${t("KẾ HOẠCH GIÁO DỤC CỦA GIÁO VIÊN")}\n${t("Môn:")} ${eduPlanInput.subject} - ${t("Lớp:")} ${eduPlanInput.grade}\n\n${t("Thứ tự tiết")} | ${t("Bài học")} | ${t("Số tiết")} | ${t("Thời điểm")} | ${t("Thiết bị")} | ${t("Địa điểm")} | ${t("Định hướng năng lực số")}\n${result.data.map((item: any) => `${item.order} | ${item.lesson} | ${item.periods} | ${item.timing} | ${item.equipment} | ${item.location} | ${item.digitalCompetency}`).join("\n")}`;
    } else if (result.type === "kh-tcm") {
      content = `${t("KẾ HOẠCH GIÁO DỤC TỔ CHUYÊN MÔN TÍCH HỢP AI")}\n${t("Môn:")} ${eduPlanInput.subject} - ${t("Lớp:")} ${eduPlanInput.grade}\n${t("Căn cứ QĐ 3439/QĐ-BGDĐT")}\n\n${t("STT")} | ${t("Tên bài học/Chủ đề")} | ${t("Mục tiêu bài học")} | ${t("Tiết")} | ${t("Năng lực AI")} | ${t("Mục tiêu GD AI")} | ${t("Hình thức triển khai")}\n${result.data.map((item: any, i: number) => `${i + 1} | ${item.lessonName} | ${item.lessonGoal} | ${item.periods} | ${item.aiCompetency} | ${item.aiObjective} | ${item.implementationForm}`).join("\n")}`;
    }

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${result.type.toUpperCase()}_${currentSubject}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen text-slate-900 font-sans selection:bg-indigo-200">
      {/* Sidebar Navigation */}
      <aside className="fixed left-0 top-0 h-full w-[280px] glass-dark text-white hidden lg:flex flex-col z-30 border-r border-white/10 shadow-2xl">
        <div className="p-8 border-b border-white/10 cursor-pointer hover:bg-white/5 transition-all group" onClick={() => { setMode("dashboard"); setResult(null); }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <BrainCircuit className="w-6 h-6 text-white" />
            </div>
            <h1 className="font-black text-2xl tracking-tighter">EduPlan <span className="text-blue-400">AI</span></h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-blue-300/80 font-black uppercase tracking-[0.3em]">Hệ thống thông minh</span>
            <div className="h-px bg-white/10 flex-1"></div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <div className="pt-2 pb-2 px-3">
            <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Quản lý kế hoạch</span>
          </div>
          <NavItem
            sidebar
            active={mode === "dashboard"}
            onClick={() => { setMode("dashboard"); setResult(null); }}
            icon={<BookOpen className="w-4 h-4" />}
            label="Tổng quan"
          />
          <div className="pt-6 pb-2 px-3">
            <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Quy trình chuẩn hóa</span>
          </div>
          <NavItem
            sidebar
            active={mode === "kh-tcm-gen"}
            onClick={() => { setMode("kh-tcm-gen"); setResult(null); }}
            icon={<LayoutGrid className="w-4 h-4" />}
            label="1. Kế hoạch Tổ chuyên môn"
          />
          <NavItem
            sidebar
            active={mode === "khgd-gen"}
            onClick={() => { setMode("khgd-gen"); setResult(null); }}
            icon={<Calendar className="w-4 h-4" />}
            label="2. Kế hoạch giáo dục của giáo viên"
          />
          <NavItem
            sidebar
            active={mode === "khbd-gen"}
            onClick={() => { setMode("khbd-gen"); setResult(null); }}
            icon={<FileText className="w-4 h-4" />}
            label="3. Kế hoạch bài dạy (KHBD)"
          />
          <div className="pt-6 pb-2 px-3">
            <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Hệ thống</span>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl transition-all text-white/60 hover:bg-white/5 hover:text-white"
          >
            <Settings className="w-4 h-4" /> Cài đặt API
          </button>
        </nav>

        <div className="p-4 mt-auto">
          <div className="bg-gradient-to-br from-[#0F172A] to-[#1E293B] rounded-2xl p-4 border border-white/5 relative overflow-hidden">
            <div className="absolute -top-5 -right-5 w-20 h-20 bg-brand-accent/10 rounded-full blur-2xl"></div>
            <div className="flex items-center gap-2 mb-2 relative z-10">
              <BrainCircuit className="w-4 h-4 text-brand-accent" />
              <span className="text-xs font-bold text-white">Sẵn sàng trợ lý</span>
            </div>
            <p className="text-[10px] text-white/60 leading-relaxed relative z-10">
              Dựa trên Công văn 3439/BGDĐT và chương trình 2018.
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-[280px] min-h-screen flex flex-col pt-4 lg:pt-0">
        {/* Mobile Header */}
        <header className="lg:hidden flex items-center justify-between p-4 border-b border-white/10 sticky top-0 bg-indigo-900/80 backdrop-blur-md z-40 text-white">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => { setMode("dashboard"); setResult(null); }}>
            <span className="font-black text-xl">EduPlan <span className="text-blue-400">AI</span></span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 border border-white/20 rounded-lg text-white/60 hover:text-white transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={() => { setMode("dashboard"); setResult(null); }}
              className="p-2 border border-white/20 rounded-lg text-white/60 hover:text-white transition-colors"
            >
              <BookOpen className="w-5 h-5" />
            </button>
          </div>
        </header>

        <section className="flex-1 p-4 md:p-6 lg:p-10 max-w-7xl mx-auto w-full pb-40 lg:pb-40">
          <div className="mb-6 mx-auto w-full max-w-3xl glass p-4 rounded-xl border border-red-500/20 bg-red-50/10 flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-500">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm font-bold">Lấy API key để sử dụng app</span>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white text-xs font-bold rounded-lg transition-colors border border-red-500/30"
            >
              Cài đặt ngay
            </button>
          </div>
          <AnimatePresence mode="wait">
            {mode === "dashboard" && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="space-y-10"
              >
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div className="space-y-4">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 glass rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-indigo-700 border border-indigo-200/50 shadow-sm">
                      <Sparkles className="w-3 h-3 animate-pulse" /> Trợ lý giáo dục 4.0
                    </div>
                    <div>
                      <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter leading-[0.9] mb-4">
                        EduPlan <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">AI</span>
                      </h2>
                      <p className="text-indigo-100/70 font-medium max-w-xl text-lg">
                        Nền tảng số hóa giáo án chuyên nghiệp, bám sát các tiêu chuẩn giáo dục Việt Nam.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 glass p-3 pr-8 rounded-[24px] border border-white/20 shadow-2xl self-end md:self-auto backdrop-blur-3xl group hover:bg-white/90 transition-all">
                    <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform">
                      <CheckCircle2 className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest leading-none mb-1">Hợp quy</p>
                      <p className="text-base font-black text-slate-900 leading-none">BGDĐT Compliance</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {/* Hero / Main Card */}
                  <div className="md:col-span-4 lg:col-span-2 glass p-10 rounded-[24px] relative overflow-hidden flex flex-col justify-between min-h-[360px] group transition-all hover:bg-white/80 border border-white/50 shadow-2xl">
                    <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-[80px] -mr-20 -mt-20 group-hover:bg-blue-500/20 transition-all"></div>
                    <div className="relative z-10">
                      <div className="p-5 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl w-fit shadow-xl mb-8 transform group-hover:-rotate-6 transition-transform">
                        <School className="w-10 h-10 text-white" />
                      </div>
                      <h3 className="text-4xl font-black text-indigo-950 mb-4 leading-tight tracking-tighter">Số hóa Kế hoạch <br /> Giáo dục Chuyên nghiệp</h3>
                      <p className="text-indigo-900/70 text-base font-semibold leading-relaxed max-w-md italic border-l-4 border-indigo-400 pl-4">
                        "Khoa học - Trực quan - Thông minh - Hiện đại"
                      </p>
                    </div>
                    <div className="relative z-10 flex items-center gap-4 mt-8 pt-8 border-t border-indigo-100/30">
                      <div className="flex -space-x-3">
                        {[1, 2, 3, 4, 5].map(i => (
                          <div key={i} className="w-10 h-10 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center overflow-hidden shadow-md">
                            <img src={`https://picsum.photos/seed/edu_user_${i}/40/40`} referrerPolicy="no-referrer" alt="User" />
                          </div>
                        ))}
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-indigo-800 tracking-wider uppercase">Chuẩn dữ liệu GDPT 2018</p>
                        <p className="text-[9px] text-indigo-400 font-bold uppercase">Cập nhật mới nhất 2025</p>
                      </div>
                    </div>
                  </div>

                  {/* KHTCM Card */}
                  <div className="md:col-span-2 lg:col-span-1 h-full">
                    <FeatureCard
                      icon={<LayoutGrid className="w-8 h-8 text-white" />}
                      iconBg="bg-blue-600"
                      title="Kế hoạch Tổ (KHTCM)"
                      desc="Xây dựng khung kế hoạch dạy học cấp Tổ chuyên môn tích hợp AI chuẩn CV 3439."
                      onClick={() => setMode("kh-tcm-gen")}
                    />
                  </div>

                  {/* KHGD Card */}
                  <div className="md:col-span-2 lg:col-span-1 h-full">
                    <FeatureCard
                      icon={<Calendar className="w-8 h-8 text-white" />}
                      iconBg="bg-indigo-600"
                      title="Kế hoạch GV (KHGD)"
                      desc="Lập phân phối chương trình và dự kiến kế hoạch dạy học cá nhân chi tiết."
                      onClick={() => setMode("khgd-gen")}
                    />
                  </div>

                  {/* KHBD Large Card */}
                  <div className="md:col-span-4 glass p-10 rounded-[24px] flex flex-col lg:flex-row items-center gap-10 relative overflow-hidden group hover:bg-white/80 transition-all border border-white/50 shadow-2xl">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-600 opacity-50"></div>
                    <div className="flex-shrink-0 p-8 bg-gradient-to-br from-indigo-600 to-blue-800 rounded-[32px] shadow-2xl transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                      <FileText className="w-16 h-16 text-white" />
                    </div>
                    <div className="flex-1 space-y-6">
                      <div className="space-y-2 text-center lg:text-left">
                        <h3 className="text-3xl font-black text-indigo-950 tracking-tighter">Soạn Kế hoạch bài dạy (KHBD)</h3>
                        <p className="text-indigo-900/60 font-semibold text-lg">Tạo giáo án chi tiết với kịch bản tương tác AI chuyên sâu.</p>
                      </div>
                      <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
                        {["Chuẩn 5512", "Tích hợp AI 3439", "LaTeX support", "Đa định dạng"].map(tag => (
                          <span key={tag} className="px-4 py-1.5 bg-white/50 backdrop-blur-sm text-indigo-700 text-[10px] font-black uppercase tracking-widest rounded-full border border-indigo-100 shadow-sm">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => setMode("khbd-gen")}
                      className="w-full lg:w-auto bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-10 py-5 rounded-[24px] font-black uppercase tracking-[0.2em] text-sm shadow-indigo-600/30 shadow-2xl hover:scale-105 transition-all active:scale-95 flex items-center justify-center gap-3 group/btn"
                    >
                      Bắt đầu ngay <ChevronRight className="w-6 h-6 group-hover/btn:translate-x-2 transition-transform" />
                    </button>
                  </div>

                  {/* Analytics / Integration Card */}
                  <div className="md:col-span-2 glass p-8 rounded-[24px] border border-white/50 flex items-center gap-6 group hover:bg-white/80 transition-all">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-50 transition-colors">
                      <Sparkles className="w-8 h-8 text-indigo-500" />
                    </div>
                    <div>
                      <h4 className="font-black text-indigo-950">Phát triển Năng lực AI</h4>
                      <p className="text-xs font-medium text-indigo-900/50 leading-relaxed italic">Nạp khung năng lực 3439 vào từng hoạt động dạy học.</p>
                    </div>
                  </div>

                  <div className="md:col-span-2 glass p-8 rounded-[24px] border border-white/50 flex items-center gap-6 group hover:bg-white/80 transition-all">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-50 transition-colors">
                      <BrainCircuit className="w-8 h-8 text-blue-500" />
                    </div>
                    <div>
                      <h4 className="font-black text-indigo-950">Xử lý Ngôn ngữ Tự nhiên</h4>
                      <p className="text-xs font-medium text-indigo-900/50 leading-relaxed italic">Phân tích yêu cầu cần đạt (YCCĐ) một cách khoa học.</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {mode === "khbd-gen" && (
              <motion.div
                key="khbd"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div>
                    <h2 className="text-3xl font-bold text-slate-900">Khung Kế hoạch bài dạy</h2>
                    <p className="text-slate-500 mt-1">Chuẩn Công văn 3439/BGDĐT</p>
                  </div>
                  <button
                    onClick={() => { setMode("dashboard"); setResult(null); }}
                    className="text-sm font-medium text-slate-500 hover:text-slate-900 flex items-center gap-1"
                  >
                    Quay lại tổng quan <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {!result && !loading && (
                  <div className="glass rounded-[24px] p-8 max-w-2xl mx-auto backdrop-blur-3xl border-indigo-200/30">
                    <div className="grid grid-cols-1 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.14em]">Địa phương / Tỉnh thành</label>
                        <select
                          className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-accent outline-none text-sm appearance-none bg-white font-medium"
                          value={province}
                          onChange={(e) => {
                            setProvince(e.target.value);
                            if (lessonPlanInput.subject) {
                              handleSubjectOrGradeChange(lessonPlanInput.subject, lessonPlanInput.grade);
                            }
                          }}
                        >
                          {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <p className="text-[10px] text-slate-400 mt-1 italic leading-relaxed">
                          * Lưu ý: Hiện tại danh sách bao gồm 6 thành phố và 28 tỉnh (theo cập nhật đơn vị hành chính 1/7/2025).
                        </p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.14em]">Môn học</label>
                        <div className="relative group">
                          <select
                            className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-accent focus:border-brand-accent transition-all outline-none text-sm appearance-none bg-white font-medium scrollbar-thin scrollbar-thumb-slate-200"
                            value={lessonPlanInput.subject}
                            onChange={(e) => handleSubjectOrGradeChange(e.target.value, lessonPlanInput.grade)}
                          >
                            <option value="">-- Chọn môn học --</option>
                            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-brand-accent transition-colors">
                            <ChevronRight className="w-4 h-4 rotate-90" />
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.14em]">Khối lớp</label>
                          <div className="relative group">
                            <select
                              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-accent outline-none text-sm appearance-none bg-white font-medium"
                              value={lessonPlanInput.grade}
                              onChange={(e) => handleSubjectOrGradeChange(lessonPlanInput.subject, e.target.value)}
                            >
                              {GRADES.map(g => <option key={g} value={g}>Lớp {g}</option>)}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-brand-accent transition-colors">
                              <ChevronRight className="w-4 h-4 rotate-90" />
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.14em]">Thời lượng</label>
                          <input
                            type="text"
                            placeholder="VD: 2 tiết"
                            className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-accent outline-none text-sm"
                            value={lessonPlanInput.duration}
                            onChange={(e) => setLessonPlanInput({ ...lessonPlanInput, duration: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.14em]">Chọn bài dạy trong chương trình 2018</label>
                          <div className="relative group">
                            <select
                              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-accent outline-none text-sm appearance-none bg-white font-medium italic"
                              value={lessonPlanInput.topic}
                              onChange={(e) => handleLessonSelect(e.target.value)}
                            >
                              <option value="">-- Chọn bài dạy có sẵn --</option>
                              {availableLessons.map((l, idx) => (
                                <option key={idx} value={l.topic}>{l.topic}</option>
                              ))}
                              <option value="custom">-- Nhập tên bài bài dạy khác --</option>
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                              <ChevronRight className="w-4 h-4 rotate-90" />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.14em]">Tên bài học cụ thể</label>
                          <textarea
                            placeholder="Nhập tên bài học hoặc nội dung trọng tâm..."
                            className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-accent min-h-[60px] transition-all outline-none text-sm"
                            value={lessonPlanInput.topic}
                            onChange={(e) => setLessonPlanInput({ ...lessonPlanInput, topic: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-100 mt-2">
                        <h4 className="text-[11px] font-extrabold text-brand-sidebar uppercase tracking-widest mb-4 flex items-center gap-2">
                          <BrainCircuit className="w-3 h-3 text-brand-accent" /> Bối cảnh giảng dạy
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.14em]">Đặc điểm học sinh</label>
                            <textarea
                              placeholder="VD: Học sinh có ý thức học tập tốt, đã biết cơ bản về..."
                              className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-accent min-h-[60px] text-xs outline-none"
                              value={lessonPlanInput.contextStudents}
                              onChange={(e) => setLessonPlanInput({ ...lessonPlanInput, contextStudents: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.14em]">Điều kiện trường/lớp</label>
                            <textarea
                              placeholder="VD: Phòng có máy chiếu, mạng internet ổn định..."
                              className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-accent min-h-[60px] text-xs outline-none"
                              value={lessonPlanInput.contextSchool}
                              onChange={(e) => setLessonPlanInput({ ...lessonPlanInput, contextSchool: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-100">
                        <h4 className="text-[11px] font-extrabold text-brand-sidebar uppercase tracking-widest mb-4 flex items-center gap-2">
                          <Sparkles className="w-3 h-3 text-brand-accent" /> Mục tiêu cụ thể (Tùy chọn)
                        </h4>
                        <div className="grid grid-cols-1 gap-3">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.14em]">Mục tiêu kiến thức</label>
                            <textarea
                              placeholder="Nhập kiến thức trọng tâm cần đạt..."
                              className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-accent min-h-[50px] text-xs outline-none"
                              value={lessonPlanInput.objectivesKnowledge}
                              onChange={(e) => setLessonPlanInput({ ...lessonPlanInput, objectivesKnowledge: e.target.value })}
                            />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.14em]">Mục tiêu năng lực</label>
                              <textarea
                                placeholder="VD: Năng lực tự học, giải quyết vấn đề..."
                                className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-accent min-h-[50px] text-xs outline-none"
                                value={lessonPlanInput.objectivesCompetency}
                                onChange={(e) => setLessonPlanInput({ ...lessonPlanInput, objectivesCompetency: e.target.value })}
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.14em]">Mục tiêu phẩm chất</label>
                              <textarea
                                placeholder="VD: Trung thực, trách nhiệm..."
                                className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-accent min-h-[50px] text-xs outline-none"
                                value={lessonPlanInput.objectivesQuality}
                                onChange={(e) => setLessonPlanInput({ ...lessonPlanInput, objectivesQuality: e.target.value })}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded border-slate-300 text-brand-accent focus:ring-brand-accent cursor-pointer"
                            checked={lessonPlanInput.useLaTeX}
                            onChange={(e) => setLessonPlanInput({ ...lessonPlanInput, useLaTeX: e.target.checked })}
                          />
                          <span className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.05em] group-hover:text-brand-accent transition-colors">Ưu tiên LaTeX / MathType</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded border-slate-300 text-brand-accent focus:ring-brand-accent cursor-pointer"
                            checked={lessonPlanInput.detailDrawings}
                            onChange={(e) => setLessonPlanInput({ ...lessonPlanInput, detailDrawings: e.target.checked })}
                          />
                          <span className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.05em] group-hover:text-brand-accent transition-colors">Mô tả chi tiết hình vẽ</span>
                        </label>
                      </div>

                      <div className="space-y-2 pt-2">
                        <label className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.14em]">Ghi chú khác</label>
                        <textarea
                          placeholder="Các yêu cầu bổ sung khác cho AI..."
                          className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-accent min-h-[50px] text-xs outline-none"
                          value={lessonPlanInput.additionalNotes}
                          onChange={(e) => setLessonPlanInput({ ...lessonPlanInput, additionalNotes: e.target.value })}
                        />
                      </div>
                      <button
                        onClick={handleGenerateKHBD}
                        disabled={!lessonPlanInput.subject || !lessonPlanInput.topic}
                        className="w-full bg-brand-accent hover:bg-sky-500 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-4 rounded-lg shadow-lg shadow-brand-accent/20 transition-all flex items-center justify-center gap-2"
                      >
                        <Sparkles className="w-5 h-5 fill-white/20" />
                        Tạo Kế hoạch Bài dạy ngay
                      </button>
                    </div>
                  </div>
                )}

                {loading && (
                  <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
                    <p className="text-slate-500 font-medium animate-pulse">AI đang soạn thảo kế hoạch bài dạy cho bạn...</p>
                    <p className="text-xs text-slate-400">Việc này có thể mất vài giây bám sát CV 3439.</p>
                  </div>
                )}

                {result && result.type === "khbd" && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between gap-4 sticky top-6 z-10 bg-brand-bg/80 backdrop-blur-md py-2 px-1">
                      <div className="flex flex-col">
                        <h3 className="text-xl font-extrabold text-brand-sidebar line-clamp-1">{result.data.title}</h3>
                        <div className="text-[10px] text-brand-muted font-bold uppercase flex items-center gap-2 mt-1">
                          Chuẩn CV 5512/BGDĐT + AI <span className="w-1 h-1 bg-brand-muted rounded-full"></span> Môn: {lessonPlanInput.subject} <span className="w-1 h-1 bg-brand-muted rounded-full"></span> {province}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={downloadWord} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm" title="Tải xuống Word">
                          <FileDown className="w-4 h-4 text-blue-600" />
                        </button>
                        <button onClick={downloadPDF} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm" title="Tải xuống PDF">
                          <FileDown className="w-4 h-4 text-red-500" />
                        </button>
                        <button onClick={downloadText} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm" title="Tải xuống Text">
                          <FileText className="w-4 h-4 text-brand-muted" />
                        </button>
                        <button onClick={handleCopy} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm" title="Sao chép JSON">
                          <FileJson className="w-4 h-4 text-brand-accent" />
                        </button>
                        <button onClick={() => window.print()} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm" title="In">
                          <Printer className="w-4 h-4 text-brand-muted" />
                        </button>
                        <button
                          onClick={() => setResult(null)}
                          className="px-4 py-2 bg-brand-sidebar text-white rounded-lg text-xs font-bold shadow-md hover:bg-slate-900 transition-colors"
                        >
                          Tạo mới
                        </button>
                        <button
                          onClick={() => {
                            setEduPlanInput({
                              ...eduPlanInput,
                              subject: lessonPlanInput.subject,
                              grade: lessonPlanInput.grade
                            });
                            setMode("khgd-gen");
                            setResult(null);
                          }}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-md hover:bg-indigo-700 transition-colors flex items-center gap-2"
                        >
                          <Calendar className="w-3 h-3" /> Lập KH Giáo dục GV
                        </button>
                        {!evaluationResult && (
                          <button
                            onClick={handleGenerateEvaluation}
                            disabled={evaluationLoading}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold shadow-md hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                          >
                            {evaluationLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ClipboardCheck className="w-3 h-3" />}
                            {evaluationLoading ? "Đang thiết kế..." : "Thiết kế đánh giá"}
                          </button>
                        )}
                      </div>
                    </div>

                    <div ref={contentRef} className="glass rounded-[24px] p-8 shadow-2xl space-y-10 print:border-0 print:shadow-none print:bg-white paper">
                      {/* Section I */}
                      <section className="space-y-6">
                        <h4 className="text-base font-extrabold text-brand-sidebar border-t border-slate-100 pt-4 uppercase tracking-tight flex items-center gap-3">
                          <span className="w-1 h-6 bg-brand-accent rounded-full"></span>
                          I. MỤC TIÊU
                        </h4>
                        <div className="space-y-6 pl-4">
                          <div className="mb-6">
                            <span className="inline-block px-2 py-1 bg-slate-100 rounded text-[10px] font-bold text-brand-muted uppercase mb-3 border border-slate-200">1. Kiến thức</span>
                            <ul className="list-disc list-inside space-y-2 text-brand-dark text-[12px] leading-relaxed">
                              {result.data.objectives.knowledge.map((c: string, i: number) => (
                                <li key={i}>{c}</li>
                              ))}
                            </ul>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-2">
                            <div className="space-y-4">
                              <div>
                                <span className="inline-block px-2 py-1 bg-slate-100 rounded text-[10px] font-bold text-brand-muted uppercase mb-3 text-emerald-700">2. Năng lực đặc thù môn học</span>
                                <ul className="list-disc list-inside space-y-2 text-brand-dark text-[12px] leading-relaxed">
                                  {result.data.objectives.subjectSpecific.map((c: string, i: number) => (
                                    <li key={i}>{c}</li>
                                  ))}
                                </ul>
                              </div>
                              <div>
                                <span className="inline-block px-2 py-1 bg-red-50 rounded text-[10px] font-bold text-red-600 uppercase mb-3 border border-red-100">3. Năng lực AI đặc thù (3439)</span>
                                <ul className="list-disc list-inside space-y-2 text-red-600 text-[12px] leading-relaxed italic font-medium">
                                  {result.data.objectives.aiSpecific.map((c: string, i: number) => (
                                    <li key={i}>{c}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                            <div className="space-y-4">
                              <div>
                                <span className="inline-block px-2 py-1 bg-slate-100 rounded text-[10px] font-bold text-brand-muted uppercase mb-3">4. Năng lực chung</span>
                                <ul className="list-disc list-inside space-y-2 text-brand-dark text-[12px] leading-relaxed">
                                  {result.data.objectives.general.map((c: string, i: number) => (
                                    <li key={i}>{c}</li>
                                  ))}
                                </ul>
                              </div>
                              <div>
                                <span className="inline-block px-2 py-1 bg-slate-100 rounded text-[10px] font-bold text-brand-muted uppercase mb-3">5. Phẩm chất</span>
                                <ul className="list-disc list-inside space-y-2 text-brand-dark text-[12px] leading-relaxed">
                                  {result.data.objectives.qualities.map((q: string, i: number) => (
                                    <li key={i}>{q}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </div>
                        </div>
                      </section>

                      {/* Section II */}
                      <section className="space-y-4">
                        <h4 className="text-base font-extrabold text-brand-sidebar border-t border-slate-100 pt-4 uppercase tracking-tight flex items-center gap-3">
                          <span className="w-1 h-6 bg-brand-accent rounded-full"></span>
                          II. THIẾT BỊ DẠY HỌC VÀ HỌC LIỆU
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pl-4">
                          <div className="space-y-2">
                            <p className="text-[10px] font-extrabold text-brand-muted uppercase tracking-wider">1. Thiết bị truyền thống</p>
                            <ul className="list-disc list-inside space-y-1 text-brand-dark text-[12px]">
                              {result.data.materials.traditional.map((m: string, i: number) => <li key={i}>{m}</li>)}
                            </ul>
                          </div>
                          <div className="space-y-4">
                            <p className="text-[10px] font-extrabold text-red-600 uppercase tracking-wider underline decoration-red-200 underline-offset-4">2. CÔNG CỤ SỐ AI</p>
                            <div className="bg-red-50/50 p-4 rounded-xl border border-red-100 space-y-3 shadow-sm shadow-red-50">
                              <div>
                                <p className="text-[9px] font-bold text-red-600 uppercase mb-1">Phương án triển khai</p>
                                <p className="text-[11px] text-red-600 leading-relaxed font-semibold italic">
                                  {result.data.materials.digitalAndAI.implementationMethod}
                                </p>
                              </div>
                              <div>
                                <p className="text-[9px] font-bold text-red-600 uppercase mb-1">Học liệu / Công cụ cụ thể</p>
                                <ul className="list-disc list-inside text-[11px] text-red-600 space-y-1 font-medium">
                                  {result.data.materials.digitalAndAI.specificTools.map((m: string, i: number) => <li key={i}>{m}</li>)}
                                </ul>
                              </div>
                            </div>
                          </div>
                        </div>
                      </section>

                      {/* Section III */}
                      <section className="space-y-6">
                        <h4 className="text-base font-extrabold text-brand-sidebar border-t border-slate-100 pt-4 uppercase tracking-tight flex items-center gap-3">
                          <span className="w-1 h-6 bg-brand-accent rounded-full"></span>
                          III. TIẾN TRÌNH DẠY HỌC
                        </h4>
                        <div className="space-y-8 pl-4">
                          {result.data.activities.map((act: any, i: number) => (
                            <div key={i} className="space-y-4 border-l-2 border-slate-100 pl-6 relative">
                              <div className="absolute -left-[9px] top-1 w-4 h-4 bg-white border-2 border-brand-accent rounded-full"></div>
                              <h5 className="font-extrabold text-brand-accent text-sm uppercase">{highlightAI(act.name)}</h5>
                              <div className="grid grid-cols-1 gap-4 text-[13px] leading-relaxed">
                                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                  <p className="font-bold text-brand-sidebar mb-1 uppercase text-[10px] tracking-wider text-opacity-70">a) Mục tiêu</p>
                                  <p className="text-brand-muted">{highlightAI(act.objective)}</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                    <p className="font-bold text-brand-sidebar mb-1 uppercase text-[10px] tracking-wider text-opacity-70">b) Nội dung</p>
                                    <div className="text-brand-muted whitespace-pre-line">{highlightAI(act.content)}</div>
                                  </div>
                                  <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                    <p className="font-bold text-brand-sidebar mb-1 uppercase text-[10px] tracking-wider text-opacity-70">c) Sản phẩm</p>
                                    <div className="text-brand-muted whitespace-pre-line">{highlightAI(act.product)}</div>
                                  </div>
                                </div>
                                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                  <p className="font-bold text-brand-sidebar mb-3 uppercase text-[10px] tracking-wider text-opacity-70">d) Tổ chức thực hiện</p>
                                  <div className="space-y-6">
                                    {act.procedure.map((step: any, idx: number) => (
                                      <div key={idx} className="space-y-3">
                                        <p className="font-bold text-brand-sidebar text-[11px] bg-slate-200/50 px-2 py-1 rounded inline-block">{highlightAI(step.stepName)}</p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-2">
                                          <div className="space-y-1">
                                            <p className="text-[9px] font-bold text-brand-muted uppercase">Hoạt động của GV và HS</p>
                                            <div className="text-brand-dark text-[12px] leading-relaxed pl-3 border-l-2 border-brand-accent/20 whitespace-pre-line">{highlightAI(step.teacherStudentActivities)}</div>
                                          </div>
                                          <div className="space-y-1">
                                            <p className="text-[9px] font-bold text-brand-muted uppercase">Dự kiến sản phẩm</p>
                                            <div className="text-brand-dark text-[12px] leading-relaxed pl-3 border-l-2 border-emerald-500/20 whitespace-pre-line font-medium italic">{highlightAI(step.expectedProduct)}</div>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>

                      {/* Section IV */}
                      <section className="space-y-4">
                        <h4 className="text-base font-extrabold text-brand-sidebar border-t border-slate-100 pt-4 uppercase tracking-tight flex items-center gap-3">
                          <span className="w-1 h-6 bg-brand-accent rounded-full"></span>
                          IV. KẾ HOẠCH ĐÁNH GIÁ
                        </h4>
                        <ul className="list-disc list-inside space-y-2 text-brand-dark text-[13px] pl-4 leading-relaxed">
                          {result.data.assessment.map((a: string, i: number) => (
                            <li key={i}>{highlightAI(a)}</li>
                          ))}
                        </ul>
                      </section>

                      {/* Section V */}
                      <section className="space-y-4">
                        <h4 className="text-base font-extrabold text-brand-sidebar border-t border-slate-100 pt-4 uppercase tracking-tight flex items-center gap-3">
                          <span className="w-1 h-6 bg-brand-accent rounded-full"></span>
                          V. PHỤ LỤC
                        </h4>
                        <div className="space-y-6 pl-4">
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <p className="text-[10px] font-extrabold text-brand-sidebar uppercase mb-2 tracking-wider">Gợi ý mẫu Prompt cho HS</p>
                            <div className="space-y-2">
                              {result.data.appendix.prompts.map((p: string, i: number) => (
                                <div key={i} className="p-3 bg-white border border-slate-200 rounded-lg text-[12px] font-mono text-brand-accent shadow-sm italic">
                                  "{p}"
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <p className="text-[10px] font-extrabold text-brand-sidebar uppercase mb-2 tracking-wider">Bảng kiểm đánh giá thái độ sử dụng AI</p>
                            <ul className="list-disc list-inside space-y-1 text-brand-dark text-[12px]">
                              {result.data.appendix.checklist.map((c: string, i: number) => <li key={i}>{c}</li>)}
                            </ul>
                          </div>
                        </div>
                      </section>

                      <div className="bg-gradient-to-br from-brand-sidebar to-[#0F172A] rounded-2xl p-6 text-white relative overflow-hidden mt-12">
                        <div className="absolute -top-10 -right-10 w-32 h-32 bg-brand-accent/20 rounded-full blur-3xl"></div>
                        <div className="relative z-10">
                          <div className="flex items-center gap-1 mb-3">
                            <Sparkles className="w-4 h-4 text-brand-accent" />
                            <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-accent">Nhân văn & An toàn dữ liệu</span>
                          </div>
                          <p className="text-[12px] opacity-90 leading-relaxed font-light italic">
                            "Công nghệ phục vụ con người, không thay thế tư duy. Luôn bảo vệ thông tin cá nhân và trích dẫn nguồn AI trung thực."
                          </p>
                        </div>
                      </div>

                      {evaluationResult && (
                        <div className="mt-12 space-y-8 pt-8 border-t-4 border-emerald-100">
                          <header className="flex items-center gap-3">
                            <div className="p-3 bg-emerald-100 rounded-2xl">
                              <ClipboardCheck className="w-6 h-6 text-emerald-600" />
                            </div>
                            <div>
                              <h4 className="text-xl font-black text-brand-sidebar uppercase tracking-tight">Hệ thống đánh giá năng lực</h4>
                              <p className="text-xs text-brand-muted font-bold uppercase tracking-widest mt-1">Chuẩn CV 3439/BGDĐT & Chương trình GDPT 2018</p>
                            </div>
                          </header>

                          {/* Rubrics */}
                          <div className="space-y-6">
                            <h5 className="text-sm font-extrabold text-emerald-700 bg-emerald-50 px-4 py-2 rounded-lg inline-flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4" /> 1. TIÊU CHÍ ĐÁNH GIÁ (RUBRICS)
                            </h5>
                            <div className="grid grid-cols-1 gap-6">
                              {evaluationResult.rubrics.map((rubric: any, idx: number) => (
                                <div key={idx} className="overflow-x-auto rounded-xl border border-slate-200">
                                  <table className="w-full text-left border-collapse min-w-[600px]">
                                    <thead>
                                      <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="p-4 text-[10px] font-black text-brand-sidebar uppercase tracking-wider w-1/4">Năng lực: {rubric.competencyName}</th>
                                        <th className="p-4 text-[10px] font-black text-red-500 uppercase tracking-wider w-[18.75%]">Mức 1: Chưa đạt</th>
                                        <th className="p-4 text-[10px] font-black text-orange-500 uppercase tracking-wider w-[18.75%]">Mức 2: Đạt</th>
                                        <th className="p-4 text-[10px] font-black text-blue-500 uppercase tracking-wider w-[18.75%]">Mức 3: Khá</th>
                                        <th className="p-4 text-[10px] font-black text-emerald-600 uppercase tracking-wider w-[18.75%]">Mức 4: Tốt</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      <tr>
                                        <td className="p-4 align-top">
                                          <ul className="list-disc list-inside space-y-1 text-[11px] text-brand-muted italic">
                                            {rubric.criteria.map((c: string, ci: number) => <li key={ci}>{c}</li>)}
                                          </ul>
                                        </td>
                                        <td className="p-4 text-[11px] text-brand-dark align-top leading-relaxed">{rubric.levels.level1}</td>
                                        <td className="p-4 text-[11px] text-brand-dark align-top leading-relaxed">{rubric.levels.level2}</td>
                                        <td className="p-4 text-[11px] text-brand-dark align-top leading-relaxed">{rubric.levels.level3}</td>
                                        <td className="p-4 text-[11px] text-brand-dark align-top leading-relaxed">{rubric.levels.level4}</td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Assessment Components */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                              <h5 className="text-sm font-extrabold text-blue-700 bg-blue-50 px-4 py-2 rounded-lg inline-flex items-center gap-2">
                                <Search className="w-4 h-4" /> 2. ĐÁNH GIÁ THƯỜNG XUYÊN
                              </h5>
                              <div className="space-y-4">
                                {evaluationResult.formativeAssessment.quizzes.map((q: any, qi: number) => (
                                  <div key={qi} className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
                                    <p className="text-[12px] font-bold text-brand-sidebar">Câu {qi + 1}: {q.question}</p>
                                    <div className="grid grid-cols-1 gap-2">
                                      {q.options.map((opt: string, oi: number) => (
                                        <div key={oi} className="flex items-center gap-2 text-[11px] text-brand-muted bg-white p-2 rounded-lg border border-slate-200">
                                          <span className="w-5 h-5 flex items-center justify-center bg-slate-100 rounded-full text-[9px] font-bold">{String.fromCharCode(65 + oi)}</span>
                                          {opt}
                                        </div>
                                      ))}
                                    </div>
                                    <p className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded inline-block">Đáp án: {q.answer}</p>
                                  </div>
                                ))}
                                <div className="p-4 border-2 border-dashed border-slate-200 rounded-xl">
                                  <p className="text-[10px] font-black text-brand-sidebar uppercase mb-3 opacity-70">Bảng kiểm (Checklist) tiến trình</p>
                                  <ul className="space-y-2">
                                    {evaluationResult.formativeAssessment.checklists.map((c: string, ci: number) => (
                                      <li key={ci} className="flex items-start gap-2 text-[11px] text-brand-muted">
                                        <div className="w-4 h-4 border border-slate-300 rounded mt-0.5 shrink-0"></div>
                                        {c}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-4">
                              <h5 className="text-sm font-extrabold text-indigo-700 bg-indigo-50 px-4 py-2 rounded-lg inline-flex items-center gap-2">
                                <LayoutGrid className="w-4 h-4" /> 3. ĐÁNH GIÁ ĐỊNH KỲ
                              </h5>
                              <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-6 rounded-2xl text-white space-y-4 shadow-lg shadow-indigo-100 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                  <Sparkles className="w-12 h-12" />
                                </div>
                                <div className="space-y-1">
                                  <p className="text-[9px] font-black uppercase opacity-70 tracking-widest">Nội dung yêu cầu</p>
                                  <h6 className="text-base font-bold leading-tight">{evaluationResult.summativeAssessment.projectOrTest}</h6>
                                </div>
                                <div className="space-y-2">
                                  <p className="text-[9px] font-black uppercase opacity-70 tracking-widest">Tiêu chí bồi hoàn</p>
                                  <ul className="list-disc list-inside space-y-1 text-[11px] opacity-90 leading-relaxed font-medium">
                                    {evaluationResult.summativeAssessment.requirements.map((r: string, ri: number) => <li key={ri}>{r}</li>)}
                                  </ul>
                                </div>
                              </div>

                              <div className="space-y-4 pt-4">
                                <h5 className="text-sm font-extrabold text-brand-muted flex items-center gap-2">
                                  <AlertCircle className="w-4 h-4 text-emerald-500" /> 4. MẪU NHẬN XÉT CHI TIẾT
                                </h5>
                                <div className="grid grid-cols-1 gap-3">
                                  {evaluationResult.feedbackSamples.map((fb: any, fi: number) => (
                                    <div key={fi} className="p-3 bg-white border border-slate-100 rounded-xl shadow-sm space-y-1">
                                      <p className="text-[9px] font-black uppercase tracking-wider text-brand-muted">{fb.level}</p>
                                      <p className="text-[11px] text-brand-dark italic leading-relaxed">"{fb.sampleText}"</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {mode === "khgd-gen" && (
              <motion.div
                key="khgd"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between mb-2">
                  <button
                    onClick={() => { setMode("dashboard"); setResult(null); }}
                    className="flex items-center gap-2 text-[11px] font-extrabold text-brand-muted uppercase tracking-[0.2em] hover:text-brand-accent transition-colors"
                  >
                    Quay lại tổng quan <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {!result && !loading && (
                  <div className="glass rounded-[24px] p-8 max-w-2xl mx-auto backdrop-blur-3xl border-indigo-200/30">
                    <h3 className="text-xl font-extrabold text-brand-sidebar mb-6 flex items-center gap-2">
                      <Calendar className="w-6 h-6 text-indigo-500" /> Kế hoạch Giáo dục của giáo viên
                    </h3>
                    <div className="grid grid-cols-1 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.14em]">Môn học</label>
                        <div className="relative group">
                          <select
                            className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-accent outline-none text-sm appearance-none bg-white font-medium"
                            value={eduPlanInput.subject}
                            onChange={(e) => setEduPlanInput({ ...eduPlanInput, subject: e.target.value })}
                          >
                            <option value="">-- Chọn môn học --</option>
                            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-brand-accent transition-colors">
                            <ChevronRight className="w-4 h-4 rotate-90" />
                          </div>
                        </div>
                      </div>

                      {eduPlanInput.subject === "Giáo dục địa phương" && (
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.14em]">Địa phương / Tỉnh thành</label>
                          <select
                            className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm appearance-none bg-white font-medium"
                            value={province}
                            onChange={(e) => setProvince(e.target.value)}
                          >
                            {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                          <p className="text-[10px] text-slate-400 mt-1 italic leading-relaxed">
                            * Lưu ý: Hiện tại danh sách bao gồm 6 thành phố và 28 tỉnh (theo cập nhật đơn vị hành chính 1/7/2025).
                          </p>
                        </div>
                      )}
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.14em]">Khối lớp</label>
                        <select
                          className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-accent outline-none text-sm appearance-none bg-white font-medium"
                          value={eduPlanInput.grade}
                          onChange={(e) => setEduPlanInput({ ...eduPlanInput, grade: e.target.value })}
                        >
                          <option value="10">Lớp 10</option>
                          <option value="11">Lớp 11</option>
                          <option value="12">Lớp 12</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            checked={eduPlanInput.useLaTeX}
                            onChange={(e) => setEduPlanInput({ ...eduPlanInput, useLaTeX: e.target.checked })}
                          />
                          <span className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.05em] group-hover:text-indigo-600 transition-colors">Ưu tiên LaTeX / MathType</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            checked={eduPlanInput.detailDrawings}
                            onChange={(e) => setEduPlanInput({ ...eduPlanInput, detailDrawings: e.target.checked })}
                          />
                          <span className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.05em] group-hover:text-indigo-600 transition-colors">Mô tả chi tiết hình vẽ</span>
                        </label>
                      </div>

                      <button
                        onClick={handleGenerateKHGD}
                        disabled={!eduPlanInput.subject}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-4 rounded-lg shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
                      >
                        <Sparkles className="w-5 h-5 fill-white/20" />
                        Tạo Kế hoạch Giáo dục
                      </button>
                    </div>
                  </div>
                )}

                {loading && (
                  <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
                    <p className="text-brand-muted font-bold text-sm tracking-widest animate-pulse">AI ĐANG XÂY DỰNG PHÂN PHỐI CHƯƠNG TRÌNH...</p>
                  </div>
                )}

                {result && result.type === "khgd" && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between sticky top-6 z-10 bg-brand-bg/80 backdrop-blur-md py-2 px-1">
                      <div className="flex flex-col">
                        <h3 className="text-xl font-extrabold text-brand-sidebar">Kế hoạch Giáo dục của giáo viên</h3>
                        <div className="text-[10px] text-brand-muted font-bold uppercase flex items-center gap-2 mt-1">
                          Môn: {eduPlanInput.subject} <span className="w-1 h-1 bg-brand-muted rounded-full"></span> Khối {eduPlanInput.grade} {eduPlanInput.subject === "Giáo dục địa phương" && <><span className="w-1 h-1 bg-brand-muted rounded-full"></span> {province}</>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={downloadWord} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm" title="Tải xuống Word">
                          <FileDown className="w-4 h-4 text-blue-600" />
                        </button>
                        <button onClick={downloadPDF} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm" title="Tải xuống PDF">
                          <FileDown className="w-4 h-4 text-red-500" />
                        </button>
                        <button onClick={downloadText} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm" title="Tải xuống Text">
                          <FileText className="w-4 h-4 text-brand-muted" />
                        </button>
                        <button onClick={handleCopy} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm" title="Sao chép JSON">
                          <FileJson className="w-4 h-4 text-brand-accent" />
                        </button>
                        <button onClick={() => window.print()} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm">
                          <Printer className="w-4 h-4 text-brand-muted" />
                        </button>
                        <button
                          onClick={() => setResult(null)}
                          className="px-4 py-2 bg-brand-sidebar text-white rounded-lg text-xs font-bold shadow-md hover:bg-slate-900 transition-colors"
                        >
                          Tạo mới
                        </button>
                      </div>
                    </div>

                    <div ref={tableRef} className="glass rounded-[24px] p-6 shadow-2xl overflow-x-auto print:border-0 print:shadow-none print:bg-white paper">
                      <table className="w-full text-left text-[10px] border-collapse min-w-[1200px]">
                        <thead>
                          <tr className="border-b-2 border-slate-100 bg-slate-50/50">
                            <th className="p-3 font-extrabold text-brand-sidebar uppercase tracking-widest w-16 text-center">Thứ tự tiết</th>
                            <th className="p-3 font-extrabold text-brand-sidebar uppercase tracking-widest w-64">Bài học</th>
                            <th className="p-3 font-extrabold text-brand-sidebar uppercase tracking-widest w-20 text-center">Số tiết</th>
                            <th className="p-3 font-extrabold text-brand-sidebar uppercase tracking-widest w-32">Thời điểm</th>
                            <th className="p-3 font-extrabold text-brand-sidebar uppercase tracking-widest w-64">Thiết bị dạy học & Học liệu AI</th>
                            <th className="p-3 font-extrabold text-brand-sidebar uppercase tracking-widest w-40">Địa điểm dạy học</th>
                            <th className="p-3 font-extrabold text-red-600 uppercase tracking-widest">Định hướng năng lực số (AI)</th>
                            <th className="p-3 font-extrabold text-brand-sidebar uppercase tracking-widest w-20 print:hidden text-center">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.data.map((item: any, i: number) => (
                            <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors align-top">
                              <td className="p-3 text-center font-bold text-slate-500">{item.order}</td>
                              <td className="p-3 font-bold text-brand-sidebar">{item.lesson}</td>
                              <td className="p-3 text-center">{item.periods}</td>
                              <td className="p-3 font-medium text-slate-600">{item.timing}</td>
                              <td className="p-3 text-brand-muted leading-relaxed text-[9px] space-y-2">
                                <div>
                                  <p className="font-bold text-slate-500 uppercase">Truyền thống:</p>
                                  <p className="italic">{item.equipment}</p>
                                </div>
                                <div className="bg-red-50 p-2 rounded border border-red-200 shadow-sm">
                                  <p className="font-extrabold text-red-600 uppercase text-[9px] mb-1">CÔNG CỤ SỐ AI:</p>
                                  <p className="text-red-600 font-medium italic border-b border-red-100 pb-1 mb-1">
                                    - {item.digitalToolsAndAI?.method}
                                  </p>
                                  <p className="text-red-600 font-medium">
                                    - {item.digitalToolsAndAI?.tools}
                                  </p>
                                </div>
                              </td>
                              <td className="p-3 text-brand-muted">{item.location}</td>
                              <td className="p-3 text-red-700 font-bold leading-relaxed whitespace-pre-line bg-red-50/20 border-l border-red-100">
                                {item.digitalCompetency}
                              </td>
                              <td className="p-3 print:hidden text-center">
                                <button
                                  onClick={() => {
                                    setLessonPlanInput({
                                      ...lessonPlanInput,
                                      subject: eduPlanInput.subject,
                                      grade: eduPlanInput.grade,
                                      topic: item.lesson,
                                      objectivesKnowledge: "",
                                      additionalNotes: `KHÔNG GIAN TÍCH HỢP AI:
                                      - Năng lực số: ${item.digitalCompetency}
                                      - Phương án triển khai: ${item.digitalToolsAndAI?.method}
                                      - Học liệu/Công cụ: ${item.digitalToolsAndAI?.tools}`
                                    });
                                    setMode("khbd-gen");
                                    setResult(null);
                                  }}
                                  className="mx-auto p-2 bg-brand-accent text-white rounded-lg hover:bg-sky-500 transition-colors shadow-sm flex items-center justify-center"
                                  title="Soạn KHBD"
                                >
                                  <Sparkles className="w-3 h-3" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {mode === "kh-tcm-gen" && (
              <motion.div
                key="kh-tcm"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between mb-2">
                  <button
                    onClick={() => { setMode("dashboard"); setResult(null); }}
                    className="flex items-center gap-2 text-[11px] font-extrabold text-brand-muted uppercase tracking-[0.2em] hover:text-brand-accent transition-colors"
                  >
                    Quay lại tổng quan <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {!result && !loading && (
                  <div className="glass rounded-[24px] p-8 max-w-2xl mx-auto backdrop-blur-3xl border-indigo-200/30">
                    <h3 className="text-xl font-extrabold text-brand-sidebar mb-6 flex items-center gap-2">
                      <LayoutGrid className="w-6 h-6 text-emerald-500" /> Kế hoạch Dạy học Tổ chuyên môn
                    </h3>
                    <div className="grid grid-cols-1 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.14em]">Môn học</label>
                        <div className="relative group">
                          <select
                            className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm appearance-none bg-white font-medium"
                            value={eduPlanInput.subject}
                            onChange={(e) => setEduPlanInput({ ...eduPlanInput, subject: e.target.value })}
                          >
                            <option value="">-- Chọn môn học --</option>
                            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-emerald-500 transition-colors">
                            <ChevronRight className="w-4 h-4 rotate-90" />
                          </div>
                        </div>
                      </div>

                      {eduPlanInput.subject === "Giáo dục địa phương" && (
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.14em]">Địa phương / Tỉnh thành</label>
                          <select
                            className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm appearance-none bg-white font-medium"
                            value={province}
                            onChange={(e) => setProvince(e.target.value)}
                          >
                            {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                          <p className="text-[10px] text-slate-400 mt-1 italic leading-relaxed">
                            * Lưu ý: Hiện tại danh sách bao gồm 6 thành phố và 28 tỉnh (theo cập nhật đơn vị hành chính 1/7/2025).
                          </p>
                        </div>
                      )}
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.14em]">Khối lớp</label>
                        <div className="relative group">
                          <select
                            className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm appearance-none bg-white font-medium"
                            value={eduPlanInput.grade}
                            onChange={(e) => setEduPlanInput({ ...eduPlanInput, grade: e.target.value })}
                          >
                            {GRADES.map(g => <option key={g} value={g}>Lớp {g}</option>)}
                          </select>
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-emerald-500 transition-colors">
                            <ChevronRight className="w-4 h-4 rotate-90" />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            checked={eduPlanInput.useLaTeX}
                            onChange={(e) => setEduPlanInput({ ...eduPlanInput, useLaTeX: e.target.checked })}
                          />
                          <span className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.05em] group-hover:text-emerald-600 transition-colors">Ưu tiên LaTeX / MathType</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            checked={eduPlanInput.detailDrawings}
                            onChange={(e) => setEduPlanInput({ ...eduPlanInput, detailDrawings: e.target.checked })}
                          />
                          <span className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.05em] group-hover:text-emerald-600 transition-colors">Mô tả chi tiết hình vẽ</span>
                        </label>
                      </div>

                      <button
                        onClick={handleGenerateKHTCM}
                        disabled={!eduPlanInput.subject}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-4 rounded-lg shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2"
                      >
                        <Sparkles className="w-5 h-5 fill-white/20" />
                        Tạo Kế hoạch Tổ chuyên môn
                      </button>
                    </div>
                  </div>
                )}

                {loading && (
                  <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <Loader2 className="w-12 h-12 text-emerald-600 animate-spin" />
                    <p className="text-brand-muted font-bold text-sm tracking-widest animate-pulse">AI ĐANG XÂY DỰNG KHUNG KẾ HOẠCH DẠY HỌC TỔ CHUYÊN MÔN...</p>
                  </div>
                )}

                {result && result.type === "kh-tcm" && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between sticky top-6 z-10 bg-brand-bg/80 backdrop-blur-md py-2 px-1">
                      <div className="flex flex-col">
                        <h3 className="text-xl font-extrabold text-brand-sidebar">Kế hoạch Dạy học Tổ chuyên môn</h3>
                        <div className="text-[10px] text-brand-muted font-bold uppercase flex items-center gap-2 mt-1">
                          Môn: {eduPlanInput.subject} <span className="w-1 h-1 bg-brand-muted rounded-full"></span> Khối {eduPlanInput.grade} {eduPlanInput.subject === "Giáo dục địa phương" && <><span className="w-1 h-1 bg-brand-muted rounded-full"></span> {province}</>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={downloadWord} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm" title="Tải xuống Word">
                          <FileDown className="w-4 h-4 text-blue-600" />
                        </button>
                        <button onClick={downloadPDF} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm" title="Tải xuống PDF">
                          <FileDown className="w-4 h-4 text-red-500" />
                        </button>
                        <button onClick={downloadText} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm" title="Tải xuống Text">
                          <FileText className="w-4 h-4 text-brand-muted" />
                        </button>
                        <button onClick={handleCopy} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm" title="Sao chép JSON">
                          <FileJson className="w-4 h-4 text-brand-accent" />
                        </button>
                        <button onClick={() => window.print()} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm">
                          <Printer className="w-4 h-4 text-brand-muted" />
                        </button>
                        <button
                          onClick={() => setResult(null)}
                          className="px-4 py-2 bg-brand-sidebar text-white rounded-lg text-xs font-bold shadow-md hover:bg-slate-900 transition-colors"
                        >
                          Tạo mới
                        </button>
                      </div>
                    </div>

                    <div ref={tableRef} className="glass rounded-[24px] p-6 shadow-2xl overflow-x-auto print:border-0 print:shadow-none print:bg-white paper">
                      <div className="mb-6">
                        <h4 className="text-lg font-extrabold text-brand-sidebar">1. Phân phối chương trình</h4>
                      </div>
                      <table className="w-full text-left text-[11px] border-collapse min-w-[1000px]">
                        <thead>
                          <tr className="border-b-2 border-slate-100">
                            <th className="p-4 font-extrabold text-brand-sidebar uppercase tracking-widest w-12 text-center">STT</th>
                            <th className="p-4 font-extrabold text-brand-sidebar uppercase tracking-widest w-48">Tên bài học/Chủ đề</th>
                            <th className="p-4 font-extrabold text-brand-sidebar uppercase tracking-widest">Mục tiêu bài học (CT 2018)</th>
                            <th className="p-4 font-extrabold text-brand-sidebar uppercase tracking-widest w-20 text-center">Tiết</th>
                            <th className="p-4 font-extrabold text-red-600 uppercase tracking-widest w-40">Năng lực AI tích hợp</th>
                            <th className="p-4 font-extrabold text-red-600 uppercase tracking-widest">Mục tiêu GD AI cụ thể (3439)</th>
                            <th className="p-4 font-extrabold text-brand-sidebar uppercase tracking-widest w-32">Hình thức triển khai</th>
                            <th className="p-4 font-extrabold text-brand-sidebar uppercase tracking-widest w-24 print:hidden text-center">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.data.map((item: any, i: number) => (
                            <tr key={i} className={`border-b border-slate-50 hover:bg-slate-50 transition-colors align-top ${item.aiCompetency.includes("Không tích hợp") ? "opacity-60" : ""}`}>
                              <td className="p-4 text-center font-bold text-slate-400">{i + 1}</td>
                              <td className="p-4 font-bold text-brand-sidebar">{item.lessonName}</td>
                              <td className="p-4 text-brand-muted leading-relaxed whitespace-pre-line text-[10px]">{item.lessonGoal}</td>
                              <td className="p-4 text-center font-bold text-slate-600">{item.periods}</td>
                              <td className={`p-4 font-bold ${item.aiCompetency.includes("Không tích hợp") ? "text-slate-400" : "text-red-600 bg-red-50/20"}`}>{item.aiCompetency}</td>
                              <td className="p-4 text-red-700 font-bold leading-relaxed whitespace-pre-line text-[10px] bg-red-50/10 border-l border-red-100">{item.aiObjective}</td>
                              <td className="p-4">
                                <span className="inline-block px-2 py-1 rounded-full bg-slate-100 text-slate-600 font-bold text-[9px] uppercase">
                                  {item.implementationForm}
                                </span>
                              </td>
                              <td className="p-4 print:hidden text-center">
                                <button
                                  onClick={() => {
                                    setEduPlanInput({
                                      ...eduPlanInput,
                                      subject: eduPlanInput.subject,
                                      grade: eduPlanInput.grade
                                    });
                                    setMode("khgd-gen");
                                    handleGenerateKHGD(result.data);
                                  }}
                                  className="mx-auto p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm flex items-center justify-center gap-2 px-4"
                                  title="Lập KH Giáo dục cá nhân"
                                >
                                  <Calendar className="w-3 h-3" />
                                  <span className="text-[10px] uppercase font-bold">Hợp nhất sang KHGD Cá nhân</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>

      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[24px] shadow-2xl p-8 max-w-md w-full relative"
            >
              <div className="mb-6">
                <h3 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                  <Settings className="w-6 h-6 text-indigo-500" /> Cài đặt Hệ thống
                </h3>
                <p className="text-sm text-slate-500 mt-2">
                  Cấu hình AI cho EduPlan. Chìa khóa API (API Key) được lưu trữ an toàn trên trình duyệt của bạn.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Google Gemini API Key
                  </label>
                  <input
                    type="password"
                    placeholder="Nhập API Key hợp lệ..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-slate-700 bg-slate-50"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                  <p className="text-xs text-slate-500 italic mt-1">
                    Bạn có thể lấy API Key miễn phí từ <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-indigo-500 font-bold hover:underline">Google AI Studio</a>.
                  </p>
                </div>

                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Chọn Model AI Ưu tiên
                  </label>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { id: "gemini-3-flash-preview", name: "Gemini 3.0 Flash", desc: "Tốc độ cực cao, thông minh (Khuyên dùng)" },
                      { id: "gemini-3-pro-preview", name: "Gemini 3.0 Pro", desc: "Siêu trí tuệ, lý luận sâu sắc nhất" },
                      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", desc: "Model tính ổn định cao nhất" }
                    ].map(model => (
                      <div
                        key={model.id}
                        onClick={() => setAiModel(model.id)}
                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${aiModel === model.id ? "border-indigo-500 bg-indigo-50" : "border-slate-100 hover:border-slate-300 bg-white"}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${aiModel === model.id ? "border-indigo-500 bg-indigo-500" : "border-slate-300"}`}>
                            {aiModel === model.id && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                          </div>
                          <div>
                            <p className={`text-sm font-bold ${aiModel === model.id ? "text-indigo-900" : "text-slate-700"}`}>{model.name}</p>
                            <p className={`text-[10px] font-medium mt-0.5 ${aiModel === model.id ? "text-indigo-600" : "text-slate-500"}`}>{model.desc}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setShowSettings(false)}
                  className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Đóng
                </button>
                <button
                  onClick={saveApiKey}
                  className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200"
                >
                  Lưu cài đặt
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sticky Footer */}
      <footer className="fixed bottom-0 left-0 w-full glass-dark py-2.5 px-6 z-50 border-t border-white/10 hidden lg:block">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_12px_rgba(52,211,153,0.9)]"></div>
            <span className="text-[10px] text-white/50 font-black uppercase tracking-[0.2em]">Bảo mật & Pháp lý BGDĐT</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 border-r border-white/10 pr-6">
              <span className="text-[10px] text-white/20 uppercase tracking-[0.1em] font-black">Tác giả</span>
              <p className="text-xs font-black text-blue-300 tracking-tight">Lê Thị Thái - THPT Bình Phú (Bình Dương)</p>
            </div>
            <a
              href="https://zalo.me/0916791779"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-[12px] text-[10px] font-black uppercase tracking-[0.1em] text-white hover:scale-105 active:scale-95 transition-all flex items-center gap-2 shadow-xl shadow-blue-500/20 group"
            >
              <span className="bg-white/20 p-1 rounded group-hover:bg-white/30 transition-colors">Zalo</span> 0916791779
            </a>
          </div>
        </div>
      </footer>

      <style>{`
        @media print {
          .lg\\:ml-\\[280px\\] { margin-left: 0 !important; }
          aside, header, nav, button, label, select, input, .no-print { display: none !important; }
          .min-h-screen { min-height: auto !important; }
          .p-4, .p-8, .p-12 { padding: 0 !important; }
          .max-w-5xl { max-width: 100% !important; }
          .paper { padding: 20px !important; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}

function NavItem({ active, icon, label, onClick, sidebar }: { active: boolean, icon: React.ReactNode, label: string, onClick: () => void, sidebar?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${active
        ? sidebar
          ? "bg-brand-accent/15 text-brand-accent font-extrabold"
          : "bg-brand-accent/10 text-brand-accent font-extrabold"
        : sidebar
          ? "text-white/60 hover:bg-white/5 hover:text-white"
          : "text-brand-muted hover:bg-white hover:text-brand-dark"
        }`}
    >
      <span className={active ? "text-brand-accent" : sidebar ? "text-white/30" : "text-brand-muted"}>{icon}</span>
      {label}
    </button>
  );
}

function FeatureCard({ icon, iconBg, title, desc, onClick }: { icon: React.ReactNode, iconBg: string, title: string, desc: string, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group glass p-8 rounded-[24px] text-left hover:bg-white/80 transition-all outline-none border border-white/40 shadow-xl overflow-hidden relative flex flex-col h-full"
    >
      <div className={`absolute top-0 right-0 w-32 h-32 ${iconBg}/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700`}></div>
      <div className={`mb-6 ${iconBg} w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transform group-hover:rotate-12 transition-transform`}>
        {icon}
      </div>
      <h3 className="text-xl font-black text-indigo-950 mb-3 leading-tight">{title}</h3>
      <p className="text-indigo-900/60 text-[13px] font-medium leading-relaxed mb-6 group-hover:text-indigo-950 transition-colors flex-1">{desc}</p>
      <div className="flex items-center gap-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest mt-auto">
        Khởi tạo ngay <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
      </div>
    </button>
  );
}
