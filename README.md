# EduPlan AI

EduPlan AI là ứng dụng web hỗ trợ giáo viên lớp 1–12 xây dựng, rà soát và nâng cấp kế hoạch giáo dục theo CT GDPT 2018. Ứng dụng hỗ trợ định hướng năng lực số theo TT 02/2025 và năng lực AI theo QĐ 3439/QĐ-BGDĐT.

## Tính năng chính

- Tạo kế hoạch bài dạy theo CV 2345 cho tiểu học và CV 5512 cho THCS/THPT.
- Tạo kế hoạch giáo dục giáo viên, kế hoạch tổ chuyên môn và kế hoạch hoạt động giáo dục.
- Nâng cấp tệp DOCX tại chỗ, giữ cấu trúc gốc và chèn nội dung NLS/NL AI vào đúng hoạt động.
- Tra cứu bảng mã năng lực số theo mức lớp.
- Tạo học liệu Sử - Địa, khung năng lực AI và công cụ đánh giá.
- Xuất Word, PDF, PowerPoint, HTML và văn bản.
- Tự lưu bản nháp, lịch sử cục bộ, sao lưu và khôi phục dữ liệu thiết bị.
- Hỗ trợ PWA và chế độ ngoại tuyến cho dữ liệu đã lưu; các tính năng AI vẫn cần Internet.

## Chạy cục bộ

Yêu cầu: Node.js 20 trở lên và npm.

1. Cài thư viện:

       npm install

2. Khởi chạy ứng dụng:

       npm run dev

3. Mở http://localhost:3000, vào Cài đặt và nhập Gemini API key cá nhân.

API key chỉ được lưu trong trình duyệt hiện tại. Không đặt API key thật trong mã nguồn, tệp môi trường phía client hoặc commit GitHub.

## Kiểm tra trước phát hành

Chạy toàn bộ kiểm tra:

    npm run check

Hoặc chạy riêng:

    npm run lint
    npm run build

Thư mục dist là đầu ra tĩnh có thể triển khai trên Vercel hoặc nền tảng hosting tĩnh tương thích SPA.

## Dữ liệu người dùng

Lịch sử, bản nháp và API key được lưu cục bộ trên thiết bị. File sao lưu do ứng dụng tạo không chứa API key. Người dùng nên tự quản lý khóa, hạn mức và quyền truy cập Google AI Studio.
