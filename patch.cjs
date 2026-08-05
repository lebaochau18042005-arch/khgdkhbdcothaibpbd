const fs = require('fs');
let content = fs.readFileSync('src/services/geminiService.ts', 'utf8');

// Replace the geography formatting
content = content.replace(
    /defaultCurriculum = \`MỤC LỤC CHÍNH XÁC SÁCH GIÁO KHOA ĐỊA LÍ 10 - KẾT NỐI TRI THỨC VỚI CUỘC SỐNG:\\n\$\{GEO_10_KNTT\}\`;/,
    'defaultCurriculum = `MỤC LỤC VÀ YÊU CẦU CẦN ĐẠT (YCCĐ) CHÍNH XÁC TỪNG BÀI - ĐỊA LÍ 10 KẾT NỐI TRI THỨC VỚI CUỘC SỐNG:\\n${JSON.stringify(GEO_10_KNTT, null, 2)}`;'
);

// Update prompt instructions
content = content.replace(
    /1\. Rà soát & Phân tích toàn diện: Hãy rà soát TOÀN BỘ các chủ đề \/ bài học trong chương trình GDPT 2018 của môn này\. LỆNH TỐI CẤP: BẠN KHÔNG ĐƯỢC BỎ SÓT BẤT KỲ BÀI HỌC NÀO, PHẢI LIỆT KÊ ĐỦ 35 TUẦN HỌC \/ ĐỦ TOÀN BỘ NỘI DUNG SGK\. TRẢ VỀ TOÀN BỘ DANH SÁCH BÀI HỌC CỦA CẢ NĂM HỌC\./,
    '1. Rà soát & Phân tích toàn diện: LỆNH TỐI CẤP: BẠN KHÔNG ĐƯỢC BỎ SÓT BẤT KỲ BÀI HỌC, CHUYÊN ĐỀ, HAY BÀI KIỂM TRA ĐÁNH GIÁ NÀO CÓ TRONG DANH SÁCH. PHẢI LIỆT KÊ ĐỦ 35 TUẦN HỌC. ĐẶC BIỆT: Phải XEN KẼ các tiết "Ôn tập", "Kiểm tra đánh giá" (Giữa kì, Cuối kì) và Chuyên đề vào các tuần tương ứng để hoàn thiện Kế hoạch Tổ chuyên môn đúng chuẩn thực tế.'
);

content = content.replace(
    /- Nội dung \(lessonContent\): Tên bài học, chủ đề hoặc nội dung chi tiết\. Phải khớp 100% với danh sách gốc SGK\./,
    '- Nội dung (lessonContent): Tên bài học, chủ đề, chuyên đề hoặc tên bài kiểm tra. Phải lấy từ danh sách gốc.'
);

content = content.replace(
    /- Yêu cầu cần đạt CT 2018 \(lessonGoal\): BẮT BUỘC dùng nội dung "yccd" nếu có từ dữ liệu cung cấp \(sao chép y nguyên\)\. Nếu không có, mô tả Kiến thức, Năng lực hướng tới của bài học đó theo CT 2018\./,
    '- Yêu cầu cần đạt CT 2018 (lessonGoal): BẮT BUỘC SAO CHÉP Y NGUYÊN 100% nội dung "yccd" (hoặc "YCCĐ") được cung cấp trong danh sách gốc cho từng bài học/chuyên đề/kiểm tra tương ứng. BẠN KHÔNG ĐƯỢC PHÉP TÓM TẮT HAY CẮT XÉN YCCĐ GỐC!'
);

fs.writeFileSync('src/services/geminiService.ts', content, 'utf8');
