-- ============================================
-- SKILL ĐỊA: Geography Education Schema
-- Tổng hợp từ: Geography (Adaptive Learning), Leafmap, OrbisGIS, GeoLearn-AR
-- ============================================

-- Danh mục địa lý (từ geography-flashcards.json)
CREATE TABLE IF NOT EXISTS geo_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_vi VARCHAR(200) NOT NULL,
    name_en VARCHAR(200),
    slug VARCHAR(100) UNIQUE NOT NULL,
    type VARCHAR(50) NOT NULL
        CHECK (type IN (
            'continent', 'country', 'state', 'region', 'province',
            'city', 'river', 'lake', 'sea', 'ocean',
            'mountain', 'island', 'desert', 'peninsula',
            'district', 'autonomous_region'
        )),
    parent_id UUID REFERENCES geo_categories(id),
    description_vi TEXT,
    description_en TEXT,
    map_svg_url VARCHAR(512),       -- SVG map file (từ geography project)
    thumbnail_url VARCHAR(512),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Địa điểm / Thuật ngữ địa lý (từ geography terms)
CREATE TABLE IF NOT EXISTS geo_places (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES geo_categories(id) ON DELETE SET NULL,
    name_vi VARCHAR(200) NOT NULL,
    name_en VARCHAR(200),
    name_local VARCHAR(200),       -- Tên bản địa
    slug VARCHAR(100) UNIQUE NOT NULL,
    type VARCHAR(50) NOT NULL,

    -- Spatial data (từ Leafmap, OrbisGIS - PostGIS compatible)
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    geom GEOMETRY(Geometry, 4326),  -- PostGIS geometry
    bbox JSONB,                     -- Bounding box [minLng, minLat, maxLng, maxLat]
    geojson JSONB,                  -- GeoJSON feature

    -- Thông tin chi tiết
    area_km2 DOUBLE PRECISION,
    population BIGINT,
    elevation_m DOUBLE PRECISION,
    capital VARCHAR(200),

    -- Nội dung giáo dục
    description_vi TEXT,
    description_en TEXT,
    fun_facts JSONB DEFAULT '[]',
    climate_info JSONB,

    -- AR (từ GeoLearn-AR)
    ar_model_url VARCHAR(512),
    ar_qr_code_url VARCHAR(512),
    ar_scene_config JSONB,

    -- Media
    images JSONB DEFAULT '[]',
    map_layer_url VARCHAR(512),

    -- Metadata
    tags TEXT[] DEFAULT '{}',
    importance INTEGER DEFAULT 5 CHECK (importance BETWEEN 1 AND 10),

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Flashcards (từ geography-flashcards.json)
CREATE TABLE IF NOT EXISTS geo_flashcards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    place_id UUID REFERENCES geo_places(id) ON DELETE CASCADE,
    category_id UUID REFERENCES geo_categories(id) ON DELETE SET NULL,

    -- Nội dung flashcard
    question_vi TEXT NOT NULL,
    question_en TEXT,
    answer_vi TEXT NOT NULL,
    answer_en TEXT,
    hint_vi TEXT,
    hint_en TEXT,

    -- Loại flashcard
    card_type VARCHAR(30) DEFAULT 'identify'
        CHECK (card_type IN ('identify', 'locate', 'capital', 'flag', 'fact', 'compare')),

    -- Hình ảnh / Bản đồ
    question_image_url VARCHAR(512),
    answer_image_url VARCHAR(512),
    map_highlight_config JSONB,     -- Config để highlight vùng trên bản đồ

    -- Difficulty (từ adaptive learning)
    base_difficulty DOUBLE PRECISION DEFAULT 0.5 CHECK (base_difficulty BETWEEN 0 AND 1),

    -- Options (cho multiple choice)
    options JSONB DEFAULT '[]',     -- [{text, correct, distractor_type}]

    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Bản đồ contexts (từ geography project - maps/learning units)
CREATE TABLE IF NOT EXISTS geo_map_contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_vi VARCHAR(200) NOT NULL,
    name_en VARCHAR(200),
    slug VARCHAR(100) UNIQUE NOT NULL,
    description_vi TEXT,

    -- Map configuration
    center_lat DOUBLE PRECISION DEFAULT 0,
    center_lng DOUBLE PRECISION DEFAULT 0,
    zoom_level INTEGER DEFAULT 5,
    map_style VARCHAR(50) DEFAULT 'standard',  -- standard, satellite, terrain

    -- SVG overlay (từ geography project)
    svg_url VARCHAR(512),
    svg_config JSONB,

    -- Tile layer config (từ Leafmap/Leaflet)
    tile_url VARCHAR(512) DEFAULT 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    tile_attribution TEXT,

    -- GIS layers (từ OrbisGIS)
    layers JSONB DEFAULT '[]',      -- [{name, url, type, style, visible}]

    -- Leafmap config
    basemap VARCHAR(50) DEFAULT 'OpenStreetMap',

    created_at TIMESTAMP DEFAULT NOW()
);

-- Liên kết place - context
CREATE TABLE IF NOT EXISTS geo_context_places (
    context_id UUID NOT NULL REFERENCES geo_map_contexts(id) ON DELETE CASCADE,
    place_id UUID NOT NULL REFERENCES geo_places(id) ON DELETE CASCADE,
    highlight_style JSONB,
    PRIMARY KEY (context_id, place_id)
);

-- Thủ đô (từ capitals.csv)
CREATE TABLE IF NOT EXISTS geo_capitals (
    country_id UUID NOT NULL REFERENCES geo_places(id) ON DELETE CASCADE,
    capital_id UUID NOT NULL REFERENCES geo_places(id) ON DELETE CASCADE,
    PRIMARY KEY (country_id, capital_id)
);

-- Mnemonics / Ghi nhớ (từ proso_mnemonics)
CREATE TABLE IF NOT EXISTS geo_mnemonics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    place_id UUID NOT NULL REFERENCES geo_places(id) ON DELETE CASCADE,
    text_vi TEXT NOT NULL,
    text_en TEXT,
    language VARCHAR(10) DEFAULT 'vi',
    upvotes INTEGER DEFAULT 0,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_geo_places_category ON geo_places(category_id);
CREATE INDEX idx_geo_places_type ON geo_places(type);
CREATE INDEX idx_geo_places_location ON geo_places(latitude, longitude);
CREATE INDEX idx_geo_places_tags ON geo_places USING GIN(tags);
CREATE INDEX idx_geo_flashcards_place ON geo_flashcards(place_id);
CREATE INDEX idx_geo_flashcards_category ON geo_flashcards(category_id);
CREATE INDEX idx_geo_flashcards_type ON geo_flashcards(card_type);

-- Spatial index (PostGIS)
CREATE INDEX idx_geo_places_geom ON geo_places USING GIST(geom);
