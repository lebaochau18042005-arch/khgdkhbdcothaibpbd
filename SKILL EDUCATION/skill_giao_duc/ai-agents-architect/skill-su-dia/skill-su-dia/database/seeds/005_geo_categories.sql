-- ============================================
-- Seed: Các danh mục địa lý Việt Nam
-- ============================================

INSERT INTO geo_categories (name_vi, name_en, slug, type, description_vi, sort_order) VALUES

-- Châu lục
('Châu Á', 'Asia', 'chau-a', 'continent', 'Châu lục lớn nhất thế giới, nơi Việt Nam tọa lạc.', 1),
('Châu Âu', 'Europe', 'chau-au', 'continent', 'Châu lục phát triển cao ở phía tây Á-Âu.', 2),
('Châu Phi', 'Africa', 'chau-phi', 'continent', 'Châu lục lớn thứ hai thế giới.', 3),
('Châu Mỹ', 'Americas', 'chau-my', 'continent', 'Bao gồm Bắc Mỹ, Trung Mỹ và Nam Mỹ.', 4),
('Châu Đại Dương', 'Oceania', 'chau-dai-duong', 'continent', 'Châu lục nhỏ nhất, gồm Úc và các đảo Thái Bình Dương.', 5),

-- Khu vực Đông Nam Á
('Đông Nam Á', 'Southeast Asia', 'dong-nam-a', 'region', 'Khu vực gồm 11 quốc gia thành viên ASEAN và Đông Timor.', 10),

-- Quốc gia ĐNA
('Việt Nam', 'Vietnam', 'viet-nam', 'country', 'Quốc gia hình chữ S bên bờ Biển Đông.', 20),
('Lào', 'Laos', 'lao', 'country', 'Quốc gia nội địa duy nhất ở Đông Nam Á.', 21),
('Campuchia', 'Cambodia', 'campuchia', 'country', 'Quốc gia có đền Angkor Wat nổi tiếng.', 22),
('Thái Lan', 'Thailand', 'thai-lan', 'country', 'Quốc gia duy nhất ở ĐNA không bị thực dân hóa.', 23),
('Myanmar', 'Myanmar', 'myanmar', 'country', 'Quốc gia lớn nhất Đông Nam Á lục địa.', 24),
('Malaysia', 'Malaysia', 'malaysia', 'country', 'Quốc gia liên bang ở Đông Nam Á.', 25),
('Singapore', 'Singapore', 'singapore', 'country', 'Quốc đảo thành phố phát triển nhất ĐNA.', 26),
('Indonesia', 'Indonesia', 'indonesia', 'country', 'Quần đảo lớn nhất thế giới.', 27),
('Philippines', 'Philippines', 'philippines', 'country', 'Quần đảo với hơn 7000 đảo.', 28),
('Brunei', 'Brunei', 'brunei', 'country', 'Quốc gia nhỏ giàu dầu mỏ trên đảo Borneo.', 29),
('Đông Timor', 'Timor-Leste', 'dong-timor', 'country', 'Quốc gia trẻ nhất Đông Nam Á.', 30),

-- Vùng miền Việt Nam
('Miền Bắc', 'Northern Vietnam', 'mien-bac', 'region', 'Vùng từ đèo Ngang trở ra. Thủ đô Hà Nội.', 40),
('Miền Trung', 'Central Vietnam', 'mien-trung', 'region', 'Vùng duyên hải miền Trung và Tây Nguyên.', 41),
('Miền Nam', 'Southern Vietnam', 'mien-nam', 'region', 'Vùng Đông Nam Bộ và Tây Nam Bộ. TP.HCM.', 42),

-- Loại địa hình
('Sông ngòi Việt Nam', 'Rivers of Vietnam', 'song-ngoi-vn', 'river', 'Hệ thống sông ngòi dày đặc của Việt Nam.', 50),
('Núi Việt Nam', 'Mountains of Vietnam', 'nui-vn', 'mountain', 'Các dãy núi và đỉnh núi tiêu biểu.', 51),
('Biển đảo Việt Nam', 'Seas and Islands of Vietnam', 'bien-dao-vn', 'sea', 'Biển Đông và hệ thống đảo.', 52),
('Hồ Việt Nam', 'Lakes of Vietnam', 'ho-vn', 'lake', 'Các hồ nước ngọt tiêu biểu.', 53)

ON CONFLICT (slug) DO NOTHING;
