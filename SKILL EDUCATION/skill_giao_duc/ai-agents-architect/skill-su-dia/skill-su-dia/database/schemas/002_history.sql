-- ============================================
-- SKILL SỬ: History Education Schema
-- Tổng hợp từ: History (3D Globe), EdCore (AR), Vis-Timeline
-- ============================================

-- Thời kỳ lịch sử
CREATE TABLE IF NOT EXISTS historical_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_vi VARCHAR(200) NOT NULL,
    name_en VARCHAR(200),
    slug VARCHAR(100) UNIQUE NOT NULL,
    start_year INTEGER NOT NULL,
    end_year INTEGER,
    description_vi TEXT,
    description_en TEXT,
    color VARCHAR(7) DEFAULT '#3B82F6',  -- Cho timeline visualization
    icon_url VARCHAR(512),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Sự kiện lịch sử
CREATE TABLE IF NOT EXISTS historical_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_id UUID REFERENCES historical_periods(id) ON DELETE SET NULL,
    title_vi VARCHAR(300) NOT NULL,
    title_en VARCHAR(300),
    slug VARCHAR(150) UNIQUE NOT NULL,

    -- Thời gian (hỗ trợ vis-timeline format)
    start_date DATE NOT NULL,
    end_date DATE,
    date_precision VARCHAR(20) DEFAULT 'day'
        CHECK (date_precision IN ('year', 'month', 'day', 'exact')),

    -- Nội dung
    summary_vi TEXT,
    summary_en TEXT,
    content_vi TEXT,
    content_en TEXT,

    -- Vị trí (hỗ trợ 3D globe từ History project)
    location_name VARCHAR(200),
    location_lat DOUBLE PRECISION,
    location_lng DOUBLE PRECISION,
    location_images JSONB DEFAULT '[]',

    -- AR Experience (từ EdCore)
    ar_model_url VARCHAR(512),
    ar_scene_config JSONB,

    -- Timeline visualization (từ vis-timeline)
    timeline_type VARCHAR(20) DEFAULT 'point'
        CHECK (timeline_type IN ('point', 'range', 'background')),
    timeline_group VARCHAR(100),
    timeline_class VARCHAR(100),
    timeline_style TEXT,

    -- Metadata
    importance INTEGER DEFAULT 5 CHECK (importance BETWEEN 1 AND 10),
    tags TEXT[] DEFAULT '{}',
    sources JSONB DEFAULT '[]',
    media_urls JSONB DEFAULT '[]',

    -- Research (từ History - Valyu DeepResearch)
    research_id VARCHAR(100),
    research_status VARCHAR(20) DEFAULT 'none'
        CHECK (research_status IN ('none', 'queued', 'running', 'completed', 'failed')),
    research_content TEXT,
    research_sources JSONB DEFAULT '[]',

    -- Sharing
    is_public BOOLEAN DEFAULT TRUE,
    share_token VARCHAR(100) UNIQUE,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Nhân vật lịch sử
CREATE TABLE IF NOT EXISTS historical_figures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_vi VARCHAR(200) NOT NULL,
    name_en VARCHAR(200),
    slug VARCHAR(100) UNIQUE NOT NULL,
    birth_year INTEGER,
    death_year INTEGER,
    birth_date DATE,
    death_date DATE,
    nationality VARCHAR(100),
    biography_vi TEXT,
    biography_en TEXT,
    portrait_url VARCHAR(512),
    ar_model_url VARCHAR(512),
    tags TEXT[] DEFAULT '{}',
    achievements JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Liên kết nhân vật - sự kiện
CREATE TABLE IF NOT EXISTS event_figures (
    event_id UUID NOT NULL REFERENCES historical_events(id) ON DELETE CASCADE,
    figure_id UUID NOT NULL REFERENCES historical_figures(id) ON DELETE CASCADE,
    role VARCHAR(100),  -- 'leader', 'participant', 'witness', etc.
    PRIMARY KEY (event_id, figure_id)
);

-- Timeline Groups (cho vis-timeline)
CREATE TABLE IF NOT EXISTS timeline_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_vi VARCHAR(200) NOT NULL,
    name_en VARCHAR(200),
    slug VARCHAR(100) UNIQUE NOT NULL,
    parent_id UUID REFERENCES timeline_groups(id),
    style TEXT,
    class_name VARCHAR(100),
    sort_order INTEGER DEFAULT 0
);

-- Indexes
CREATE INDEX idx_events_period ON historical_events(period_id);
CREATE INDEX idx_events_start_date ON historical_events(start_date);
CREATE INDEX idx_events_location ON historical_events(location_lat, location_lng);
CREATE INDEX idx_events_tags ON historical_events USING GIN(tags);
CREATE INDEX idx_events_importance ON historical_events(importance DESC);
CREATE INDEX idx_events_share_token ON historical_events(share_token);
CREATE INDEX idx_figures_birth ON historical_figures(birth_year);
CREATE INDEX idx_figures_death ON historical_figures(death_year);
