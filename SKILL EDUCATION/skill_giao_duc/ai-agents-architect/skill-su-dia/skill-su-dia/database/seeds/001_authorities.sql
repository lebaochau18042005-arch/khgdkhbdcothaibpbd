-- ============================================
-- Seed: Authorities & Default Roles
-- ============================================

INSERT INTO authorities (name) VALUES
    ('ROLE_ADMIN'),
    ('ROLE_USER'),
    ('ROLE_TEACHER'),
    ('ROLE_STUDENT')
ON CONFLICT DO NOTHING;
