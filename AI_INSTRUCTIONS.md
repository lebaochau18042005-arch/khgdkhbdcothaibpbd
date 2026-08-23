# Các quy tắc phát triển và vận hành dự án (AI Instructions)

Tài liệu này ghi lại các quy tắc đã được thống nhất để AI hoặc các nhà phát triển sau này tuân thủ khi chỉnh sửa dự án.
Tôi đang triển khai ứng dụng từ github qua vercel, hãy kiểm tra giúp tôi các file vercel.json, index.html có tham chiếu đúng chưa và hướng dẫn tôi setup api key gemini để người dùng tự nhập API key của họ để chạy app

## 1. Cấu hình Model AI & Cơ chế Fallback
- **Model mặc định**: `gemini-3-pro-preview`
- **Model dự phòng**: Tự động chuyển đổi nếu model hiện tại gặp lỗi/quá tải:
  1. `gemini-3-flash-preview`
  2. `gemini-3-pro-preview`
  3. `gemini-2.5-flash`
- **Cơ chế Retry**:
  - Nếu một bước xử lý (Step 1, 2, hoặc 3) gặp lỗi API, hệ thống **tự động** thử lại ngay lập tức với model tiếp theo trong danh sách.
  - Vẫn giữ nguyên kết quả của các bước trước đó, chỉ retry bước đang lỗi.

## 2. Quản lý API Key
- **Cơ chế**:
  - Người dùng nhập API key vào Modal hoặc qua nút Settings trên Header.
  - Lưu vào `localStorage` của trình duyệt.
  - Ưu tiên sử dụng key từ `localStorage`.
- **Giao diện**:
  - **Thiết lập Model & API Key**: Cần hiển thị như hình mẫu.
    - Hiển thị danh sách chọn Model AI (dạng thẻ/Cards).
    - Thứ tự hiển thị: `gemini-3-flash-preview` (Default), `gemini-3-pro-preview`, `gemini-2.5-flash`.
  - Nút **Settings (API Key)** kèm dòng chữ màu đỏ "Lấy API key để sử dụng app" phải luôn hiển thị trên Header để người dùng dễ dàng thay đổi key khi hết quota. 
  - Khi chưa có key, hiển thị Modal bắt buộc nhập.
  - Việc nhập key ban đầu trước khi dùng app, hướng dẫn người dùng vào https://aistudio.google.com/api-keys để lấy key API

## 3. Quản lý Trạng thái & Lỗi (State Management)
- **Hiển thị lỗi**:
  - Nếu tất cả các model đều thất bại -> Hiện thông báo lỗi màu đỏ, hiển thị nguyên văn lỗi từ API (VD: `429 RESOURCE_EXHAUSTED`).
  - Trạng thái các cột đang chờ phải chuyển thành **"Đã dừng do lỗi"**, tuyệt đối không được hiện "Hoàn tất" hoặc checkmark xanh nếu quy trình bị gián đoạn.
- **Tiến trình**:
  - Progress bar chỉ hiển thị trạng thái hoàn thành (xanh) khi bước đó thực sự thành công.

## 4. Triển khai (Deployment)
- **Nền tảng**: Vercel.
- **File bắt buộc**: `vercel.json` ở root để xử lý SPA routing.
  ```json
  {
    "rewrites": [
      {
        "source": "/(.*)",
        "destination": "/index.html"
      }
    ]
  }
  ```

## 5. Cấu hình Khung Pháp Lý & Chuẩn Tích Hợp Giáo Dục (Năm học 2026 - 2027)
- **Phạm vi cấp học (`APP_SCOPE`)**: `THPT`
- **Khối lớp cho phép (`ALLOWED_GRADES`)**: `["10", "11", "12"]`
- **Bộ sách chuẩn (`TEXTBOOK_SYSTEM`)**: `Kết nối tri thức với cuộc sống`
- **Nhà xuất bản (`PUBLISHER_SYSTEM`)**: `Nhà xuất bản Giáo dục Việt Nam`
- **Khung Năng lực số (`NLS_FRAMEWORK`)**: `TT 02/2025/TT-BGDĐT`
- **Hướng dẫn triển khai NLS (`NLS_IMPLEMENTATION`)**: `CV 3456/BGDĐT-GDPT`
- **Nguồn mã NLS (`NLS_CODE_SOURCE`)**: `Bảng mã NLS do người dùng cung cấp`
- **Mức NLS cho THPT (`NLS_LEVEL_FOR_HIGH_SCHOOL`)**: `NC` (Nâng cao)
- **Khung Giáo dục AI mới (`AI_FRAMEWORK`)**: `QĐ 2422/QĐ-BGDĐT ngày 18/8/2026` (Áp dụng triển khai từ năm học 2026 - 2027)
- **Hướng dẫn triển khai GD AI (`AI_IMPLEMENTATION`)**: `CV 5588/BGDĐT-GDPT ngày 19/8/2026`
- **Khung AI cũ (`LEGACY_AI_FRAMEWORK`)**: `QĐ 3439/QĐ-BGDĐT`
- **Trạng thái Khung cũ (`LEGACY_AI_STATUS`)**: `Chỉ lưu lịch sử, không dùng tạo mới. Tuyệt đối không ưu tiên sử dụng khi nội dung đã được cập nhật thay thế bằng QĐ 2422/QĐ-BGDĐT năm 2026`
- **Cấu trúc KHBD bắt buộc (`REQUIRED_LESSON_PLAN_STRUCTURE`)**: `CV 5512` (CV 5512/BGDĐT-GDTrH)
- **Chính sách bảo toàn (`ORIGINAL_CONTENT_POLICY`)**: `Giữ nguyên nội dung gốc`
- **Màu chữ đánh dấu tích hợp bổ sung (`INTEGRATION_COLOR`)**: `#FF0000` (Đỏ)

## 6. Quy Trình Phân Loại, Trích Xuất & Kiểm Soát Nguồn Tài Liệu

### 6.1. Phân loại tài liệu (12 nhóm bắt buộc)
1. `Chương trình môn học/YCCĐ`
2. `SGK Kết nối tri thức - NXBGD`
3. `PPCT/KHGD`
4. `Giáo án/KHBD`
5. `PL1` (Phụ lục 1)
6. `PL2` (Phụ lục 2)
7. `PL3` (Phụ lục 3)
8. `PL4` (Phụ lục 4)
9. `Tài liệu NLS`
10. `Tài liệu AI`
11. `Văn bản pháp lý`
12. `Tài liệu tham khảo`

### 6.2. Các trường dữ liệu trích xuất tự động
- `môn học`, `lớp`, `học kỳ`, `năm học`, `bài/chủ đề`, `YCCĐ`, `số tiết`, `tuần`, `tiết PPCT`, `hoạt động`, `sản phẩm`, `thiết bị`, `học liệu`, `mã NLS`, `mã AI`, `nguồn`, `số trang`, `vị trí thông tin`.

