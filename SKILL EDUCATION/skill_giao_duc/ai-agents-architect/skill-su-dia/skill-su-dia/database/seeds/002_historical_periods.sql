-- ============================================
-- Seed: Các thời kỳ lịch sử Việt Nam
-- ============================================

INSERT INTO historical_periods (name_vi, name_en, slug, start_year, end_year, description_vi, color, sort_order) VALUES

-- Thời kỳ cổ đại
('Thời kỳ Hồng Bàng', 'Hong Bang Period', 'hong-bang', -2879, -258,
 'Thời kỳ truyền thuyết của các vua Hùng, từ Kinh Dương Vương đến Hùng Vương thứ 18. Gắn liền với truyền thuyết Con Rồng Cháu Tiên, bánh chưng bánh dày.',
 '#8B4513', 1),

('Thời kỳ An Dương Vương', 'An Duong Vuong Period', 'an-duong-vuong', -257, -207,
 'Thục Phán lập nước Âu Lạc, xây thành Cổ Loa. Gắn liền với truyền thuyết nỏ thần.',
 '#CD853F', 2),

('Thời kỳ Bắc thuộc lần 1', 'First Chinese Domination', 'bac-thuoc-1', -207, 40,
 'Từ nhà Triệu đến nhà Hán. Giai đoạn đầu tiên Việt Nam bị phương Bắc đô hộ.',
 '#696969', 3),

('Khởi nghĩa Hai Bà Trưng', 'Trung Sisters Uprising', 'hai-ba-trung', 40, 43,
 'Hai Bà Trưng khởi nghĩa chống nhà Hán, giành được độc lập ngắn ngủi.',
 '#DC143C', 4),

-- Thời kỳ phong kiến
('Nhà Lý', 'Ly Dynasty', 'nha-ly', 1009, 1225,
 'Triều đại mở đầu thời kỳ phong kiến độc lập tự chủ. Dời đô về Thăng Long (1010). Phát triển Phật giáo.',
 '#FFD700', 10),

('Nhà Trần', 'Tran Dynasty', 'nha-tran', 1225, 1400,
 'Ba lần đánh thắng quân Nguyên Mông. Trần Hưng Đạo, Hịch tướng sĩ. Phát triển văn hóa, chữ Nôm.',
 '#FF8C00', 11),

('Nhà Hậu Lê', 'Later Le Dynasty', 'nha-hau-le', 1428, 1789,
 'Lê Lợi đánh đuổi giặc Minh. Nguyễn Trãi viết Bình Ngô đại cáo. Luật Hồng Đức.',
 '#4169E1', 12),

('Nhà Nguyễn', 'Nguyen Dynasty', 'nha-nguyen', 1802, 1945,
 'Triều đại phong kiến cuối cùng. Gia Long thống nhất đất nước. Kinh đô Huế.',
 '#800080', 13),

-- Thời kỳ hiện đại
('Kháng chiến chống Pháp', 'Resistance Against France', 'khang-chien-chong-phap', 1945, 1954,
 'Cách mạng tháng Tám 1945. Tuyên ngôn độc lập 2/9/1945. Chiến thắng Điện Biên Phủ 1954.',
 '#FF0000', 20),

('Kháng chiến chống Mỹ', 'Resistance Against America', 'khang-chien-chong-my', 1954, 1975,
 'Từ Hiệp định Geneva đến Đại thắng mùa Xuân 1975. Thống nhất đất nước.',
 '#B22222', 21),

('Thời kỳ Đổi Mới', 'Doi Moi Period', 'doi-moi', 1986, NULL,
 'Chính sách đổi mới kinh tế từ Đại hội Đảng VI. Mở cửa và hội nhập quốc tế.',
 '#228B22', 22)

ON CONFLICT (slug) DO NOTHING;
