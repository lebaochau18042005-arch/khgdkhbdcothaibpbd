-- ============================================
-- SKILL SỬ-ĐỊA: User & Authentication Schema
-- Tổng hợp từ: EdCore (JHipster), Geography (Django), History (Supabase)
-- ============================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    login VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(191) NOT NULL UNIQUE,
    password_hash VARCHAR(256),
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    avatar_url VARCHAR(512),
    lang_key VARCHAR(10) DEFAULT 'vi',

    -- Subscription & Billing (từ History)
    subscription_tier VARCHAR(20) DEFAULT 'free'
        CHECK (subscription_tier IN ('free', 'basic', 'premium', 'unlimited')),
    subscription_status VARCHAR(20) DEFAULT 'active'
        CHECK (subscription_status IN ('active', 'inactive', 'trial')),

    -- Learning Profile (từ Geography adaptive learning)
    learning_level VARCHAR(20) DEFAULT 'beginner'
        CHECK (learning_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
    preferred_subjects TEXT[] DEFAULT ARRAY['su', 'dia'],

    -- Role & Auth (từ EdCore)
    activated BOOLEAN DEFAULT FALSE,
    activation_key VARCHAR(20),
    reset_key VARCHAR(20),
    reset_date TIMESTAMP,

    -- Audit
    created_by VARCHAR(50) NOT NULL DEFAULT 'system',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS authorities (
    name VARCHAR(50) PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS user_authorities (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    authority_name VARCHAR(50) NOT NULL REFERENCES authorities(name),
    PRIMARY KEY (user_id, authority_name)
);

-- Rate Limiting (từ History)
CREATE TABLE IF NOT EXISTS user_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    daily_usage_count INTEGER DEFAULT 0,
    monthly_usage_count INTEGER DEFAULT 0,
    reset_date DATE DEFAULT CURRENT_DATE,
    monthly_reset_date DATE DEFAULT DATE_TRUNC('month', CURRENT_DATE),
    last_request_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_login ON users(login);
CREATE INDEX idx_users_created_at ON users(created_at DESC);