### 6.3. Quy tắc xử lý ngoại lệ và thiếu dữ liệu
- **Không rõ môn học hoặc lớp**: Tuyệt đối KHÔNG tạo sản phẩm chính thức.
- **Thiếu PPCT**: KHÔNG tự bịa tuần/tiết $\rightarrow$ Ghi rõ: `"Theo PPCT của nhà trường"`.
- **Thiếu YCCĐ**: KHÔNG tự tạo YCCĐ $\rightarrow$ Ghi rõ: `"Chưa có YCCĐ trong nguồn cung cấp"`.
- **Tài liệu mâu thuẫn**: 
  - Lập bảng đối chiếu chi tiết chỉ rõ điểm mâu thuẫn.
  - Không tự ý chọn một phương án.
  - Gán nhãn trạng thái: `"Cần chuyên gia xác nhận"`.

### 6.4. Metadata lưu vết nguồn gốc (Source Provenance)
Mỗi đơn vị nội dung trích xuất bắt buộc lưu trữ đủ metadata:
- `source_id`
- `tên file`
- `loại nguồn` (thuộc 1 trong 12 nhóm)
- `số hiệu`
- `ngày ban hành`
- `trạng thái hiện hành/lịch sử`
- `số trang`
- `vị trí nội dung` (dòng, mục, bảng)
- `môn`
- `lớp`
- `bài/chủ đề`

## 7. Chuỗi Đối Chiếu & Quy Tắc Gán Mã Tích Hợp NLS / NL AI Chuẩn

### 7.1. Chuỗi đối chiếu 13 bước bắt buộc (Tuyệt đối không gán mã trực tiếp từ tên bài hay từ khóa)
```
YCCĐ môn học nguyên văn 
  → Động từ hành động 
  → Nội dung kiến thức 
  → Nhiệm vụ học tập 
  → Hành vi quan sát được của học sinh 
  → Sản phẩm 
  → Minh chứng 
  → Mã NLS (TT 02/CV 3456 - mức NC) 
  → Thành phần năng lực AI (QĐ 2422) 
  → YCCĐ AI theo QĐ 2422 
  → Mã AI (QĐ 2422/CV 5588) 
  → Công cụ 
  → Kiểm chứng 
  → Tiêu chí đánh giá
```

### 7.2. Nguyên tắc ưu tiên YCCĐ môn học
- **YCCĐ môn học là căn cứ chính và tối cao**: Tuyệt đối không được thay thế hay viết lại bằng YCCĐ AI.
- **YCCĐ AI theo QĐ 2422**: Chỉ dùng để nhận diện và xác định năng lực AI được phát triển thông qua nhiệm vụ học tập của môn học.

### 7.3. Phân nhánh 4 trạng thái tích hợp
Mỗi hoạt động / YCCĐ chỉ thuộc 1 trong 4 trạng thái:
1. `Không tích hợp NLS và NL AI`
2. `Chỉ tích hợp NLS`
3. `Chỉ tích hợp NL AI`
4. `Tích hợp cả NLS và NL AI`
*(Không áp đặt cơ học việc mọi hoạt động/bài học phải tích hợp cả hai).*

### 7.4. Chuẩn văn bản khi không có điểm chạm hoặc thiếu căn cứ
- Khi không có hành vi số/AI quan sát được: Ghi chính xác `"Không tích hợp NLS/NL AI trong hoạt động này."`
- Khi chưa đủ căn cứ đối chiếu: Ghi chính xác `"Cần chuyên gia xác nhận."`

## 8. Khung Năng Lực Số (NLS) & Chuẩn Mã Hóa Dành Riêng Cho THPT

### 8.1. 6 Miền năng lực số
1. `Miền 1`: Khai thác dữ liệu và thông tin
2. `Miền 2`: Giao tiếp và hợp tác trong môi trường số
3. `Miền 3`: Sáng tạo nội dung số
4. `Miền 4`: An toàn
5. `Miền 5`: Giải quyết vấn đề
6. `Miền 6`: Ứng dụng trí tuệ nhân tạo *(Chỉ dùng khi HS thực sự hiểu, sử dụng, kiểm chứng hoặc đánh giá AI)*

### 8.2. Định dạng & Mức mã chuẩn cho THPT (Lớp 10 – 12)
- **Nguồn mã**: Lấy nguyên từ *Bảng mã NLS do người dùng cung cấp*.
- **Cấu trúc mã bắt buộc**: `[miền].[năng lực thành phần].NC[chỉ báo]`
  - Ví dụ hợp lệ: `1.1.NCa`, `1.1.NCb`, `1.2.NCa`, `3.1.NCa`, `6.2.NCa`
- **CẤM SỬ DỤNG**:
  - Không dùng mức `CB` (Cơ bản) và `TC` (Trung cấp) cho cấp THPT.
  - Không dùng dạng `NC1a` (có số 1 sau chữ NC).
  - Không dùng mã tự tạo hoặc mã không có trong bảng do người dùng nạp vào.

### 8.3. Điều kiện chấp nhận & Giới hạn số lượng mã
- **Đủ 7 yếu tố cấu thành**: YCCĐ $\rightarrow$ Nhiệm vụ số $\rightarrow$ Hành vi số $\rightarrow$ Công cụ $\rightarrow$ Sản phẩm $\rightarrow$ Minh chứng $\rightarrow$ Tiêu chí đánh giá.
- **Chống hình thức**: Không gán mã chỉ vì giáo viên hoặc hoạt động có máy tính, Internet, máy chiếu hay thiết bị số.
- **Số lượng mã**: Mặc định **01 mã NLS chính** cho mỗi bài/chủ đề. Chỉ thêm mã phụ khi có hành vi số thứ hai độc lập và rõ ràng.

## 9. Khung Năng Lực AI Theo QĐ 2422/QĐ-BGDĐT & Chuẩn Mã Hóa

### 9.1. 4 Thành phần năng lực AI
- `NLa`: Tư duy lấy con người làm trung tâm
- `NLb`: Đạo đức AI, an toàn, pháp luật và trách nhiệm
- `NLc`: Các kĩ thuật và ứng dụng AI
- `NLd`: Thiết kế, thử nghiệm và cải tiến hệ thống AI

### 9.2. Cấu trúc mã AI chuẩn QĐ 2422
- **Cấu trúc**: `[Lớp].[Mã chủ đề].[Số thứ tự]`
- **Ví dụ hợp lệ**: `10.A1.1`, `10.C3.2`, `11.C3.MR1`, `12.C4.MR1`, `12.D2.MR3`
- **TUYỆT ĐỐI KHÔNG SỬ DỤNG MÃ CŨ (Khung 3439/thí điểm)**:
  - ❌ `10.A2.01`, `10.B3.01`, `10.C2.01`, `10.C3.01`, `12.C1.01`... (mã có số thứ tự dạng `01`, `02` cũ).
- **Quy tắc tra cứu**: Mã AI bắt buộc tra cứu trực tiếp từ bảng YCCĐ của QĐ 2422; tuyệt đối không tự bịa mã ngoài QĐ 2422.

### 9.3. Điều kiện tích hợp NL AI cho học sinh
Chỉ tích hợp NL AI khi học sinh trực tiếp:
1. Sử dụng công cụ AI trong nhiệm vụ học tập.
2. Thiết kế, viết hoặc chỉnh sửa câu lệnh Prompt.
3. Kiểm chứng, đối chiếu kết quả do AI phản hồi.
4. Đánh giá độ tin cậy, tính logic của thông tin AI.
5. Phân tích rủi ro, thiên kiến thuật toán hoặc tác động xã hội.
6. Bảo vệ dữ liệu cá nhân & tuân thủ an toàn số.
7. Tôn trọng bản quyền & minh bạch nguồn gốc sản phẩm AI.
8. Thiết kế, thử nghiệm hoặc cải tiến giải pháp/sản phẩm ứng dụng AI.
*(Nếu chỉ giáo viên dùng AI để soạn bài/chuẩn bị học liệu $\rightarrow$ KHÔNG gán mã NL AI cho học sinh).*

