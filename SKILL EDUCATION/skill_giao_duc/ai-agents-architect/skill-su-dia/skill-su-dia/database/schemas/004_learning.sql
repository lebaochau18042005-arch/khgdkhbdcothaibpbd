-- ============================================
-- SKILL SỬ-ĐỊA: Adaptive Learning & Quiz Schema
-- Tổng hợp từ: Geography (proso adaptive), EdCore (gamification), History (research)
-- ============================================

-- ========== QUIZ & ASSESSMENT ==========

-- Bộ câu hỏi
CREATE TABLE IF NOT EXISTS quiz_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title_vi VARCHAR(300) NOT NULL,
    title_en VARCHAR(300),
    slug VARCHAR(150) UNIQUE NOT NULL,
    subject VARCHAR(10) NOT NULL CHECK (subject IN ('su', 'dia', 'both')),

    -- Liên kết nội dung
    period_id UUID REFERENCES historical_periods(id),      -- Cho Sử
    category_id UUID REFERENCES geo_categories(id),         -- Cho Địa
    map_context_id UUID REFERENCES geo_map_contexts(id),    -- Cho Địa

    description_vi TEXT,
    description_en TEXT,
    difficulty VARCHAR(20) DEFAULT 'medium'
        CHECK (difficulty IN ('easy', 'medium', 'hard', 'adaptive')),
    question_count INTEGER DEFAULT 10,
    time_limit_seconds INTEGER,

    -- Gamification (từ EdCore)
    xp_reward INTEGER DEFAULT 10,
    badge_id VARCHAR(50),

    is_public BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Câu hỏi quiz
CREATE TABLE IF NOT EXISTS quiz_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_set_id UUID REFERENCES quiz_sets(id) ON DELETE CASCADE,

    -- Nội dung câu hỏi
    question_vi TEXT NOT NULL,
    question_en TEXT,
    question_type VARCHAR(30) NOT NULL
        CHECK (question_type IN (
            'multiple_choice', 'true_false', 'fill_blank',
            'map_click', 'timeline_order', 'match_pairs',
            'image_identify', 'ar_identify'
        )),

    -- Đáp án
    correct_answer TEXT NOT NULL,
    options JSONB DEFAULT '[]',         -- [{text, is_correct}]
    explanation_vi TEXT,
    explanation_en TEXT,

    -- Media
    image_url VARCHAR(512),
    map_config JSONB,                   -- Cho map_click questions
    timeline_config JSONB,              -- Cho timeline_order questions
    ar_config JSONB,                    -- Cho ar_identify questions

    -- Adaptive Learning (từ Geography proso)
    base_difficulty DOUBLE PRECISION DEFAULT 0.5,
    discrimination DOUBLE PRECISION DEFAULT 1.0,
    guessing DOUBLE PRECISION DEFAULT 0.25,

    -- Liên kết
    event_id UUID REFERENCES historical_events(id),
    place_id UUID REFERENCES geo_places(id),
    flashcard_id UUID REFERENCES geo_flashcards(id),

    sort_order INTEGER DEFAULT 0,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- ========== ADAPTIVE LEARNING (từ Geography proso framework) ==========

-- Phiên học tập
CREATE TABLE IF NOT EXISTS learning_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject VARCHAR(10) NOT NULL CHECK (subject IN ('su', 'dia')),
    quiz_set_id UUID REFERENCES quiz_sets(id),

    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,

    -- Kết quả
    total_questions INTEGER DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,
    score DOUBLE PRECISION,
    time_spent_seconds INTEGER,

    -- Adaptive metrics
    estimated_ability DOUBLE PRECISION DEFAULT 0.0,  -- Theta trong IRT
    ability_change DOUBLE PRECISION DEFAULT 0.0
);

