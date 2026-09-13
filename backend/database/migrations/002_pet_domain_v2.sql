-- ============================================================
-- PETSNAP / PET HELPER
-- PET DOMAIN V2
--
-- Migration: 002_pet_domain_v2
--
-- Purpose:
-- 1. Normalize species and breeds
-- 2. Add flexible traits and tags
-- 3. Add user pet preferences
-- 4. Track detailed user interactions
-- 5. Support PetSnap discovery / recommendation engine
--
-- IMPORTANT:
-- - Does NOT remove legacy data
-- - Does NOT drop V1 tables
-- - Existing pets.pet_type and pets.breed are preserved
-- ============================================================-- Database selected by connection
-- ============================================================
-- SECTION 1
-- PET TAXONOMY
-- ============================================================


-- ------------------------------------------------------------
-- 1. PET SPECIES
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pet_species (
    id INT AUTO_INCREMENT PRIMARY KEY,

    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,

    description TEXT NULL,

    is_active TINYINT(1) NOT NULL DEFAULT 1,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_pet_species_name (name),
    UNIQUE KEY uq_pet_species_slug (slug)
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_0900_ai_ci;


-- ------------------------------------------------------------
-- 2. PET BREEDS
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pet_breeds (
    id INT AUTO_INCREMENT PRIMARY KEY,

    species_id INT NOT NULL,

    name VARCHAR(150) NOT NULL,
    slug VARCHAR(150) NOT NULL,

    description TEXT NULL,

    is_active TINYINT(1) NOT NULL DEFAULT 1,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_pet_breeds_species
        FOREIGN KEY (species_id)
        REFERENCES pet_species(id)
        ON DELETE CASCADE,

    UNIQUE KEY uq_pet_breeds_species_name
        (species_id, name),

    UNIQUE KEY uq_pet_breeds_species_slug
        (species_id, slug),

    INDEX idx_pet_breeds_species
        (species_id)

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_0900_ai_ci;


-- ============================================================
-- SECTION 2
-- PET TRAITS
-- ============================================================


-- ------------------------------------------------------------
-- 3. TRAITS
--
-- Flexible attributes for matching and filtering
--
-- Examples:
-- friendly
-- playful
-- calm
-- energetic
-- good_with_kids
-- good_with_dogs
-- apartment_friendly
-- beginner_friendly
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS traits (
    id INT AUTO_INCREMENT PRIMARY KEY,

    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,

    category VARCHAR(50) NOT NULL,

    description TEXT NULL,

    is_active TINYINT(1) NOT NULL DEFAULT 1,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uq_traits_name (name),
    UNIQUE KEY uq_traits_slug (slug),

    INDEX idx_traits_category (category)

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_0900_ai_ci;


-- ------------------------------------------------------------
-- 4. PET TRAITS
--
-- Many-to-many:
--
-- pet <-> traits
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pet_traits (
    id INT AUTO_INCREMENT PRIMARY KEY,

    pet_id INT NOT NULL,
    trait_id INT NOT NULL,

    score TINYINT UNSIGNED NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_pet_traits_pet
        FOREIGN KEY (pet_id)
        REFERENCES pets(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_pet_traits_trait
        FOREIGN KEY (trait_id)
        REFERENCES traits(id)
        ON DELETE CASCADE,

    UNIQUE KEY uq_pet_trait
        (pet_id, trait_id),

    INDEX idx_pet_traits_pet
        (pet_id),

    INDEX idx_pet_traits_trait
        (trait_id)

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_0900_ai_ci;


-- ============================================================
-- SECTION 3
-- TAG SYSTEM
-- ============================================================


-- ------------------------------------------------------------
-- 5. TAGS
--
-- Tags are more flexible than traits.
--
-- Examples:
-- rescue
-- vaccinated
-- urgent
-- featured
-- special_needs
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tags (
    id INT AUTO_INCREMENT PRIMARY KEY,

    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,

    category VARCHAR(50) NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uq_tags_name (name),
    UNIQUE KEY uq_tags_slug (slug),

    INDEX idx_tags_category (category)

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_0900_ai_ci;


-- ------------------------------------------------------------
-- 6. PET TAGS
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pet_tags (
    id INT AUTO_INCREMENT PRIMARY KEY,

    pet_id INT NOT NULL,
    tag_id INT NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_pet_tags_pet
        FOREIGN KEY (pet_id)
        REFERENCES pets(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_pet_tags_tag
        FOREIGN KEY (tag_id)
        REFERENCES tags(id)
        ON DELETE CASCADE,

    UNIQUE KEY uq_pet_tag
        (pet_id, tag_id),

    INDEX idx_pet_tags_pet
        (pet_id),

    INDEX idx_pet_tags_tag
        (tag_id)

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_0900_ai_ci;


-- ============================================================
-- SECTION 4
-- USER PET PREFERENCES
-- ============================================================


-- ------------------------------------------------------------
-- 7. USER PET PREFERENCES
--
-- One preference profile per user.
--
-- Used by PetSnap discovery.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS user_pet_preferences (
    id INT AUTO_INCREMENT PRIMARY KEY,

    user_id INT NOT NULL,

    preferred_species_id INT NULL,

    preferred_gender VARCHAR(20) NULL,

    min_age_months INT UNSIGNED NULL,
    max_age_months INT UNSIGNED NULL,

    min_weight_kg DECIMAL(6,2) NULL,
    max_weight_kg DECIMAL(6,2) NULL,

    activity_level VARCHAR(30) NULL,

    good_with_children TINYINT(1) NULL,
    good_with_dogs TINYINT(1) NULL,
    good_with_cats TINYINT(1) NULL,

    apartment_friendly TINYINT(1) NULL,

    experience_level VARCHAR(30) NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_user_preferences_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_user_preferences_species
        FOREIGN KEY (preferred_species_id)
        REFERENCES pet_species(id)
        ON DELETE SET NULL,

    UNIQUE KEY uq_user_pet_preference
        (user_id),

    INDEX idx_preferences_species
        (preferred_species_id)

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_0900_ai_ci;


-- ============================================================
-- SECTION 5
-- PET INTERACTION ENGINE
-- ============================================================


-- ------------------------------------------------------------
-- 8. PET INTERACTIONS
--
-- Records ALL user actions.
--
-- Examples:
-- view
-- like
-- pass
-- super_like
-- favorite
-- adopt_click
-- detail_view
--
-- This becomes the main behavior history.
-- ------------------------------------------------------------

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

    INDEX idx_interactions_user
        (user_id),

    INDEX idx_interactions_pet
        (pet_id),

    INDEX idx_interactions_type
        (interaction_type),

    INDEX idx_interactions_user_pet
        (user_id, pet_id),

    INDEX idx_interactions_user_created
        (user_id, created_at)

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_0900_ai_ci;


-- ============================================================
-- SECTION 6
-- DISCOVERY / RECOMMENDATION ENGINE
-- ============================================================


-- ------------------------------------------------------------
-- 9. PET RECOMMENDATIONS
--
-- Optional cache / ranking layer.
--
-- Engine can calculate candidates and save them here.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pet_recommendations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    user_id INT NOT NULL,

    pet_id INT NOT NULL,

    score DECIMAL(8,4) NOT NULL DEFAULT 0,

    reason JSON NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'pending',

    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    expires_at DATETIME NULL,

    CONSTRAINT fk_pet_recommendations_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_pet_recommendations_pet
        FOREIGN KEY (pet_id)
        REFERENCES pets(id)
        ON DELETE CASCADE,

    UNIQUE KEY uq_user_pet_recommendation
        (user_id, pet_id),

    INDEX idx_recommendations_user_status
        (user_id, status),

    INDEX idx_recommendations_user_score
        (user_id, score DESC),

    INDEX idx_recommendations_pet
        (pet_id),

    INDEX idx_recommendations_expires
        (expires_at)

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_0900_ai_ci;


-- ============================================================
-- SECTION 7
-- LINK PETS TO NORMALIZED TAXONOMY
-- ============================================================


ALTER TABLE pets
    ADD COLUMN species_id INT NULL AFTER pet_type,
    ADD COLUMN primary_breed_id INT NULL AFTER breed,
    ADD COLUMN secondary_breed_id INT NULL AFTER breed_secondary;


ALTER TABLE pets
    ADD CONSTRAINT fk_pets_species
        FOREIGN KEY (species_id)
        REFERENCES pet_species(id)
        ON DELETE SET NULL,

    ADD CONSTRAINT fk_pets_primary_breed
        FOREIGN KEY (primary_breed_id)
        REFERENCES pet_breeds(id)
        ON DELETE SET NULL,

    ADD CONSTRAINT fk_pets_secondary_breed
        FOREIGN KEY (secondary_breed_id)
        REFERENCES pet_breeds(id)
        ON DELETE SET NULL;


ALTER TABLE pets
    ADD INDEX idx_pets_species
        (species_id),

    ADD INDEX idx_pets_primary_breed
        (primary_breed_id),

    ADD INDEX idx_pets_secondary_breed
        (secondary_breed_id);


-- ============================================================
-- END OF PET DOMAIN V2
-- ============================================================