### 9.4. Định dạng ô NL AI trong Phụ lục
Chỉ trình bày cô đọng 5 trường thông tin:
`[Mã AI] | [Nhiệm vụ] | [Sản phẩm] | [Công cụ] | [Kiểm chứng]`

## 10. Bảng Đối Chiếu Trung Gian Bắt Buộc (Intermediate Mapping Table)

### 10.1. Quy trình bắt buộc trước khi sinh PL hoặc Giáo án
- Trước khi khởi tạo bất kỳ PL1, PL2, PL3, PL4 hay KHBD/Giáo án nào, hệ thống **bắt buộc phải tạo Bảng đối chiếu trung gian**.
- **Tuyệt đối không được rút gọn hoặc bỏ qua** bước tạo bảng đối chiếu trung gian.

### 10.2. Cấu trúc 22 cột chuẩn của Bảng đối chiếu trung gian
1. `STT`
2. `Môn`
3. `Lớp`
4. `Bài/chủ đề`
5. `YCCĐ môn học nguyên văn`
6. `Động từ hành động`
7. `Nội dung kiến thức`
8. `Hoạt động`
9. `Nhiệm vụ học tập`
10. `Hành vi số/AI`
11. `Sản phẩm`
12. `Minh chứng`
13. `Mã NLS`
14. `Chỉ báo NLS`
15. `Thành phần AI`
16. `YCCĐ AI theo QĐ 2422`
17. `Mã AI`
18. `Công cụ`
19. `Cách kiểm chứng`
20. `Tiêu chí đánh giá`
21. `Nguồn`
22. `Trạng thái` (`Đã xác minh` | `Cần chuyên gia xác nhận` | `Không tích hợp NLS/NL AI`)

### 10.3. Cổng duyệt dữ liệu (Verification Gate)
- **Chỉ những dòng có trạng thái `"Đã xác minh"`** mới được phép đưa vào PL1, PL2, PL3, PL4 và Kế hoạch bài dạy / Giáo án.
- Các dòng có trạng thái `"Cần chuyên gia xác nhận"` hoặc chưa đủ điều kiện sẽ được giữ lại ở bảng đối chiếu để người dùng/chuyên gia duyệt trước khi chuyển tiếp.

## 11. Quy Chuẩn Xây Dựng Phụ Lục 1 (PL1 - Kế Hoạch Dạy Học Cấp Tổ Chuyên Môn)

### 11.1. Căn cứ nguồn
- Chỉ tạo PL1 từ chương trình môn học, PPCT và kế hoạch giáo dục **đã xác minh** qua Bảng đối chiếu trung gian.

### 11.2. Các yếu tố bắt buộc GIỮ NGUYÊN TUYỆT ĐỐI
- Tên bài / Chủ đề
- Số tiết của từng bài và tổng số tiết môn học
- Tuần học và thời điểm tổ chức
- Thiết bị dạy học, học liệu, địa điểm dạy học (phòng học bộ môn, thực hành...)
- Các chuyên đề học tập lựa chọn và nhiệm vụ chuyên môn khác
- Cấu trúc bảng và các cột có sẵn trong file/mẫu gốc của tổ chuyên môn

### 11.3. Nội dung được phép bổ sung (Đánh dấu chữ đỏ `#FF0000`)
- Yêu cầu cần đạt (YCCĐ) theo CT GDPT 2018
- Năng lực số (NLS) theo TT 02/2025 (Mức NC)
- Năng lực AI theo QĐ 2422/2026
- Nhiệm vụ học tập, sản phẩm học sinh, minh chứng và công cụ đánh giá

### 11.4. Các điều cấm tuyệt đối
- ❌ Không xóa hoặc gộp các cột trong bảng gốc.
- ❌ Không tự ý thay đổi số tiết đã được phê duyệt.
- ❌ Không tự ý bịa đặt tuần học khi nguồn chưa cung cấp.
- ❌ Không gán mã tràn lan/cơ học cho toàn bộ các bài học trong chương trình.
- ❌ PL1 bắt buộc phải khớp 100% với dữ liệu chương trình môn học và PPCT chính thức.

## 12. Quy Chuẩn Xây Dựng Phụ Lục 2 (PL2 - Kế Hoạch Tổ Chức Hoạt Động Giáo Dục / Năng Lực)

### 12.1. Căn cứ nguồn
- Tạo PL2 từ **PL1, chương trình môn học và YCCĐ đã xác minh** từ Bảng đối chiếu trung gian.

### 12.2. Các thành phần bắt buộc thể hiện trong PL2
- `Môn học`, `Lớp`, `Bài/chủ đề`, `YCCĐ`
- `Năng lực đặc thù` môn học, `Năng lực chung`, `Phẩm chất chủ yếu`
- `Năng lực số (NLS)` (TT 02/CV 3456 - Mức NC)
- `Năng lực AI (NL AI)` (QĐ 2422/CV 5588)
- `Hoạt động dạy học`, `Sản phẩm học tập`, `Phương pháp/công cụ Đánh giá`
- `Thiết bị dạy học`, `Học liệu số/truyền thống`

### 12.3. Quy tắc bố trí mục tiêu & Tích hợp
- NLS và NL AI phải được bố trí ở **phần tích hợp riêng biệt**.
- **Tuyệt đối không đưa mã NLS / NL AI vào mục tiêu kiến thức, năng lực đặc thù môn học** nếu mẫu gốc của Bộ/Nhà trường không có yêu cầu.

### 12.4. Nguyên tắc đồng bộ 100% với PL1
PL2 phải thống nhất và đồng bộ hoàn toàn với PL1 ở các trường:
- `Tên bài/chủ đề`
- `Số tiết`
- `YCCĐ môn học`
- `Mã NLS`
- `Mã AI`
- `Sản phẩm`
- `Hình thức / Tiêu chí đánh giá`

## 13. Quy Chuẩn Xây Dựng Phụ Lục 3 (PL3 - Kế Hoạch Giáo Dục Của Giáo Viên Theo CV 5512)

### 13.1. Cấu trúc khung chuẩn Phụ lục III CV 5512/BGDĐT-GDTrH
Bắt buộc giữ nguyên toàn bộ cấu trúc:
- `I. Kế hoạch dạy học`
  - `1. Phân phối chương trình`
  - `2. Chuyên đề lựa chọn (nếu có)`
- `II. Nhiệm vụ khác (nếu có)`

### 13.2. Các cột bắt buộc GIỮ NGUYÊN TUYỆT ĐỐI
- `STT`
- `Bài học/chuyên đề`
- `Số tiết`
- `Thời điểm` (Tuần, ngày/tháng)
- `Thiết bị dạy học` *(TUYỆT ĐỐI KHÔNG ĐƯỢC XÓA)*
- `Địa điểm dạy học` *(TUYỆT ĐỐI KHÔNG ĐƯỢC XÓA)*

