-- ============================================
-- Seed: Các nhân vật lịch sử tiêu biểu Việt Nam
-- ============================================

INSERT INTO historical_figures (
    name_vi, name_en, slug,
    birth_year, death_year, nationality,
    biography_vi, tags, achievements
) VALUES

('Hùng Vương', 'Hung King', 'hung-vuong',
 NULL, NULL, 'Văn Lang',
 'Các vua Hùng là những người lập nên và cai trị nước Văn Lang - nhà nước đầu tiên trong lịch sử Việt Nam.',
 ARRAY['truyền thuyết', 'dựng nước'],
 '[{"vi": "Lập nước Văn Lang", "en": "Founded Van Lang state"}]'),

('Trưng Trắc', 'Trung Trac', 'trung-trac',
 14, 43, 'Âu Lạc',
 'Trưng Trắc cùng em gái Trưng Nhị lãnh đạo cuộc khởi nghĩa chống nhà Đông Hán năm 40, giành lại 65 thành trì.',
 ARRAY['nữ anh hùng', 'khởi nghĩa'],
 '[{"vi": "Lãnh đạo khởi nghĩa chống Hán", "en": "Led uprising against Han dynasty"}, {"vi": "Xưng vương, đóng đô tại Mê Linh", "en": "Proclaimed queen, capital at Me Linh"}]'),

('Lý Thái Tổ', 'Ly Thai To', 'ly-thai-to',
 974, 1028, 'Đại Cồ Việt',
 'Lý Công Uẩn, sáng lập nhà Lý, dời đô từ Hoa Lư ra Đại La (Thăng Long), mở đầu thời kỳ phát triển rực rỡ.',
 ARRAY['nhà lý', 'dời đô'],
 '[{"vi": "Sáng lập nhà Lý", "en": "Founded Ly dynasty"}, {"vi": "Dời đô ra Thăng Long (1010)", "en": "Moved capital to Thang Long (1010)"}]'),

('Trần Hưng Đạo', 'Tran Hung Dao', 'tran-hung-dao',
 1228, 1300, 'Đại Việt',
 'Hưng Đạo Vương Trần Quốc Tuấn, nhà quân sự thiên tài, ba lần đánh thắng quân Nguyên Mông xâm lược.',
 ARRAY['nhà trần', 'nguyên mông', 'quân sự'],
 '[{"vi": "3 lần đánh thắng quân Nguyên Mông", "en": "Defeated Mongol Yuan 3 times"}, {"vi": "Viết Hịch tướng sĩ", "en": "Wrote Proclamation to Officers"}]'),

('Lê Lợi', 'Le Loi', 'le-loi',
 1385, 1433, 'Đại Việt',
 'Lê Lợi (Lê Thái Tổ), lãnh đạo khởi nghĩa Lam Sơn (1418-1427), đánh đuổi quân Minh, sáng lập nhà Hậu Lê.',
 ARRAY['nhà lê', 'lam sơn', 'chống minh'],
 '[{"vi": "Lãnh đạo khởi nghĩa Lam Sơn", "en": "Led Lam Son uprising"}, {"vi": "Sáng lập nhà Hậu Lê", "en": "Founded Later Le dynasty"}]'),

('Nguyễn Trãi', 'Nguyen Trai', 'nguyen-trai',
 1380, 1442, 'Đại Việt',
 'Nguyễn Trãi, anh hùng dân tộc, nhà chính trị, nhà quân sự, nhà thơ lớn. Tác giả Bình Ngô đại cáo.',
 ARRAY['nhà lê', 'văn học', 'chính trị'],
 '[{"vi": "Viết Bình Ngô đại cáo", "en": "Wrote Binh Ngo Dai Cao"}, {"vi": "Danh nhân văn hóa thế giới UNESCO", "en": "UNESCO World Cultural Celebrity"}]'),

('Quang Trung - Nguyễn Huệ', 'Quang Trung - Nguyen Hue', 'quang-trung',
 1753, 1792, 'Đại Việt',
 'Nguyễn Huệ (Quang Trung), lãnh đạo phong trào Tây Sơn, đại phá quân Thanh trong trận Ngọc Hồi - Đống Đa Tết Kỷ Dậu 1789.',
 ARRAY['tây sơn', 'chống thanh', 'quân sự'],
 '[{"vi": "Đại phá quân Thanh 1789", "en": "Defeated Qing army 1789"}, {"vi": "Lãnh đạo phong trào Tây Sơn", "en": "Led Tay Son movement"}]'),

('Hồ Chí Minh', 'Ho Chi Minh', 'ho-chi-minh',
 1890, 1969, 'Việt Nam',
 'Chủ tịch Hồ Chí Minh, anh hùng giải phóng dân tộc, danh nhân văn hóa thế giới. Lãnh đạo cách mạng tháng Tám, khai sinh nước Việt Nam Dân chủ Cộng hòa.',
 ARRAY['cách mạng', 'độc lập', 'danh nhân'],
 '[{"vi": "Sáng lập Đảng Cộng sản Việt Nam", "en": "Founded Communist Party of Vietnam"}, {"vi": "Đọc Tuyên ngôn Độc lập 2/9/1945", "en": "Read Declaration of Independence 2/9/1945"}, {"vi": "Danh nhân văn hóa thế giới UNESCO", "en": "UNESCO World Cultural Celebrity"}]'),

('Võ Nguyên Giáp', 'Vo Nguyen Giap', 'vo-nguyen-giap',
 1911, 2013, 'Việt Nam',
 'Đại tướng Võ Nguyên Giáp, Tổng Tư lệnh Quân đội Nhân dân Việt Nam. Chỉ huy chiến thắng Điện Biên Phủ 1954.',
 ARRAY['quân sự', 'điện biên phủ', 'đại tướng'],
 '[{"vi": "Chỉ huy chiến thắng Điện Biên Phủ", "en": "Commanded victory at Dien Bien Phu"}, {"vi": "Tổng Tư lệnh QĐNDVN", "en": "Commander-in-Chief of Vietnam People''s Army"}]')

ON CONFLICT (slug) DO NOTHING;
