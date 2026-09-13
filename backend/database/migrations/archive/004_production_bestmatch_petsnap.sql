-- ============================================================================
-- ⛔ SUPERSEDED — DO NOT RUN / ĐÃ BỊ THAY THẾ — KHÔNG CHẠY
-- ============================================================================
-- File này KHÔNG còn nằm trong migration chain (đã di chuyển vào archive/).
--
-- Lý do SUPERSEDED:
--   1. Schema best_matches trong file này KHÁC với schema do 003_best_match.sql
--      tạo ra (003: status ENUM('active','cancelled'), có cancelled_at,
--      cancel_reason — file này: ENUM('active','inactive','cancelled'),
--      có ended_at, source, notes).
--   2. Code hiện tại (models/BestMatch.js, service/bestMatchService.js) dùng
--      cancelled_at / cancel_reason — tức khớp 003, KHÔNG khớp file này.
--   3. File này từng được dùng như bản "consolidated production-safe" để dựng
--      bảng best match trên production khi chưa có 002/003. Production hiện
--      tại đã có schema chuẩn từ 002 + 003, chạy file này là no-op ở mức
--      CREATE IF NOT EXISTS nhưng nếu ai chạy trên DB mới sẽ tạo schema SAI
--      so với code.
--
-- Thứ tự migration đúng: xem migrations/README.md
-- ============================================================================

-- ============================================================================
-- Production Migration: Best Match + PetSnap / Recommendation Telemetry
-- File: 004_production_bestmatch_petsnap.sql
-- Target DB: pet_helper (Production)
--
-- Safety & Idempotency:
-- - Uses CREATE TABLE IF NOT EXISTS exclusively.
-- - ZERO ALTER TABLE, DROP TABLE, or TRUNCATE statements.
-- - ZERO modifications to existing production tables/data.
-- - Excludes 16 phantom/unused tables (profiles, traits, tags, species, breeds, etc.).
-- ============================================================================

-- 1. PetSnap & Recommendation Telemetry
CREATE TABLE IF NOT EXISTS pet_interactions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    pet_id INT NOT NULL,
    interaction_type VARCHAR(50) NOT NULL,
    source VARCHAR(50) NULL,
    session_id VARCHAR(100) NULL,
    metadata JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pet_interactions_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_pet_interactions_pet
        FOREIGN KEY (pet_id)
        REFERENCES pets(id)
        ON DELETE CASCADE,
    INDEX idx_interactions_user (user_id),
    INDEX idx_interactions_pet (pet_id),
    INDEX idx_interactions_type (interaction_type),
    INDEX idx_interactions_user_pet (user_id, pet_id),
    INDEX idx_interactions_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Best Match: Core Table