### 13.3. Các cột / phần tích hợp được phép bổ sung (Đánh dấu chữ đỏ `#FF0000`)
- `Tích hợp NLS` (TT 02/2025 - Mức NC)
- `Tích hợp NL AI` (QĐ 2422/2026)
- `Nhiệm vụ`, `Sản phẩm`, `Minh chứng`, `Công cụ đánh giá`

### 13.4. Kiểm tra đồng bộ dữ liệu (Integrity Check)
- PL3 bắt buộc phải lấy và kế thừa dữ liệu trực tiếp từ **PL1 và PL2 đã xác minh**.
- Nếu phát hiện sai lệch tên bài, số tiết, mã NLS, mã AI hoặc thông số sư phạm so với PL1/PL2 $\rightarrow$ Hệ thống phát cảnh báo:
  > **`"PL3 không đồng bộ với dữ liệu nguồn."`**

## 14. Quy Chuẩn Xây Dựng Phụ Lục 4 / Kế Hoạch Bài Dạy (PL4/KHBD Chuẩn CV 5512)

### 14.1. Căn cứ nguồn
- Tạo PL4/KHBD trực tiếp từ **PL1, PL2, PL3, SGK Kết nối tri thức, PPCT và giáo án gốc của giáo viên**.

### 14.2. Bảo toàn 100% nội dung giáo án gốc
Bắt buộc giữ nguyên toàn bộ các nội dung gốc từ file tải lên của giáo viên:
- `Tên bài`, `Lớp`, `Môn`, `Thời lượng (số tiết)`
- `Mục tiêu`, `YCCĐ`, `Nội dung kiến thức chuyên môn`
- `Hệ thống câu hỏi`, `Đáp án/Lời giải chi tiết`
- `Học liệu`, `Thiết bị dạy học`
- `Bảng biểu số liệu`, `Sơ đồ`, `Hình ảnh minh họa`, `Công thức khoa học`

### 14.3. Cấu trúc chuẩn từng Hoạt động dạy học theo CV 5512
Mỗi hoạt động dạy học (Mở đầu, Hình thành kiến thức, Luyện tập, Vận dụng) bắt buộc có đủ 7 thành phần cấu trúc rõ ràng:
1. `Mục tiêu`: Nêu rõ mục tiêu cần đạt của riêng hoạt động đó.
2. `Nội dung`: Nhiệm vụ, nội dung học tập cụ thể giao cho học sinh.
3. `Sản phẩm`: Kết quả, câu trả lời, sản phẩm học sinh cần hoàn thành.
4. `Tổ chức thực hiện`:
   - `Bước 1: Giao nhiệm vụ` (Chuyển giao nhiệm vụ học tập).
   - `Bước 2: Thực hiện nhiệm vụ` (Học sinh làm việc cá nhân / nhóm).
   - `Bước 3: Báo cáo, thảo luận` (Trình bày sản phẩm, đối chiếu, phản biện).
   - `Bước 4: Kết luận, nhận định` (Giáo viên chính xác hóa, đánh giá, chốt kiến thức).

### 14.4. Nguyên tắc tích hợp NLS / NL AI (Đánh dấu chữ đỏ `#FF0000`)
- **Tích hợp chính xác**: Chèn nội dung NLS / NL AI vào **đúng hoạt động, đúng nhiệm vụ và đúng sản phẩm cụ thể** có phát sinh hành vi số/AI của học sinh.
- **Nghiêm cấm ghi chung chung**: Tuyệt đối KHÔNG chỉ ghi một câu khẩu hiệu chung chung kiểu *"Bài học có tích hợp NLS và NL AI"* mà không gắn mã, hành vi và sản phẩm vào bước tổ chức thực hiện cụ thể.

## 15. Quy Chuẩn Nâng Cấp Giáo Án Gốc & Đánh Dấu Tích Hợp Bổ Sung

### 15.1. Nguyên tắc bảo toàn nội dung gốc (100% không viết lại)
Giữ nguyên toàn bộ nội dung giáo án do giáo viên tải lên:
- Toàn bộ nội dung văn bản, bố cục, hệ thống hoạt động
- Mục tiêu, YCCĐ môn học
- Hệ thống câu hỏi, đáp án, lời giải
- Bảng số liệu, biểu đồ, sơ đồ, công thức khoa học, hình ảnh
- Thiết bị dạy học và học liệu

### 15.2. 10 Thành phần tích hợp ĐƯỢC PHÉP bổ sung
Chỉ bổ sung các nội dung tích hợp sau tại đúng vị trí có điểm chạm thực tế:
1. `Mã NLS` (chuẩn `[miền].[NLTP].NC[chỉ báo]`)
2. `Chỉ báo NLS`
3. `Mã AI` (chuẩn `[Lớp].[Chủ đề].[Số TT]` theo QĐ 2422)
4. `Nhiệm vụ số / AI`
5. `Sản phẩm số`
6. `Công cụ số / nền tảng AI`
7. `Cách kiểm chứng thông tin / độ tin cậy`
8. `Minh chứng đánh giá`
9. `Tiêu chí đánh giá (Rubric)`
10. `Phương án dự phòng không Internet / không thiết bị số` (Offline fallback)

### 15.3. Bố trí vị trí tích hợp
- **Tuyệt đối không chèn mã NLS/NL AI vào**: Mục tiêu kiến thức, Năng lực đặc thù, Năng lực chung hoặc Phẩm chất của bài học.
- Chỉ đặt tại phần bổ trợ năng lực số/AI hoặc ngay tại Bước 2 (Thực hiện nhiệm vụ) của hoạt động tương ứng.

### 15.4. Quy chuẩn màu chữ & Nhãn nhận diện
- **Màu chữ bắt buộc**: Toàn bộ nội dung bổ sung khi xuất ra file Word/HTML phải được định dạng **màu đỏ (`#FF0000`)**.
- **Nhãn dự phòng**: Trong môi trường văn bản thuần (plain text) hoặc nơi không hỗ trợ tô màu $\rightarrow$ Gắn nhãn chuẩn:
  `[NỘI DUNG BỔ SUNG - TÔ MÀU ĐỎ]`

## 16. Bảng Kiểm Định 23 Tiêu Chí Xuất File Chính Thức (Export Gatekeeper)

