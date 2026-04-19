-- ============================================
-- Seed: Các sự kiện lịch sử tiêu biểu Việt Nam
-- ============================================

-- Lấy period IDs
WITH periods AS (
    SELECT id, slug FROM historical_periods
)
INSERT INTO historical_events (
    period_id, title_vi, title_en, slug,
    start_date, end_date, date_precision,
    summary_vi, location_name, location_lat, location_lng,
    importance, timeline_type, tags
) VALUES

-- Sự kiện cổ đại
((SELECT id FROM periods WHERE slug = 'hong-bang'),
 'Vua Hùng dựng nước Văn Lang', 'King Hung founded Van Lang',
 'vua-hung-dung-nuoc',
 '0001-01-01', NULL, 'year',
 'Theo truyền thuyết, Hùng Vương lập nước Văn Lang, đóng đô tại Phong Châu (Phú Thọ ngày nay). Đây là nhà nước đầu tiên trong lịch sử Việt Nam.',
 'Phú Thọ, Việt Nam', 21.4225, 105.2240,
 10, 'point', ARRAY['truyền thuyết', 'dựng nước', 'văn lang']),

((SELECT id FROM periods WHERE slug = 'hai-ba-trung'),
 'Khởi nghĩa Hai Bà Trưng', 'Trung Sisters Uprising',
 'khoi-nghia-hai-ba-trung',
 '0040-03-01', '0043-05-01', 'year',
 'Trưng Trắc và Trưng Nhị khởi nghĩa chống nhà Đông Hán, giành lại 65 thành trì, xưng vương.',
 'Mê Linh, Hà Nội', 21.1833, 105.7167,
 9, 'range', ARRAY['khởi nghĩa', 'nữ anh hùng', 'chống bắc thuộc']),

-- Nhà Lý
((SELECT id FROM periods WHERE slug = 'nha-ly'),
 'Lý Công Uẩn dời đô ra Thăng Long', 'Ly Cong Uan moved capital to Thang Long',
 'doi-do-thang-long',
 '1010-07-01', NULL, 'year',
 'Lý Thái Tổ ban Chiếu dời đô từ Hoa Lư (Ninh Bình) ra Đại La, đổi tên thành Thăng Long. Mở đầu thời kỳ văn minh Thăng Long.',
 'Hà Nội, Việt Nam', 21.0285, 105.8542,
 10, 'point', ARRAY['dời đô', 'thăng long', 'nhà lý']),

-- Nhà Trần
((SELECT id FROM periods WHERE slug = 'nha-tran'),
 'Chiến thắng Bạch Đằng lần 3', 'Third Battle of Bach Dang',
 'chien-thang-bach-dang-1288',
 '1288-04-09', NULL, 'day',
 'Trần Hưng Đạo chỉ huy trận Bạch Đằng lần 3, đại phá quân Nguyên Mông, kết thúc cuộc kháng chiến chống Nguyên Mông lần 3.',
 'Sông Bạch Đằng, Quảng Ninh', 20.9333, 106.6833,
 10, 'point', ARRAY['bạch đằng', 'trần hưng đạo', 'nguyên mông']),

-- Nhà Hậu Lê
((SELECT id FROM periods WHERE slug = 'nha-hau-le'),
 'Lê Lợi khởi nghĩa Lam Sơn', 'Le Loi Lam Son Uprising',
 'khoi-nghia-lam-son',
 '1418-02-01', '1427-12-01', 'year',
 'Lê Lợi phất cờ khởi nghĩa tại Lam Sơn (Thanh Hóa), trải qua 10 năm kháng chiến, đánh đuổi quân Minh, lập nhà Hậu Lê.',
 'Lam Sơn, Thanh Hóa', 19.9347, 105.2376,
 10, 'range', ARRAY['lê lợi', 'lam sơn', 'chống minh']),

((SELECT id FROM periods WHERE slug = 'nha-hau-le'),
 'Nguyễn Trãi viết Bình Ngô đại cáo', 'Nguyen Trai wrote Binh Ngo Dai Cao',
 'binh-ngo-dai-cao',
 '1428-01-01', NULL, 'year',
 'Nguyễn Trãi soạn Bình Ngô đại cáo - bản tuyên ngôn độc lập lần thứ hai của dân tộc, tổng kết cuộc kháng chiến chống Minh.',
 'Thăng Long, Hà Nội', 21.0285, 105.8542,
 9, 'point', ARRAY['nguyễn trãi', 'tuyên ngôn', 'độc lập']),

-- Thời kỳ hiện đại
((SELECT id FROM periods WHERE slug = 'khang-chien-chong-phap'),
 'Cách mạng tháng Tám', 'August Revolution',
 'cach-mang-thang-tam',
 '1945-08-19', '1945-08-28', 'day',
 'Tổng khởi nghĩa giành chính quyền trên toàn quốc. Ngày 19/8 khởi nghĩa ở Hà Nội.',
 'Hà Nội, Việt Nam', 21.0285, 105.8542,
 10, 'range', ARRAY['cách mạng', 'tổng khởi nghĩa', 'giành chính quyền']),

((SELECT id FROM periods WHERE slug = 'khang-chien-chong-phap'),
 'Tuyên ngôn Độc lập 2/9/1945', 'Declaration of Independence',
 'tuyen-ngon-doc-lap-1945',
 '1945-09-02', NULL, 'day',
 'Chủ tịch Hồ Chí Minh đọc Tuyên ngôn Độc lập tại Quảng trường Ba Đình, khai sinh nước Việt Nam Dân chủ Cộng hòa.',
 'Quảng trường Ba Đình, Hà Nội', 21.0368, 105.8340,
 10, 'point', ARRAY['hồ chí minh', 'tuyên ngôn', 'quốc khánh']),

((SELECT id FROM periods WHERE slug = 'khang-chien-chong-phap'),
 'Chiến thắng Điện Biên Phủ', 'Battle of Dien Bien Phu',
 'chien-thang-dien-bien-phu',
 '1954-03-13', '1954-05-07', 'day',
 'Trận Điện Biên Phủ - "lừng lẫy năm châu, chấn động địa cầu". Kết thúc 9 năm kháng chiến chống Pháp.',
 'Điện Biên Phủ, Điện Biên', 21.3833, 103.0167,
 10, 'range', ARRAY['điện biên phủ', 'chống pháp', 'võ nguyên giáp']),

((SELECT id FROM periods WHERE slug = 'khang-chien-chong-my'),
 'Đại thắng mùa Xuân 1975', 'Spring Victory 1975',
 'dai-thang-mua-xuan-1975',
 '1975-03-04', '1975-04-30', 'day',
 'Chiến dịch Hồ Chí Minh. Ngày 30/4/1975, xe tăng tiến vào Dinh Độc Lập, thống nhất đất nước.',
 'Dinh Độc Lập, TP.HCM', 10.7769, 106.6953,
 10, 'range', ARRAY['thống nhất', '30 tháng 4', 'giải phóng'])

ON CONFLICT (slug) DO NOTHING;
