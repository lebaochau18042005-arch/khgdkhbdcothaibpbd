-- ============================================
-- Seed: Flashcards Địa lý mẫu
-- ============================================

WITH places AS (SELECT id, slug FROM geo_places)

INSERT INTO geo_flashcards (
    place_id, question_vi, answer_vi, card_type,
    base_difficulty, options, tags
) VALUES

-- Identify questions
((SELECT id FROM places WHERE slug = 'viet-nam-place'),
 'Quốc gia nào có hình chữ S trên bản đồ Đông Nam Á?',
 'Việt Nam',
 'identify', 0.3,
 '[{"text": "Việt Nam", "is_correct": true}, {"text": "Thái Lan", "is_correct": false}, {"text": "Lào", "is_correct": false}, {"text": "Campuchia", "is_correct": false}]',
 ARRAY['dễ', 'đông nam á']),

-- Capital questions
((SELECT id FROM places WHERE slug = 'ha-noi'),
 'Thủ đô của Việt Nam là thành phố nào?',
 'Hà Nội',
 'capital', 0.2,
 '[{"text": "Hà Nội", "is_correct": true}, {"text": "TP. Hồ Chí Minh", "is_correct": false}, {"text": "Đà Nẵng", "is_correct": false}, {"text": "Huế", "is_correct": false}]',
 ARRAY['dễ', 'thủ đô']),

-- Locate questions
((SELECT id FROM places WHERE slug = 'vinh-ha-long'),
 'Vịnh Hạ Long thuộc tỉnh nào?',
 'Quảng Ninh',
 'locate', 0.4,
 '[{"text": "Quảng Ninh", "is_correct": true}, {"text": "Hải Phòng", "is_correct": false}, {"text": "Thanh Hóa", "is_correct": false}, {"text": "Nghệ An", "is_correct": false}]',
 ARRAY['di sản', 'du lịch']),

-- Fact questions
((SELECT id FROM places WHERE slug = 'fansipan'),
 'Đỉnh Fansipan cao bao nhiêu mét?',
 '3143 mét',
 'fact', 0.5,
 '[{"text": "3143 mét", "is_correct": true}, {"text": "2913 mét", "is_correct": false}, {"text": "3405 mét", "is_correct": false}, {"text": "2845 mét", "is_correct": false}]',
 ARRAY['núi', 'kỷ lục']),

((SELECT id FROM places WHERE slug = 'song-me-kong'),
 'Sông Mê Kông dài bao nhiêu km?',
 '4350 km',
 'fact', 0.6,
 '[{"text": "4350 km", "is_correct": true}, {"text": "3820 km", "is_correct": false}, {"text": "5120 km", "is_correct": false}, {"text": "4680 km", "is_correct": false}]',
 ARRAY['sông', 'quốc tế']),

-- Compare questions
((SELECT id FROM places WHERE slug = 'dong-bang-song-cuu-long'),
 'Đồng bằng nào lớn hơn: Đồng bằng sông Hồng hay Đồng bằng sông Cửu Long?',
 'Đồng bằng sông Cửu Long (40.816 km² so với 21.068 km²)',
 'compare', 0.5,
 '[{"text": "Đồng bằng sông Cửu Long", "is_correct": true}, {"text": "Đồng bằng sông Hồng", "is_correct": false}]',
 ARRAY['so sánh', 'đồng bằng']),

((SELECT id FROM places WHERE slug = 'song-hong'),
 'Tại sao sông Hồng có tên gọi như vậy?',
 'Vì nước sông có màu đỏ do phù sa từ thượng nguồn Vân Nam (Trung Quốc)',
 'fact', 0.4,
 '[{"text": "Vì nước sông có màu đỏ do phù sa", "is_correct": true}, {"text": "Vì chảy qua vùng đất đỏ bazan", "is_correct": false}, {"text": "Vì có nhiều loài cá đỏ", "is_correct": false}, {"text": "Vì cầu sơn màu đỏ", "is_correct": false}]',
 ARRAY['sông', 'giải thích']),

-- Sovereignty questions
((SELECT id FROM places WHERE slug = 'hoang-sa'),
 'Quần đảo Hoàng Sa thuộc chủ quyền của quốc gia nào?',
 'Việt Nam',
 'fact', 0.3,
 '[{"text": "Việt Nam", "is_correct": true}, {"text": "Trung Quốc", "is_correct": false}, {"text": "Philippines", "is_correct": false}, {"text": "Quốc tế", "is_correct": false}]',
 ARRAY['chủ quyền', 'biển đông']),

((SELECT id FROM places WHERE slug = 'tp-hcm'),
 'Thành phố lớn nhất Việt Nam là thành phố nào?',
 'Thành phố Hồ Chí Minh',
 'identify', 0.3,
 '[{"text": "Thành phố Hồ Chí Minh", "is_correct": true}, {"text": "Hà Nội", "is_correct": false}, {"text": "Đà Nẵng", "is_correct": false}, {"text": "Hải Phòng", "is_correct": false}]',
 ARRAY['thành phố', 'kinh tế']),

((SELECT id FROM places WHERE slug = 'hue'),
 'Cố đô Huế là kinh đô của triều đại phong kiến nào?',
 'Nhà Nguyễn (1802-1945)',
 'fact', 0.5,
 '[{"text": "Nhà Nguyễn", "is_correct": true}, {"text": "Nhà Lê", "is_correct": false}, {"text": "Nhà Trần", "is_correct": false}, {"text": "Nhà Lý", "is_correct": false}]',
 ARRAY['lịch sử', 'cố đô', 'di sản'])

ON CONFLICT DO NOTHING;