### 16.1. 23 Tiêu chí kiểm định bắt buộc
Chỉ cho phép xuất file chính thức (Word/PDF/Excel) khi thỏa mãn toàn bộ 23 tiêu chí sau:
1. `[ ]` Đúng phạm vi lớp THPT: **Lớp 10, 11 hoặc 12**.
2. `[ ]` Đúng môn học trong chương trình THPT.
3. `[ ]` Đúng bộ sách chuẩn: **Kết nối tri thức với cuộc sống - NXB Giáo dục Việt Nam**.
4. `[ ]` Đúng Phân phối chương trình (PPCT) nếu có dữ liệu nguồn.
5. `[ ]` **Không tự tạo YCCĐ** (trích xuất nguyên văn từ CT 2018 / SGK).
6. `[ ]` **Không tự tạo số tiết**.
7. `[ ]` **Không tự tạo tuần** (nếu thiếu ghi *"Theo PPCT của nhà trường"*).
8. `[ ]` **Không còn mã QĐ 3439** trong dữ liệu đang hoạt động (active state).
9. `[ ]` Mã NLS đúng định dạng chuẩn mức **NC**: `[miền].[NLTP].NC[chỉ báo]`.
10. `[ ]` Mã NLS **tồn tại trong bảng mã do người dùng nạp**.
11. `[ ]` Mã AI **tồn tại trong Bảng YCCĐ của QĐ 2422/QĐ-BGDĐT**.
12. `[ ]` **Không có mã AI cũ** (dạng thí điểm `01`, `02`...).
13. `[ ]` Mỗi mã tích hợp đều gắn với **nhiệm vụ học tập cụ thể**.
14. `[ ]` Mỗi mã tích hợp đều gắn với **sản phẩm học tập rõ ràng**.
15. `[ ]` Mỗi mã tích hợp đều có **minh chứng đánh giá đo lường được**.
16. `[ ]` Có đầy đủ **công cụ số/AI và tiêu chí đánh giá (Rubric)**.
17. `[ ]` **PL1, PL2, PL3, PL4 hoàn toàn thống nhất** dữ liệu với nhau.
18. `[ ]` **Giáo án/KHBD hoàn toàn thống nhất** với PL4.
19. `[ ]` Hình ảnh, sơ đồ, học liệu đúng nguồn SGK / học liệu số chính thức.
20. `[ ]` **Nội dung gốc của giáo viên được giữ nguyên 100%**.
21. `[ ]` Toàn bộ phần bổ sung được **tô màu đỏ `#FF0000`** (hoặc gắn nhãn chuẩn).
22. `[ ]` Có **phương án ngoại tuyến (không Internet / không thiết bị)** khi cần.
23. `[ ]` **Không vi phạm dữ liệu cá nhân** của học sinh và tuân thủ bản quyền.

### 16.2. Cơ chế khóa & Nhãn cảnh báo
- Nếu có **bất kỳ mục nào trong 23 tiêu chí chưa đạt**:
  - **Khóa hoàn toàn chức năng xuất file chính thức**.
  - Hiển thị nhãn cảnh báo bắt buộc trên tài liệu:
    > **`“BẢN NHÁP - CHƯA ĐẠT KIỂM ĐỊNH.”`**

## 17. Quy Chuẩn Kiểm Tra Trực Quan Sau Xuất File (Visual Inspection Protocol)

### 17.1. 9 Tiêu chí kiểm tra trực quan sau xuất Word/Excel
Sau khi file Word (.docx) hoặc Excel (.xlsx) được kết xuất, hệ thống bắt buộc kiểm tra các lỗi định dạng hiển thị:
1. `Bảng biểu`: Bảng có bị tràn lề/tràn trang theo chiều ngang không?
2. `Văn bản`: Chữ có bị mất, đè chữ hoặc lỗi font tiếng Việt không?
3. `Độ rộng cột`: Cột có bị co quá hẹp gây vỡ chữ không?
4. `Định dạng màu sắc`: Màu đỏ `#FF0000` của các phần bổ sung có được bảo toàn nguyên vẹn không?
5. `Hình ảnh/Sơ đồ`: Hình ảnh có hiển thị đúng vị trí và tỷ lệ không?
6. `Tiêu đề & Quốc hiệu`: Tiêu đề bài học, tên tổ bộ môn, quốc hiệu/tiêu ngữ có đầy đủ không?
7. `Đánh số trang`: Số trang và header/footer có hiển thị chính xác không?
8. `Tính toàn vẹn Phụ lục`: PL1, PL2, PL3, PL4 có hiển thị đủ dữ liệu không?
9. `Bố cục giáo án`: Kế hoạch bài dạy có giữ nguyên cấu trúc và bố cục gốc không?

### 17.2. Nguyên tắc gán nhãn nghiệm thu
- **Khi chưa render và kiểm tra trực quan**: Tuyệt đối **KHÔNG ĐƯỢC GHI** *"Đã nghiệm thu"*.
- **Trạng thái xuất bản bắt buộc khi chưa kiểm tra trực quan**:
  > **`“Đã xuất file - chưa kiểm tra trực quan.”`**
- Chỉ khi giáo viên / chuyên gia hoàn tất bước xem trước trực quan (Visual preview) và xác nhận đạt 9 tiêu chí trên mới được cấp nhãn **`“Đã nghiệm thu”`**.

## 18. Quy Chuẩn Xử Lý Thiếu Dữ Liệu & Hệ Thống 8 Trạng Thái Quản Lý

### 18.1. Nguyên tắc ứng xử khi thiếu dữ liệu
- **Tuyệt đối KHÔNG tự ý hoàn thiện, suy đoán hoặc bịa đặt dữ liệu bị thiếu**.
- Bắt buộc lập báo cáo minh bạch gồm 6 mục rõ ràng:
  1. `Dữ liệu đã xác minh`: Các thông tin đã có đối chiếu nguồn chính xác.
  2. `Dữ liệu còn thiếu`: Các trường thông tin chưa có căn cứ từ file tải lên.
  3. `Dữ liệu mâu thuẫn`: Các điểm sai khác giữa các nguồn (nếu có).
  4. `Nội dung có thể thực hiện`: Các hạng mục đủ điều kiện để xử lý ngay.
  5. `Nội dung chưa thể thực hiện`: Các hạng mục phải tạm hoãn do thiếu dữ liệu.
  6. `Tài liệu cần người dùng bổ sung`: Danh mục cụ thể các văn bản/file cần tải lên thêm.

### 18.2. Hệ thống 8 Trạng thái chuẩn (Standard Status Taxonomy)
Hệ thống sử dụng thống nhất 8 nhãn trạng thái vòng đời sau:
1. `Đã xác minh`: Dữ liệu có đầy đủ căn cứ nguồn hợp lệ, khớp chuỗi đối chiếu.
2. `Thiếu nguồn`: Chưa có tài liệu nguồn chính thức cho trường thông tin này.
3. `Mâu thuẫn nguồn`: Dữ liệu giữa các tài liệu đối chiếu không đồng nhất.
4. `Cần chuyên gia xác nhận`: Cần giáo viên / tổ chuyên môn ra quyết định.
5. `Dữ liệu lịch sử`: Dữ liệu thuộc khung cũ (như QĐ 3439), chỉ lưu tham khảo.
6. `Bản nháp`: Đang trong tiến trình xử lý, chưa đạt kiểm định đầy đủ.
7. `Đạt kiểm định`: Đã vượt qua trọn vẹn 23 tiêu chí kiểm tra và sẵn sàng xuất bản.
8. `Bị khóa`: Bị tạm dừng / chặn xuất file do phát hiện vi phạm quy chuẩn kiểm định.

## 19. Schema Chuẩn 26 Trường Dữ Liệu & Chuỗi Liên Kết Bắt Buộc