CREATE TABLE IF NOT EXISTS best_matches (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    pet_id INT NOT NULL,
    adoption_request_id INT NOT NULL,
    status ENUM('active', 'inactive', 'cancelled') NOT NULL DEFAULT 'active',
    started_at DATETIME NOT NULL,
    ended_at DATETIME NULL,
    source VARCHAR(50) NOT NULL DEFAULT 'adoption_approved',
    notes TEXT NULL,
    story_count INT UNSIGNED NOT NULL DEFAULT 0,
    evidence_count INT UNSIGNED NOT NULL DEFAULT 0,
    last_story_at DATETIME NULL,
    last_activity_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_best_match_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_best_match_pet
        FOREIGN KEY (pet_id)
        REFERENCES pets(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_best_match_adoption_request
        FOREIGN KEY (adoption_request_id)
        REFERENCES adoption_requests(id)
        ON DELETE CASCADE,
    UNIQUE KEY uq_best_match_adoption_request (adoption_request_id),
    INDEX idx_best_match_user_status (user_id, status),
    INDEX idx_best_match_pet_status (pet_id, status),
    INDEX idx_best_match_started_at (started_at),
    INDEX idx_best_match_last_activity (last_activity_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Best Match: Privacy Settings (1:1)
CREATE TABLE IF NOT EXISTS best_match_privacy_settings (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    best_match_id BIGINT NOT NULL,
    profile_visibility ENUM('private', 'connections', 'public') NOT NULL DEFAULT 'private',
    show_duration TINYINT(1) NOT NULL DEFAULT 1,
    show_stories TINYINT(1) NOT NULL DEFAULT 1,
    show_media TINYINT(1) NOT NULL DEFAULT 1,
    show_ring_badge TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_best_match_privacy_match
        FOREIGN KEY (best_match_id)
        REFERENCES best_matches(id)
        ON DELETE CASCADE,
    UNIQUE KEY uq_best_match_privacy (best_match_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Best Match: Stories
CREATE TABLE IF NOT EXISTS best_match_stories (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    best_match_id BIGINT NOT NULL,
    author_user_id INT NOT NULL,
    title VARCHAR(255) NULL,
    content TEXT NOT NULL,
    story_date DATE NULL,
    visibility ENUM('private', 'connections', 'public') NOT NULL DEFAULT 'private',
    status ENUM('active', 'hidden', 'deleted') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_best_match_story_match
        FOREIGN KEY (best_match_id)
        REFERENCES best_matches(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_best_match_story_author
        FOREIGN KEY (author_user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,
    INDEX idx_best_match_stories_match_created (best_match_id, created_at),
    INDEX idx_best_match_stories_match_story_date (best_match_id, story_date),
    INDEX idx_best_match_stories_author (author_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Best Match: Story Media (1:N with Stories)
CREATE TABLE IF NOT EXISTS best_match_story_media (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    story_id BIGINT NOT NULL,
    media_type ENUM('image', 'video') NOT NULL,
    media_path VARCHAR(500) NOT NULL,
    cloudinary_id VARCHAR(255) NULL,
    caption VARCHAR(500) NULL,
    display_order INT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_best_match_story_media_story
        FOREIGN KEY (story_id)
        REFERENCES best_match_stories(id)
        ON DELETE CASCADE,
    INDEX idx_best_match_story_media_story_order (story_id, display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Best Match: Evidence
CREATE TABLE IF NOT EXISTS best_match_evidence (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    best_match_id BIGINT NOT NULL,
    evidence_type VARCHAR(50) NOT NULL,
    source_type VARCHAR(50) NOT NULL,
    source_id BIGINT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    evidence_date DATETIME NULL,
    visibility ENUM('private', 'connections', 'public') NOT NULL DEFAULT 'private',
    metadata JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_best_match_evidence_match
        FOREIGN KEY (best_match_id)
        REFERENCES best_matches(id)
        ON DELETE CASCADE,
    INDEX idx_best_match_evidence_match_created (best_match_id, created_at),
    INDEX idx_best_match_evidence_match_type (best_match_id, evidence_type),
    INDEX idx_best_match_evidence_source (source_type, source_id),
    INDEX idx_best_match_evidence_date (evidence_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Best Match: Assessments
CREATE TABLE IF NOT EXISTS best_match_assessments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    best_match_id BIGINT NOT NULL,
    assessment_level ENUM('early', 'growing', 'established', 'long_term') NOT NULL DEFAULT 'early',
    explanation TEXT NULL,
    factors JSON NULL,
    model_version VARCHAR(100) NULL,
    assessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_best_match_assessment_match
        FOREIGN KEY (best_match_id)
        REFERENCES best_matches(id)
        ON DELETE CASCADE,
    INDEX idx_best_match_assessments_match_date (best_match_id, assessed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Best Match: Wellbeing Signals
CREATE TABLE IF NOT EXISTS best_match_wellbeing_signals (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    best_match_id BIGINT NOT NULL,
    signal_type VARCHAR(100) NOT NULL,
    severity ENUM('info', 'attention', 'urgent') NOT NULL DEFAULT 'info',
    status ENUM('open', 'monitoring', 'resolved') NOT NULL DEFAULT 'open',
    description TEXT NOT NULL,
    source_type VARCHAR(50) NULL,
    source_id BIGINT NULL,
    metadata JSON NULL,
    reviewed_by INT NULL,
    reviewed_at DATETIME NULL,
    resolution_notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_best_match_signal_match
        FOREIGN KEY (best_match_id)
        REFERENCES best_matches(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_best_match_signal_reviewer
        FOREIGN KEY (reviewed_by)
        REFERENCES users(id)
        ON DELETE SET NULL,
    INDEX idx_best_match_signals_match_status (best_match_id, status),
    INDEX idx_best_match_signals_severity_status (severity, status),
    INDEX idx_best_match_signals_created (created_at),
    INDEX fk_best_match_signal_reviewer (reviewed_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