-- Câu trả lời của học sinh
CREATE TABLE IF NOT EXISTS learning_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES learning_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES quiz_questions(id),

    -- Đáp án
    user_answer TEXT,
    is_correct BOOLEAN NOT NULL,
    response_time_ms INTEGER,

    -- Map click data (cho câu hỏi bản đồ)
    click_lat DOUBLE PRECISION,
    click_lng DOUBLE PRECISION,
    distance_error_km DOUBLE PRECISION,

    -- Adaptive metrics (từ Geography proso)
    predicted_probability DOUBLE PRECISION,     -- P(correct) trước khi trả lời
    item_difficulty_at_time DOUBLE PRECISION,
    ability_after DOUBLE PRECISION,

    answered_at TIMESTAMP DEFAULT NOW()
);

-- Kiến thức của học sinh (Knowledge Map - từ Geography)
CREATE TABLE IF NOT EXISTS user_knowledge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Liên kết đến item
    item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('event', 'figure', 'place', 'flashcard', 'concept')),
    item_id UUID NOT NULL,

    -- Spaced Repetition (từ FSRS algorithm)
    stability DOUBLE PRECISION DEFAULT 0.0,
    difficulty DOUBLE PRECISION DEFAULT 0.5,
    elapsed_days DOUBLE PRECISION DEFAULT 0.0,
    scheduled_days DOUBLE PRECISION DEFAULT 0.0,
    reps INTEGER DEFAULT 0,
    lapses INTEGER DEFAULT 0,
    state VARCHAR(20) DEFAULT 'new'
        CHECK (state IN ('new', 'learning', 'review', 'relearning')),

    -- Review schedule
    last_review_at TIMESTAMP,
    next_review_at TIMESTAMP,

    -- Performance metrics
    total_attempts INTEGER DEFAULT 0,
    correct_attempts INTEGER DEFAULT 0,
    mastery_level DOUBLE PRECISION DEFAULT 0.0 CHECK (mastery_level BETWEEN 0 AND 1),

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(user_id, item_type, item_id)
);

-- ========== GAMIFICATION (từ EdCore) ==========

-- Huy hiệu / Thành tích
CREATE TABLE IF NOT EXISTS badges (
    id VARCHAR(50) PRIMARY KEY,
    name_vi VARCHAR(200) NOT NULL,
    name_en VARCHAR(200),
    description_vi TEXT,
    description_en TEXT,
    icon_url VARCHAR(512),
    subject VARCHAR(10) CHECK (subject IN ('su', 'dia', 'both')),
    requirement_type VARCHAR(50) NOT NULL,  -- 'quiz_score', 'streak', 'mastery', etc.
    requirement_value JSONB NOT NULL,       -- {min_score: 90, quiz_count: 10}
    xp_reward INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Huy hiệu đã đạt
CREATE TABLE IF NOT EXISTS user_badges (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_id VARCHAR(50) NOT NULL REFERENCES badges(id),
    earned_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, badge_id)
);

-- Điểm kinh nghiệm
CREATE TABLE IF NOT EXISTS user_xp (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject VARCHAR(10) NOT NULL CHECK (subject IN ('su', 'dia')),
    total_xp INTEGER DEFAULT 0,
    current_level INTEGER DEFAULT 1,
    streak_days INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_activity_date DATE,
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, subject)
);

-- ========== A/B TESTING (từ Geography project) ==========

CREATE TABLE IF NOT EXISTS ab_experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT FALSE,
    config JSONB NOT NULL,  -- {variants: [{name, weight, params}]}
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ab_assignments (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    experiment_id UUID NOT NULL REFERENCES ab_experiments(id) ON DELETE CASCADE,
    variant VARCHAR(50) NOT NULL,
    assigned_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, experiment_id)
);

-- Indexes
CREATE INDEX idx_sessions_user ON learning_sessions(user_id);
CREATE INDEX idx_sessions_subject ON learning_sessions(subject);
CREATE INDEX idx_answers_session ON learning_answers(session_id);
CREATE INDEX idx_answers_user ON learning_answers(user_id);
CREATE INDEX idx_answers_question ON learning_answers(question_id);
CREATE INDEX idx_knowledge_user ON user_knowledge(user_id);
CREATE INDEX idx_knowledge_item ON user_knowledge(item_type, item_id);
CREATE INDEX idx_knowledge_review ON user_knowledge(next_review_at);
CREATE INDEX idx_user_xp_subject ON user_xp(user_id, subject);