### 19.1. Cấu trúc 26 trường bắt buộc của mỗi bản ghi (Data Record Schema)
Mỗi bản ghi dữ liệu sư phạm/tích hợp trong cơ sở dữ liệu và bộ nhớ xử lý phải có đủ 26 trường sau:
1. `subject`: Môn học (Toán, Vật lí, Hóa học, Sinh học, Ngữ văn, Lịch sử, Địa lí, Tin học, Công nghệ, Tiếng Anh...)
2. `grade`: Khối lớp (`"10"` | `"11"` | `"12"`)
3. `semester`: Học kỳ (`"1"` | `"2"`)
4. `school_year`: Năm học (VD: `"2026 - 2027"`)
5. `lesson`: Tên bài học
6. `topic`: Tên chủ đề / chương
7. `week`: Tuần học theo PPCT
8. `PPCT_period`: Tiết phân phối chương trình
9. `YCCD_subject`: Yêu cầu cần đạt của môn học nguyên văn
10. `activity`: Tên hoạt động dạy học (Mở đầu / HĐ1 / HĐ2 / Luyện tập / Vận dụng)
11. `learning_task`: Nhiệm vụ học tập cụ thể giao cho học sinh
12. `digital_behavior`: Hành vi số / AI quan sát được của học sinh
13. `NLS_code`: Mã năng lực số (Dạng `[miền].[NLTP].NC[chỉ báo]`)
14. `NLS_indicator`: Trích dẫn nội dung chỉ báo năng lực số
15. `AI_component`: Thành phần năng lực AI (`NLa` | `NLb` | `NLc` | `NLd` theo QĐ 2422)
16. `AI_requirement`: Yêu cầu cần đạt AI theo QĐ 2422
17. `AI_code`: Mã năng lực AI theo QĐ 2422 (Dạng `[Lớp].[Chủ đề].[Số TT]`)
18. `tool`: Công cụ số, ứng dụng hoặc mô hình AI sử dụng
19. `product`: Sản phẩm học tập học sinh tạo ra
20. `evidence`: Minh chứng đánh giá kết quả
21. `verification`: Cách thức kiểm chứng thông tin, độ tin cậy của AI
22. `assessment_tool`: Công cụ đánh giá (Rubric, thang điểm, bảng kiểm...)
23. `assessment_criteria`: Tiêu chí đánh giá cụ thể
24. `source_id`: Mã định danh tài liệu nguồn
25. `source_page`: Số trang / vị trí trong tài liệu nguồn
26. `validation_status`: Trạng thái kiểm định (thuộc 8 trạng thái chuẩn ở Mục 18)

### 19.2. Chuỗi liên kết logic 11 bước (Linkage Chain)
Mỗi bản ghi phải bảo đảm mối liên kết xuyên suốt, không đứt gãy qua 11 bước:
```
YCCĐ môn học
  → Nhiệm vụ
  → Hành vi học sinh
  → Sản phẩm
  → Minh chứng
  → Mã NLS
  → YCCĐ AI
  → Mã AI
  → Công cụ
  → Kiểm chứng
  → Đánh giá
```

## 20. Quy Trình Vận Hành Khóa Cứng 13 Bước (Locked Execution Pipeline)

Mọi tác vụ xử lý tài liệu, xây dựng phụ lục và nâng cấp kế hoạch bài dạy bắt buộc phải tuân thủ tuần tự 13 bước khóa cứng sau:

1. **`Bước 1` - Xác định thông số bài học**: Nhận diện chính xác Môn học, Lớp (10/11/12), Bài/chủ đề (SGK Kết nối tri thức - NXBGD), Học kỳ, Năm học (2026 - 2027) và PPCT.
2. **`Bước 2` - Trích xuất YCCĐ nguyên văn**: Trích xuất nguyên văn Yêu cầu cần đạt của môn học từ Chương trình GDPT 2018 / SGK (không tự ý viết lại).
3. **`Bước 3` - Phân tích động từ & hành vi**: Bóc tách động từ hành động và xác định hành vi học tập quan sát được của học sinh.
4. **`Bước 4` - Xác định bộ ba sư phạm**: Thiết lập chi tiết Nhiệm vụ học tập $\rightarrow$ Sản phẩm học sinh $\rightarrow$ Minh chứng đánh giá.
5. **`Bước 5` - Đối chiếu mã NLS**: Tra cứu và gán mã NLS mức NC (`[miền].[NLTP].NC[chỉ báo]`) theo đúng Bảng mã do người dùng cung cấp.
6. **`Bước 6` - Đối chiếu YCCĐ & mã AI**: Tra cứu YCCĐ AI và mã AI (`[Lớp].[Chủ đề].[Số TT]`) chuẩn xác từ QĐ 2422/QĐ-BGDĐT.
7. **`Bước 7` - Kiểm tra điều kiện CV 5588**: Thẩm định điều kiện triển khai sư phạm và an toàn theo hướng dẫn CV 5588/BGDĐT-GDPT.
8. **`Bước 8` - Tạo Bảng liên kết trung gian**: Xây dựng Bảng đối chiếu trung gian 22 cột (YCCĐ – NLS – NL AI) và gắn nhãn trạng thái xác minh.
9. **`Bước 9` - Đồng bộ dữ liệu**: Cập nhật đồng bộ vào PL1, PL2, PL3, PL4 hoặc Giáo án gốc theo đúng yêu cầu.
10. **`Bước 10` - Bảo toàn nội dung gốc**: Giữ nguyên $100\%$ nội dung, bảng biểu, sơ đồ, công thức và hình ảnh của file gốc.
11. **`Bước 11` - Đánh dấu màu đỏ**: Tô màu đỏ (**`#FF0000`**) toàn bộ các phần nội dung bổ sung (hoặc gắn nhãn nhận diện trên plain text).
12. **`Bước 12` - Kiểm định 23 tiêu chí**: Thẩm định qua Bảng kiểm định 23 tiêu chí xuất file chính thức và thực hiện kiểm tra trực quan.
13. **`Bước 13` - Báo cáo trạng thái minh bạch**: Báo cáo rõ ràng 6 mục (dữ liệu đã xác minh, còn thiếu, mâu thuẫn, có thể làm, chưa thể làm, cần bổ sung) theo 8 trạng thái chuẩn.

## 21. Schema Quản Lý & Lưu Vết Tài Liệu Nạp Vào (Document Ingestion Schema)

Mọi tài liệu người dùng tải lên hệ thống được định danh và quản lý qua 13 trường metadata chuẩn:
```json
{
  "id": "DOC-2026-XXXXX",
  "file_name": "Tên file đầy đủ kèm đuôi mở rộng",
  "file_type": "docx | pdf | xlsx | txt | json",
  "source_type": "1 trong 12 nhóm tài liệu phân loại tại Mục 6",
  "document_number": "Số hiệu văn bản chính thức (nếu có)",
  "issue_date": "YYYY-MM-DD",
  "status": "HIỆN_HÀNH | LỊCH_SỬ | CHỜ_XÁC_MINH",
  "subject": "Môn học THPT",
  "grade": "10 | 11 | 12",
  "page_count": 0,
  "version": "1.0",
  "uploaded_by": "Tên giáo viên / Người dùng",
  "created_at": "YYYY-MM-DDTHH:mm:ss+07:00"
}
```

## 22. Schema Cơ Sở Dữ Liệu Chỉ Báo Năng Lực Số (NLS Indicator Schema)

