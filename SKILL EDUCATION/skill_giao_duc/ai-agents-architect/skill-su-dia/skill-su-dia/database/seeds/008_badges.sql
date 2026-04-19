-- ============================================
-- Seed: Huy hiệu / Gamification
-- ============================================

INSERT INTO badges (id, name_vi, name_en, description_vi, subject, requirement_type, requirement_value, xp_reward) VALUES

-- Badge Sử
('su-beginner', 'Sử gia Tập sự', 'History Beginner',
 'Hoàn thành 5 bài quiz Lịch sử đầu tiên', 'su',
 'quiz_count', '{"min_count": 5}', 50),

('su-timeline-master', 'Bậc thầy Timeline', 'Timeline Master',
 'Sắp xếp đúng 20 sự kiện lịch sử theo thứ tự thời gian', 'su',
 'timeline_correct', '{"min_count": 20}', 100),

('su-period-expert', 'Chuyên gia Thời kỳ', 'Period Expert',
 'Đạt mastery 80% trở lên cho một thời kỳ lịch sử', 'su',
 'mastery', '{"min_mastery": 0.8, "item_type": "period"}', 150),

('su-100-streak', 'Chuỗi 100', 'Streak 100',
 'Trả lời đúng 100 câu hỏi Sử liên tiếp', 'su',
 'streak', '{"min_streak": 100}', 200),

('su-researcher', 'Nhà Nghiên cứu', 'Researcher',
 'Khám phá lịch sử của 50 địa điểm trên bản đồ 3D', 'su',
 'research_count', '{"min_count": 50}', 250),

-- Badge Địa
('dia-beginner', 'Nhà Địa lý Tập sự', 'Geography Beginner',
 'Hoàn thành 5 bài quiz Địa lý đầu tiên', 'dia',
 'quiz_count', '{"min_count": 5}', 50),

('dia-map-expert', 'Bậc thầy Bản đồ', 'Map Expert',
 'Xác định đúng 50 quốc gia trên bản đồ', 'dia',
 'map_identify', '{"min_count": 50}', 100),

('dia-capital-king', 'Vua Thủ đô', 'Capital King',
 'Nhớ đúng thủ đô của 100 quốc gia', 'dia',
 'capital_correct', '{"min_count": 100}', 150),

('dia-vietnam-expert', 'Chuyên gia VN', 'Vietnam Expert',
 'Đạt mastery 90% cho tất cả địa lý Việt Nam', 'dia',
 'mastery', '{"min_mastery": 0.9, "category": "viet-nam"}', 200),

('dia-explorer', 'Nhà Thám hiểm', 'Explorer',
 'Khám phá AR cho 20 địa điểm địa lý', 'dia',
 'ar_explore', '{"min_count": 20}', 250),

-- Badge chung
('both-perfect-week', 'Tuần Hoàn hảo', 'Perfect Week',
 'Học tập mỗi ngày trong 7 ngày liên tiếp', 'both',
 'streak', '{"min_days": 7}', 100),

('both-level-10', 'Cấp độ 10', 'Level 10',
 'Đạt cấp độ 10 ở bất kỳ môn nào', 'both',
 'level', '{"min_level": 10}', 300)

ON CONFLICT (id) DO NOTHING;
