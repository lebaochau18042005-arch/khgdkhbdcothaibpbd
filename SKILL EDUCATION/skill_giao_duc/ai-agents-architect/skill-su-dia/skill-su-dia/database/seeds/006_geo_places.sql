-- ============================================
-- Seed: Các địa điểm địa lý tiêu biểu
-- ============================================

WITH cats AS (SELECT id, slug FROM geo_categories)

INSERT INTO geo_places (
    category_id, name_vi, name_en, slug, type,
    latitude, longitude,
    area_km2, population, capital,
    description_vi, importance, tags
) VALUES

-- Việt Nam
((SELECT id FROM cats WHERE slug = 'dong-nam-a'),
 'Việt Nam', 'Vietnam', 'viet-nam-place', 'country',
 16.4637, 107.5909,
 331212, 100000000, 'Hà Nội',
 'Nước Cộng hòa Xã hội Chủ nghĩa Việt Nam, nằm ở phía đông bán đảo Đông Dương, hình chữ S.',
 10, ARRAY['đông nam á', 'asean']),

-- Thành phố lớn
((SELECT id FROM cats WHERE slug = 'mien-bac'),
 'Hà Nội', 'Hanoi', 'ha-noi', 'city',
 21.0285, 105.8542,
 3358.6, 8500000, NULL,
 'Thủ đô nước Việt Nam. Thăng Long - Hà Nội với hơn 1000 năm lịch sử.',
 10, ARRAY['thủ đô', 'thăng long', 'miền bắc']),

((SELECT id FROM cats WHERE slug = 'mien-nam'),
 'Thành phố Hồ Chí Minh', 'Ho Chi Minh City', 'tp-hcm', 'city',
 10.8231, 106.6297,
 2061, 9500000, NULL,
 'Thành phố lớn nhất Việt Nam, trung tâm kinh tế lớn nhất cả nước.',
 10, ARRAY['kinh tế', 'sài gòn', 'miền nam']),

((SELECT id FROM cats WHERE slug = 'mien-trung'),
 'Đà Nẵng', 'Da Nang', 'da-nang', 'city',
 16.0544, 108.2022,
 1285.4, 1200000, NULL,
 'Thành phố trực thuộc trung ương, trung tâm miền Trung.',
 8, ARRAY['miền trung', 'biển', 'du lịch']),

((SELECT id FROM cats WHERE slug = 'mien-trung'),
 'Huế', 'Hue', 'hue', 'city',
 16.4637, 107.5909,
 71.68, 450000, NULL,
 'Cố đô Huế, kinh đô cuối cùng của triều Nguyễn. Di sản văn hóa thế giới UNESCO.',
 9, ARRAY['cố đô', 'nhà nguyễn', 'di sản unesco']),

-- Sông
((SELECT id FROM cats WHERE slug = 'song-ngoi-vn'),
 'Sông Hồng', 'Red River', 'song-hong', 'river',
 21.0, 105.8,
 NULL, NULL, NULL,
 'Sông lớn nhất miền Bắc, bắt nguồn từ Vân Nam (Trung Quốc), dài 1149km. Châu thổ sông Hồng là vựa lúa lớn.',
 9, ARRAY['miền bắc', 'đồng bằng', 'nông nghiệp']),

((SELECT id FROM cats WHERE slug = 'song-ngoi-vn'),
 'Sông Mê Kông', 'Mekong River', 'song-me-kong', 'river',
 10.0, 106.0,
 NULL, NULL, NULL,
 'Sông dài nhất Đông Nam Á (4350km). Đồng bằng sông Cửu Long là vựa lúa lớn nhất Việt Nam.',
 10, ARRAY['miền nam', 'cửu long', 'quốc tế']),

-- Núi
((SELECT id FROM cats WHERE slug = 'nui-vn'),
 'Fansipan', 'Fansipan', 'fansipan', 'mountain',
 22.3033, 103.7750,
 NULL, NULL, NULL,
 'Đỉnh cao nhất Đông Dương (3143m), thuộc dãy Hoàng Liên Sơn, Lào Cai.',
 9, ARRAY['lào cai', 'hoàng liên sơn', 'nóc nhà đông dương']),

-- Biển đảo
((SELECT id FROM cats WHERE slug = 'bien-dao-vn'),
 'Vịnh Hạ Long', 'Ha Long Bay', 'vinh-ha-long', 'sea',
 20.9101, 107.1839,
 1553, NULL, NULL,
 'Di sản thiên nhiên thế giới UNESCO. Gồm gần 2000 đảo đá vôi lớn nhỏ.',
 10, ARRAY['di sản unesco', 'quảng ninh', 'du lịch']),

((SELECT id FROM cats WHERE slug = 'bien-dao-vn'),
 'Quần đảo Hoàng Sa', 'Paracel Islands', 'hoang-sa', 'island',
 16.5, 112.0,
 NULL, NULL, NULL,
 'Quần đảo thuộc chủ quyền Việt Nam trên Biển Đông.',
 10, ARRAY['biển đông', 'chủ quyền', 'hải đảo']),

((SELECT id FROM cats WHERE slug = 'bien-dao-vn'),
 'Quần đảo Trường Sa', 'Spratly Islands', 'truong-sa', 'island',
 8.6383, 111.9164,
 NULL, NULL, NULL,
 'Quần đảo thuộc chủ quyền Việt Nam trên Biển Đông.',
 10, ARRAY['biển đông', 'chủ quyền', 'hải đảo']),

-- Đồng bằng
((SELECT id FROM cats WHERE slug = 'mien-bac'),
 'Đồng bằng sông Hồng', 'Red River Delta', 'dong-bang-song-hong', 'region',
 20.9, 106.1,
 21068, 23000000, NULL,
 'Vùng đồng bằng phì nhiêu ở miền Bắc, nơi sinh sống của người Việt cổ.',
 9, ARRAY['nông nghiệp', 'lúa gạo', 'dân cư đông']),

((SELECT id FROM cats WHERE slug = 'mien-nam'),
 'Đồng bằng sông Cửu Long', 'Mekong Delta', 'dong-bang-song-cuu-long', 'region',
 10.0, 105.5,
 40816, 18000000, NULL,
 'Vùng đồng bằng lớn nhất Việt Nam, vựa lúa và trái cây lớn nhất cả nước.',
 9, ARRAY['nông nghiệp', 'lúa gạo', 'trái cây', 'thủy sản'])

ON CONFLICT (slug) DO NOTHING;