Mỗi chỉ báo Năng lực số (NLS) trong Bảng mã nguồn được lưu trữ và tra cứu theo cấu trúc 9 trường chuẩn:
```json
{
  "id": "NLS-NC-001",
  "code": "1.1.NCa",
  "domain": "Miền 1: Khai thác dữ liệu và thông tin",
  "competency": "1.1: Tìm kiếm và lọc dữ liệu, thông tin và nội dung số",
  "level": "NC",
  "indicator_text": "Sử dụng các chiến lược tìm kiếm nâng cao, kết hợp nhiều từ khóa và toán tử logic để truy xuất dữ liệu chuyên sâu phục vụ học tập và nghiên cứu.",
  "source_document_id": "DOC-2025-TT02",
  "source_page": 12,
  "is_active": true
}
```

## 23. Danh Mục Mã Chỉ Báo NLS Đã Xác Minh & Kích Hoạt (Verified Active NLS Codes)

Hệ thống đã nạp và xác nhận 4 mã chỉ báo NLS hợp lệ cho cấp THPT:
1. **`1.1.NCa`**:
   - *Miền*: Miền 1 - Khai thác dữ liệu và thông tin
   - *Năng lực TP*: 1.1 - Tìm kiếm và lọc dữ liệu, thông tin và nội dung số
   - *Mức*: `NC` (Nâng cao) | *Trạng thái*: `Đã xác minh / Active`
2. **`1.1.NCb`**:
   - *Miền*: Miền 1 - Khai thác dữ liệu và thông tin
   - *Năng lực TP*: 1.1 - Tìm kiếm và lọc dữ liệu, thông tin và nội dung số
   - *Mức*: `NC` (Nâng cao) | *Trạng thái*: `Đã xác minh / Active`
3. **`1.2.NCa`**:
   - *Miền*: Miền 1 - Khai thác dữ liệu và thông tin
   - *Năng lực TP*: 1.2 - Đánh giá dữ liệu, thông tin và nội dung số
   - *Mức*: `NC` (Nâng cao) | *Trạng thái*: `Đã xác minh / Active`
4. **`6.2.NCa`**:
   - *Miền*: Miền 6 - Ứng dụng trí tuệ nhân tạo
   - *Năng lực TP*: 6.2 - Sử dụng và tương tác với hệ thống AI
   - *Mức*: `NC` (Nâng cao) | *Trạng thái*: `Đã xác minh / Active`

## 24. Schema Cơ Sở Dữ Liệu YCCĐ & Mã Năng Lực AI (AI Competency Schema - QĐ 2422)

Mỗi Yêu cầu cần đạt và Mã chỉ báo Năng lực AI theo QĐ 2422 được lưu trữ theo cấu trúc 12 trường chuẩn:
```json
{
  "id": "AI-2422-10A1-01",
  "code": "10.A1.1",
  "grade": "10",
  "component": "NLa: Tư duy lấy con người làm trung tâm",
  "topic": "A1: Con người trong hệ thống AI",
  "requirement_type": "CỐT_LÕI",
  "requirement_text": "Nhận biết và giải thích được vai trò chủ đạo của con người trong việc thiết kế, huấn luyện, kiểm soát và ra quyết định cuối cùng khi sử dụng các hệ thống AI.",
  "source_document_id": "DOC-2026-QD2422",
  "source_page": 18,
  "is_core": true,
  "is_extension": false,
  "is_active": true
}
```

## 25. Schema Cơ Sở Dữ Liệu YCCĐ Môn Học (Subject Curriculum YCCĐ Schema)

Mỗi Yêu cầu cần đạt môn học theo Chương trình GDPT 2018 & SGK Kết nối tri thức được lưu trữ theo cấu trúc 11 trường chuẩn:
```json
{
  "id": "YCCD-TOAN-10-001",
  "subject": "Toán học",
  "grade": "10",
  "lesson": "Mệnh đề toán học",
  "topic": "Chương I: Mệnh đề và tập hợp",
  "yccd_text": "Thiết lập và phát biểu được mệnh đề phủ định, mệnh đề kéo theo, mệnh đề tương đương, mệnh đề đảo; sử dụng đúng các kí hiệu với mọi, tồn tại; xác định được tính đúng sai của một mệnh đề trong các tình huống toán học đơn giản.",
  "source_document_id": "DOC-2018-CTTOAN",
  "source_page": 24,
  "semester": "1",
  "school_year": "2026 - 2027",
  "is_verified": true
}
```

## 26. Schema Cơ Sở Dữ Liệu Phân Phối Chương Trình (PPCT / Curriculum Distribution Schema)

Mỗi đơn vị bài học trong Phân phối chương trình của nhà trường / tổ chuyên môn được lưu trữ theo cấu trúc 12 trường chuẩn:
```json
{
  "id": "PPCT-TOAN-10-001",
  "subject": "Toán học",
  "grade": "10",
  "lesson": "Bài 1: Mệnh đề",
  "topic": "Chương I: Mệnh đề và tập hợp",
  "week": 1,
  "ppct_period": "Tiết 1 - 2",
  "number_of_periods": 2,
  "equipment": "Máy chiếu, bảng phụ, phiếu học tập",
  "learning_material": "SGK Toán 10 Kết nối tri thức, phần mềm GeoGebra",
  "location": "Phòng học lớp 10A1",
  "source_document_id": "DOC-2026-PPCT-TOAN10"
}
```

## 27. Schema Bản Ghi Đối Chiếu Trung Gian & Tích Hợp (Intermediate Mapping Record Schema)

Mỗi dòng đối chiếu trong Bảng đối chiếu trung gian để liên kết YCCĐ môn học với NLS và NL AI được lưu trữ theo cấu trúc 20 trường chuẩn:
```json
{
  "id": "MAP-2026-00001",
  "subject": "Địa lí",
  "grade": "10",
  "lesson": "Bài 19: Quy mô dân số, cơ cấu dân số",
  "topic": "Chương 7: Địa lí dân cư",
  "yccd_id": "YCCD-DIA-10-019",
  "activity_id": "ACT-DIA10-019-HD2",
  "task": "Sử dụng công cụ số để tra cứu tháp dân số thế giới và viết câu lệnh prompt yêu cầu AI so sánh cơ cấu tuổi của 2 quốc gia phát triển và đang phát triển.",
  "student_behavior": "Học sinh nhập prompt so sánh cơ cấu tuổi, đối chiếu số liệu do AI tạo ra với Bảng 19.1 trong SGK để phát hiện độ lệch, sau đó vẽ tháp dân số tóm tắt.",
  "product": "Bảng đối chiếu số liệu dân số kèm nhận xét kiểm chứng câu trả lời của AI và file biểu đồ tháp tuổi.",
  "evidence": "Bản báo cáo chỉ rõ điểm chính xác và điểm sai lệch của AI dựa trên SGK Địa lí 10.",
  "nls_code": "1.2.NCa",
  "ai_component": "NLc",
  "ai_yccd_code": "10.C3.2",
  "ai_code": "10.C3.2",
  "tool": "Mô hình ngôn ngữ lớn (LLM) / Bảng tính số",
  "verification": "Đối chiếu trực tiếp với Bảng số liệu dân số trong SGK Kết nối tri thức và Cổng thông tin Tổng cục Thống kê / World Bank.",
  "assessment_criteria": "Mức độ chính xác của câu lệnh prompt, phát hiện đúng sai lệch của AI và tính chuẩn xác của tháp dân số hoàn thiện.",
  "offline_alternative": "Sử dụng Bảng số liệu in sẵn trong SGK và tài liệu phát tay, học sinh làm việc theo cặp để phân tích thủ công.",
  "status": "Đã xác minh"
}
```

