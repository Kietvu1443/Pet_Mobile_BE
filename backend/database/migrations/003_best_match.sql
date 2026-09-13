-- ============================================================
-- PetSnap / PetHelper
-- Migration 003: Best Match Domain
-- ============================================================
-- Philosophy:
-- "Đây là bằng chứng cho hành trình chúng ta đã đi cùng nhau."
--
-- Best Match starts only after an adoption has been officially
-- approved/completed. It is not a score the user must maintain.
-- The user is never required to upload photos, videos, reports,
-- or check in. Evidence grows naturally from voluntary activity
-- and time spent in the relationship.
--
-- Existing reusable tables:
-- users
-- pets
-- adoption_requests
-- pet_interactions
-- pet_notes
-- pet_scans
-- notifications
-- pet_returns
-- ============================================================

USE pet_helper;

-- ------------------------------------------------------------
-- 1. BEST MATCH RELATIONSHIP
-- One officially adopted pet can have one Best Match journey
-- for that adoption request.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS best_matches (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    user_id INT NOT NULL,
    pet_id INT NOT NULL,
    adoption_request_id INT NOT NULL,

    status ENUM('active', 'cancelled') NOT NULL DEFAULT 'active',

    started_at DATETIME NOT NULL,
    cancelled_at DATETIME NULL,
    cancel_reason TEXT NULL,

    -- Cached values for fast profile/UI display.
    story_count INT UNSIGNED NOT NULL DEFAULT 0,
    evidence_count INT UNSIGNED NOT NULL DEFAULT 0,

    last_story_at DATETIME NULL,
    last_activity_at DATETIME NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

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

    -- One Best Match journey belongs to one official adoption.
    UNIQUE KEY uq_best_match_adoption_request
        (adoption_request_id),

    INDEX idx_best_match_user_status
        (user_id, status),

    INDEX idx_best_match_pet_status
        (pet_id, status),

    INDEX idx_best_match_started_at
        (started_at),

    INDEX idx_best_match_last_activity
        (last_activity_at)

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ------------------------------------------------------------
-- 2. BEST MATCH PRIVACY
-- Best Match must support private users without forcing public
-- social posting.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS best_match_privacy_settings (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    best_match_id BIGINT NOT NULL,

    profile_visibility ENUM('private', 'connections', 'public')
        NOT NULL DEFAULT 'private',

    show_duration TINYINT(1)
        NOT NULL DEFAULT 1,

    show_stories TINYINT(1)
        NOT NULL DEFAULT 1,

    show_media TINYINT(1)
        NOT NULL DEFAULT 1,

    show_ring_badge TINYINT(1)
        NOT NULL DEFAULT 1,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_best_match_privacy_match
        FOREIGN KEY (best_match_id)
        REFERENCES best_matches(id)
        ON DELETE CASCADE,

    UNIQUE KEY uq_best_match_privacy
        (best_match_id)

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ------------------------------------------------------------
-- 3. BEST MATCH STORIES
-- A pet can have its own journey/story with its owner.
-- Stories are voluntary and are not a reporting requirement.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS best_match_stories (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    best_match_id BIGINT NOT NULL,

    author_user_id INT NOT NULL,

    title VARCHAR(255) NULL,
    content TEXT NOT NULL,

    story_date DATE NULL,

    visibility ENUM('private', 'connections', 'public')
        NOT NULL DEFAULT 'private',

    status ENUM('active', 'hidden', 'deleted')
        NOT NULL DEFAULT 'active',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_best_match_story_match
        FOREIGN KEY (best_match_id)
        REFERENCES best_matches(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_best_match_story_author
        FOREIGN KEY (author_user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    INDEX idx_best_match_stories_match_created
        (best_match_id, created_at),

    INDEX idx_best_match_stories_match_story_date
        (best_match_id, story_date),

    INDEX idx_best_match_stories_author
        (author_user_id)

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ------------------------------------------------------------
-- 4. STORY MEDIA
-- Photos and videos attached to voluntary stories.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS best_match_story_media (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    story_id BIGINT NOT NULL,

    media_type ENUM('image', 'video')
        NOT NULL,

    media_path VARCHAR(500) NOT NULL,

    cloudinary_id VARCHAR(255) NULL,

    caption VARCHAR(500) NULL,

    display_order INT UNSIGNED NOT NULL DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_best_match_story_media_story
        FOREIGN KEY (story_id)
        REFERENCES best_match_stories(id)
        ON DELETE CASCADE,

    INDEX idx_best_match_story_media_story_order
        (story_id, display_order)

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ------------------------------------------------------------
-- 5. BEST MATCH EVIDENCE
--
-- This does NOT mean the user must submit proof.
-- It stores meaningful evidence that is voluntarily created or
-- safely derived from existing relationship activity.
--
-- source_type examples:
-- story
-- story_media
-- shared_duration
-- document
-- qr_scan
-- other
--
-- Evidence can be private while still contributing to the user's
-- own journey history.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS best_match_evidence (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    best_match_id BIGINT NOT NULL,

    evidence_type VARCHAR(50) NOT NULL,

    source_type VARCHAR(50) NOT NULL,

    source_id BIGINT NULL,

    title VARCHAR(255) NOT NULL,

    description TEXT NULL,

    evidence_date DATETIME NULL,

    visibility ENUM('private', 'connections', 'public')
        NOT NULL DEFAULT 'private',

    metadata JSON NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_best_match_evidence_match
        FOREIGN KEY (best_match_id)
        REFERENCES best_matches(id)
        ON DELETE CASCADE,

    INDEX idx_best_match_evidence_match_created
        (best_match_id, created_at),

    INDEX idx_best_match_evidence_match_type
        (best_match_id, evidence_type),

    INDEX idx_best_match_evidence_source
        (source_type, source_id),

    INDEX idx_best_match_evidence_date
        (evidence_date)

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ------------------------------------------------------------
-- 6. BEST MATCH ASSESSMENT SNAPSHOTS
--
-- A snapshot describes the current STAGE of the journey. It is NOT
-- a pass/fail score, NOT a compatibility percentage, and does NOT
-- expire a Best Match.
--
-- assessment_level is determined primarily by time elapsed since
-- the official adoption (early | growing | established | long_term).
-- Stories, media, and evidence may enrich the explanation/factors
-- as narrative context, but must NOT be used to advance the level —
-- a quiet user with few stories reaches the same stage, at the same
-- pace, as an active storyteller.
--
-- Future extension points (not yet used to change the level):
-- - comparable successful Best Match patterns
-- - trusted external knowledge, when integrated later
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS best_match_assessments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    best_match_id BIGINT NOT NULL,

    assessment_level ENUM(
        'early',
        'growing',
        'established',
        'long_term'
    ) NOT NULL DEFAULT 'early',

    explanation TEXT NULL,

    factors JSON NULL,

    model_version VARCHAR(100) NULL,

    assessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_best_match_assessment_match
        FOREIGN KEY (best_match_id)
        REFERENCES best_matches(id)
        ON DELETE CASCADE,

    INDEX idx_best_match_assessments_match_date
        (best_match_id, assessed_at)

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ------------------------------------------------------------
-- 7. WELLBEING / SAFETY SIGNALS
--
-- These are signals, not automatic accusations.
-- The system must never conclude that abuse occurred solely from
-- missing posts, missing media, inactivity, or a low evidence count.
--
-- status:
-- open       = detected and not yet reviewed
-- monitoring = keep observing
-- resolved   = no longer concerning / resolved
--
-- severity:
-- info | attention | urgent
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS best_match_wellbeing_signals (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    best_match_id BIGINT NOT NULL,

    signal_type VARCHAR(100) NOT NULL,

    severity ENUM('info', 'attention', 'urgent')
        NOT NULL DEFAULT 'info',

    status ENUM('open', 'monitoring', 'resolved')
        NOT NULL DEFAULT 'open',

    description TEXT NOT NULL,

    source_type VARCHAR(50) NULL,
    source_id BIGINT NULL,

    metadata JSON NULL,

    reviewed_by INT NULL,
    reviewed_at DATETIME NULL,
    resolution_notes TEXT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_best_match_signal_match
        FOREIGN KEY (best_match_id)
        REFERENCES best_matches(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_best_match_signal_reviewer
        FOREIGN KEY (reviewed_by)
        REFERENCES users(id)
        ON DELETE SET NULL,

    INDEX idx_best_match_signals_match_status
        (best_match_id, status),

    INDEX idx_best_match_signals_severity_status
        (severity, status),

    INDEX idx_best_match_signals_created
        (created_at)

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- Notes for application logic
-- ============================================================
--
-- 1. Create best_matches only after adoption is officially
--    approved/completed according to the existing adoption flow.
--
-- 2. started_at should represent the official adoption date.
--    Do not reset it when the user becomes inactive.
--
-- 3. A Best Match never expires or cancels automatically for any
--    reason, including a completed pet return. It ends only when
--    the user explicitly cancels it through the intended
--    user-controlled cancellation workflow.
--
-- 4. Missing stories/photos/videos MUST NEVER be treated as
--    negative evidence.
--
-- 5. pet_notes and pet_scans remain existing reusable sources.
--    Do not duplicate their data into Best Match tables.
--
-- 6. pet_interactions remains the pre-adoption discovery/swipe
--    behavior history. Best Match must not overwrite or compete
--    with recommendation logic.
-- ============================================================