## 28. Bộ Kiểm Tra & Thẩm Định Mã Tích Hợp (Code Validation Modules)

### 28.1. Bộ kiểm tra mã NLS (NLS Code Validator)
Mã NLS chỉ được xem là hợp lệ khi thỏa mãn trọn vẹn 7 điều kiện:
1. `Tồn tại` trong bảng `nls_indicators` do người dùng cung cấp.
2. `Mức chuẩn`: Thuộc mức `NC` (Nâng cao cho THPT).
3. `Khối lớp`: Phù hợp với lớp 10, 11 hoặc 12.
4. `Nhiệm vụ số`: Có nhiệm vụ học tập số rõ ràng giao cho học sinh.
5. `Sản phẩm`: Có sản phẩm số hoàn thành cụ thể.
6. `Minh chứng`: Có minh chứng định lượng/định tính để đánh giá.
7. `Tiêu chí`: Có tiêu chí đánh giá (Rubric) cụ thể.

**NGHIÊM CẤM GÁN MÃ NLS CHỈ VÌ**:
- Dùng máy tính, điện thoại, máy tính bảng;
- Dùng Internet / Wi-Fi;
- Dùng màn hình / máy chiếu;
- Dùng phần mềm trình chiếu đơn thuần;
- Giáo viên sử dụng AI để chuẩn bị bài học.

### 28.2. Bộ kiểm tra mã AI (AI Code Validator - QĐ 2422)
Mã AI chỉ được xem là hợp lệ khi thỏa mãn trọn vẹn 7 điều kiện:
1. `Tồn tại` trong bảng `ai_requirements` của QĐ 2422.
2. `Đúng lớp`: Lớp 10, 11 hoặc 12.
3. `Đúng chủ đề`: Khớp với chủ đề năng lực AI trong QĐ 2422.
4. `Đúng thành phần`: `NLa`, `NLb`, `NLc` hoặc `NLd`.
5. `Nhiệm vụ AI thực tế`: Học sinh trực tiếp thao tác/tương tác AI.
6. `Sản phẩm`: Có sản phẩm học tập cụ thể.
7. `Kiểm chứng`: Có quy trình kiểm chứng tính đúng đắn/độ tin cậy của AI.

**DANH MỤC MÃ BẮT BUỘC TỪ CHỐI (Mã cũ / Thí điểm)**:
- ❌ `10.A2.01`
- ❌ `10.B3.01`
- ❌ `10.C2.01`
- ❌ `10.C3.01`
- ❌ `12.C1.01`

### 28.3. Xử lý tài liệu chứa mã QĐ 3439 cũ
Nếu tài liệu nạp vào còn chứa mã hoặc căn cứ QĐ 3439:
1. **Đánh dấu mã cũ**: Gắn nhãn `[LEGACY - QĐ 3439 - CHỈ LƯU LỊCH SỬ]`.
2. **Đề xuất kiểm tra**: Yêu cầu đối chiếu lại theo danh mục QĐ 2422.
3. **Không tự động chuyển đổi**: Tuyệt đối không tự ý gán mã mới bằng phỏng đoán.
4. **Khóa xuất file**: Khóa hoàn toàn chức năng xuất file chính thức cho đến khi dữ liệu được làm sạch.

## 29. Kiến Trúc Module, Quản Lý Học Liệu, Hệ Thống API & Giao Diện Người Dùng

### 29.1. Quản lý hình ảnh và học liệu số
Mỗi hình ảnh, bản đồ, sơ đồ và bảng biểu trong tài liệu phải có đủ metadata:
`{ tên, nguồn, trang, bài, hoạt động, mục đích sử dụng }`
- **TUYỆT ĐỐI CẤM**:
  - Không dùng hình AI sinh ra để thay thế hình ảnh/sơ đồ chuẩn SGK Kết nối tri thức.
  - Không tự vẽ lại bản đồ địa lí / lược đồ lịch sử.
  - Không dùng hình ảnh không rõ nguồn gốc hoặc gắn sai hoạt động.
  - Không cắt xén làm mất dữ liệu / chú giải gốc.

### 29.2. Phương án dự phòng ngoại tuyến (Không Internet / Không thiết bị số)
Mọi nhiệm vụ học tập có sử dụng công cụ số bắt buộc phải có ít nhất 1 phương án thay thế:
1. Sử dụng thiết bị dùng chung tại lớp.
2. Giáo viên trình chiếu tập trung.
3. Phiếu học tập in sẵn.
4. Dữ liệu / tài liệu đã tải về trước (offline).
5. Hoạt động mô phỏng / thực hành thủ công.
6. Hoạt động nhóm không cần kết nối Internet.
*(Tuyệt đối không bắt buộc học sinh phải dùng tài khoản cá nhân, công cụ trả phí hay thiết bị riêng).*

### 29.3. Danh mục API RESTful hệ thống
- **Quản lý Nguồn**: `POST /api/sources/upload`, `GET /api/sources`, `POST /api/sources/index`, `GET /api/sources/:id`
- **Khung NLS & AI**: `GET /api/nls/indicators`, `GET /api/ai/requirements`, `POST /api/legacy/scan`, `POST /api/legacy/migrate`
- **Bóc tách & Đối chiếu**: `POST /api/yccd/extract`, `POST /api/alignment/generate`, `POST /api/alignment/validate`
- **Sinh Phụ lục**: `POST /api/appendix/pl1/generate`, `POST /api/appendix/pl2/generate`, `POST /api/appendix/pl3/generate`, `POST /api/appendix/pl4/generate`
- **Nâng cấp & Kiểm định**: `POST /api/lesson-plan/upgrade`, `POST /api/validation/run`, `POST /api/export/word`, `POST /api/export/excel`, `POST /api/export/pdf`
- **Lưu vết & Trạng thái**: `GET /api/audit/logs`, `GET /api/export/status/:id`

### 29.4. Kiến trúc 13 Khu vực Giao diện Người dùng (UI Dashboard)
Giao diện bao gồm 13 khu vực chức năng tương tác đầy đủ (không để trạng thái rỗng hoặc chỉ có tiêu đề):
1. `Nguồn tài liệu`
2. `Bảng mã NLS`
3. `Bảng mã AI`
4. `Rà soát YCCĐ`
5. `Bảng đối chiếu YCCĐ – NLS – NL AI`
6. `Tạo PL1`
7. `Tạo PL2`
8. `Tạo PL3`
9. `Tạo PL4`
10. `Nâng cấp giáo án`
11. `Kiểm định chất lượng`
12. `Nhật ký chỉnh sửa (Audit Logs)`
13. `Xuất file (Word / Excel / PDF)`

**Mỗi khu vực chức năng bắt buộc có đủ 6 thành phần điều khiển**:
1. Nút thực hiện (Action trigger)
2. Trạng thái xử lý (Processing spinner / state badge)
3. Thông báo lỗi rõ ràng (Detailed error alert)
4. Kết quả xem trước trực quan (Visual preview)
5. Nút chỉnh sửa trực tiếp (Inline editor)
6. Nút xuất file (Export button)

























