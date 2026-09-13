-- =========================================================
-- PETSNAP / PET HELPER
-- PET DOMAIN V1 FOUNDATION
--
-- Migration: 001_pet_domain_v1
--
-- Strategy:
-- 1. Never drop existing tables
-- 2. Never delete existing pet data
-- 3. Keep legacy columns for backward compatibility
-- 4. Add normalized Pet Domain tables
-- 5. Migrate legacy data where possible
-- =========================================================-- Database selected by connection
-- =========================================================
-- SECTION 1
-- UPGRADE PETS CORE
-- =========================================================

ALTER TABLE pets
    ADD COLUMN breed_secondary VARCHAR(255) NULL AFTER breed,
    ADD COLUMN birth_date DATE NULL AFTER breed_secondary,
    ADD COLUMN estimated_age_months INT UNSIGNED NULL AFTER birth_date,
    ADD COLUMN source_type VARCHAR(50) NULL AFTER gender,
    ADD COLUMN intake_date DATE NULL AFTER source_url,
    ADD COLUMN adoption_status VARCHAR(30)
        NOT NULL DEFAULT 'available'
        AFTER intake_date,
    ADD COLUMN availability_status VARCHAR(30)
        NOT NULL DEFAULT 'active'
        AFTER adoption_status,
    ADD COLUMN notes TEXT NULL AFTER contact_info;


-- =========================================================
-- SECTION 2
-- PET PHYSICAL PROFILE
-- =========================================================

CREATE TABLE IF NOT EXISTS pet_physical_profiles (

    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    pet_id INT NOT NULL,

    size ENUM(
        'tiny',
        'small',
        'medium',
        'large',
        'giant'
    ) NULL,

    weight_kg DECIMAL(6,2) NULL,

    height_cm DECIMAL(6,2) NULL,

    body_condition ENUM(
        'underweight',
        'ideal',
        'overweight',
        'unknown'
    ) NOT NULL DEFAULT 'unknown',

    primary_color VARCHAR(100) NULL,

    secondary_color VARCHAR(100) NULL,

    coat_length ENUM(
        'hairless',
        'short',
        'medium',
        'long',
        'unknown'
    ) NOT NULL DEFAULT 'unknown',

    coat_type VARCHAR(100) NULL,

    shedding_level TINYINT UNSIGNED NULL,

    eye_color VARCHAR(100) NULL,

    ear_type VARCHAR(100) NULL,

    tail_type VARCHAR(100) NULL,

    distinctive_features TEXT NULL,

    assessment_source ENUM(
        'staff',
        'shelter',
        'previous_owner',
        'veterinarian',
        'unknown'
    ) NOT NULL DEFAULT 'unknown',

    assessment_confidence TINYINT UNSIGNED NULL,

    assessed_at DATETIME NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT chk_physical_shedding
        CHECK (
            shedding_level IS NULL
            OR shedding_level BETWEEN 1 AND 5
        ),

    CONSTRAINT chk_physical_confidence
        CHECK (
            assessment_confidence IS NULL
            OR assessment_confidence BETWEEN 1 AND 5
        ),

    CONSTRAINT uq_physical_pet
        UNIQUE (pet_id),

    CONSTRAINT fk_physical_pet
        FOREIGN KEY (pet_id)
        REFERENCES pets(id)
        ON DELETE CASCADE
);


-- =========================================================
-- SECTION 3
-- PET PERSONALITY PROFILE
-- All *_level fields: 1 = very low, 5 = very high
-- =========================================================

CREATE TABLE IF NOT EXISTS pet_personality_profiles (

    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    pet_id INT NOT NULL,

    affection_level TINYINT UNSIGNED NULL,
    independence_level TINYINT UNSIGNED NULL,
    playfulness_level TINYINT UNSIGNED NULL,
    energy_level TINYINT UNSIGNED NULL,
    curiosity_level TINYINT UNSIGNED NULL,

    confidence_level TINYINT UNSIGNED NULL,
    sensitivity_level TINYINT UNSIGNED NULL,
    adaptability_level TINYINT UNSIGNED NULL,

    friendliness_level TINYINT UNSIGNED NULL,
    calmness_level TINYINT UNSIGNED NULL,

    intelligence_level TINYINT UNSIGNED NULL,
    trainability_level TINYINT UNSIGNED NULL,

    assessment_source ENUM(
        'staff',
        'shelter',
        'previous_owner',
        'veterinarian',
        'unknown'
    ) NOT NULL DEFAULT 'unknown',

    assessment_confidence TINYINT UNSIGNED NULL,

    assessed_at DATETIME NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT chk_personality_affection
        CHECK (affection_level IS NULL OR affection_level BETWEEN 1 AND 5),

    CONSTRAINT chk_personality_independence
        CHECK (independence_level IS NULL OR independence_level BETWEEN 1 AND 5),

    CONSTRAINT chk_personality_playfulness
        CHECK (playfulness_level IS NULL OR playfulness_level BETWEEN 1 AND 5),

    CONSTRAINT chk_personality_energy
        CHECK (energy_level IS NULL OR energy_level BETWEEN 1 AND 5),

    CONSTRAINT chk_personality_curiosity
        CHECK (curiosity_level IS NULL OR curiosity_level BETWEEN 1 AND 5),

    CONSTRAINT chk_personality_confidence
        CHECK (confidence_level IS NULL OR confidence_level BETWEEN 1 AND 5),

    CONSTRAINT chk_personality_sensitivity
        CHECK (sensitivity_level IS NULL OR sensitivity_level BETWEEN 1 AND 5),

    CONSTRAINT chk_personality_adaptability
        CHECK (adaptability_level IS NULL OR adaptability_level BETWEEN 1 AND 5),

    CONSTRAINT chk_personality_friendliness
        CHECK (friendliness_level IS NULL OR friendliness_level BETWEEN 1 AND 5),

    CONSTRAINT chk_personality_calmness
        CHECK (calmness_level IS NULL OR calmness_level BETWEEN 1 AND 5),

    CONSTRAINT chk_personality_intelligence
        CHECK (intelligence_level IS NULL OR intelligence_level BETWEEN 1 AND 5),

    CONSTRAINT chk_personality_trainability
        CHECK (trainability_level IS NULL OR trainability_level BETWEEN 1 AND 5),

    CONSTRAINT chk_personality_confidence_score
        CHECK (
            assessment_confidence IS NULL
            OR assessment_confidence BETWEEN 1 AND 5
        ),

    CONSTRAINT uq_personality_pet
        UNIQUE (pet_id),

    CONSTRAINT fk_personality_pet
        FOREIGN KEY (pet_id)
        REFERENCES pets(id)
        ON DELETE CASCADE
);


-- =========================================================
-- SECTION 4
-- PET BEHAVIOR PROFILE
-- =========================================================

CREATE TABLE IF NOT EXISTS pet_behavior_profiles (

    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    pet_id INT NOT NULL,

    barking_level TINYINT UNSIGNED NULL,
    vocalization_level TINYINT UNSIGNED NULL,

    destructive_behavior_level TINYINT UNSIGNED NULL,
    separation_anxiety_level TINYINT UNSIGNED NULL,

    aggression_level TINYINT UNSIGNED NULL,
    prey_drive_level TINYINT UNSIGNED NULL,
    escape_tendency_level TINYINT UNSIGNED NULL,

    leash_behavior_level TINYINT UNSIGNED NULL,
    toilet_training_level TINYINT UNSIGNED NULL,
    obedience_level TINYINT UNSIGNED NULL,

    chewing_level TINYINT UNSIGNED NULL,
    digging_level TINYINT UNSIGNED NULL,
    jumping_level TINYINT UNSIGNED NULL,

    assessment_source ENUM(
        'staff',
        'shelter',
        'previous_owner',
        'veterinarian',
        'unknown'
    ) NOT NULL DEFAULT 'unknown',

    assessment_confidence TINYINT UNSIGNED NULL,

    assessed_at DATETIME NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT chk_behavior_barking
        CHECK (barking_level IS NULL OR barking_level BETWEEN 1 AND 5),

    CONSTRAINT chk_behavior_vocalization
        CHECK (vocalization_level IS NULL OR vocalization_level BETWEEN 1 AND 5),

    CONSTRAINT chk_behavior_destructive
        CHECK (
            destructive_behavior_level IS NULL
            OR destructive_behavior_level BETWEEN 1 AND 5
        ),

    CONSTRAINT chk_behavior_separation_anxiety
        CHECK (
            separation_anxiety_level IS NULL
            OR separation_anxiety_level BETWEEN 1 AND 5
        ),

    CONSTRAINT chk_behavior_aggression
        CHECK (
            aggression_level IS NULL
            OR aggression_level BETWEEN 1 AND 5
        ),

    CONSTRAINT chk_behavior_prey_drive
        CHECK (
            prey_drive_level IS NULL
            OR prey_drive_level BETWEEN 1 AND 5
        ),

    CONSTRAINT chk_behavior_escape
        CHECK (
            escape_tendency_level IS NULL
            OR escape_tendency_level BETWEEN 1 AND 5
        ),

    CONSTRAINT chk_behavior_leash
        CHECK (
            leash_behavior_level IS NULL
            OR leash_behavior_level BETWEEN 1 AND 5
        ),

    CONSTRAINT chk_behavior_toilet
        CHECK (
            toilet_training_level IS NULL
            OR toilet_training_level BETWEEN 1 AND 5
        ),

    CONSTRAINT chk_behavior_obedience
        CHECK (
            obedience_level IS NULL
            OR obedience_level BETWEEN 1 AND 5
        ),

    CONSTRAINT chk_behavior_chewing
        CHECK (
            chewing_level IS NULL
            OR chewing_level BETWEEN 1 AND 5
        ),

    CONSTRAINT chk_behavior_digging
        CHECK (
            digging_level IS NULL
            OR digging_level BETWEEN 1 AND 5
        ),

    CONSTRAINT chk_behavior_jumping
        CHECK (
            jumping_level IS NULL
            OR jumping_level BETWEEN 1 AND 5
        ),

    CONSTRAINT chk_behavior_assessment_confidence
        CHECK (
            assessment_confidence IS NULL
            OR assessment_confidence BETWEEN 1 AND 5
        ),

    CONSTRAINT uq_behavior_pet
        UNIQUE (pet_id),

    CONSTRAINT fk_behavior_pet
        FOREIGN KEY (pet_id)
        REFERENCES pets(id)
        ON DELETE CASCADE
);


-- =========================================================
-- SECTION 5
-- PET SOCIAL PROFILE
-- =========================================================

CREATE TABLE IF NOT EXISTS pet_social_profiles (

    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    pet_id INT NOT NULL,

    good_with_children BOOLEAN NULL,
    good_with_dogs BOOLEAN NULL,
    good_with_cats BOOLEAN NULL,
    good_with_other_pets BOOLEAN NULL,
    good_with_strangers BOOLEAN NULL,

    socialization_level TINYINT UNSIGNED NULL,

    stranger_friendliness_level TINYINT UNSIGNED NULL,
    dog_friendliness_level TINYINT UNSIGNED NULL,
    cat_friendliness_level TINYINT UNSIGNED NULL,
    child_friendliness_level TINYINT UNSIGNED NULL,

    prefers_company BOOLEAN NULL,
    can_be_left_alone BOOLEAN NULL,

    assessment_source ENUM(
        'staff',
        'shelter',
        'previous_owner',
        'veterinarian',
        'unknown'
    ) NOT NULL DEFAULT 'unknown',

    assessment_confidence TINYINT UNSIGNED NULL,

    assessed_at DATETIME NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT chk_social_socialization
        CHECK (
            socialization_level IS NULL
            OR socialization_level BETWEEN 1 AND 5
        ),

    CONSTRAINT chk_social_stranger
        CHECK (
            stranger_friendliness_level IS NULL
            OR stranger_friendliness_level BETWEEN 1 AND 5
        ),

    CONSTRAINT chk_social_dog
        CHECK (
            dog_friendliness_level IS NULL
            OR dog_friendliness_level BETWEEN 1 AND 5
        ),

    CONSTRAINT chk_social_cat
        CHECK (
            cat_friendliness_level IS NULL
            OR cat_friendliness_level BETWEEN 1 AND 5
        ),

    CONSTRAINT chk_social_child
        CHECK (
            child_friendliness_level IS NULL
            OR child_friendliness_level BETWEEN 1 AND 5
        ),

    CONSTRAINT chk_social_assessment_confidence
        CHECK (
            assessment_confidence IS NULL
            OR assessment_confidence BETWEEN 1 AND 5
        ),

    CONSTRAINT uq_social_pet
        UNIQUE (pet_id),

    CONSTRAINT fk_social_pet
        FOREIGN KEY (pet_id)
        REFERENCES pets(id)
        ON DELETE CASCADE
);


-- =========================================================
-- SECTION 6
-- PET HEALTH PROFILE
-- =========================================================

CREATE TABLE IF NOT EXISTS pet_health_profiles (

    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    pet_id INT NOT NULL,

    vaccination_status ENUM(
        'unknown',
        'not_vaccinated',
        'partial',
        'up_to_date'
    ) NOT NULL DEFAULT 'unknown',

    neutered_status BOOLEAN NULL,

    microchip_status BOOLEAN NULL,

    health_status ENUM(
        'unknown',
        'healthy',
        'minor_condition',
        'ongoing_treatment',
        'special_care'
    ) NOT NULL DEFAULT 'unknown',

    has_special_needs BOOLEAN NOT NULL DEFAULT FALSE,

    special_needs_description TEXT NULL,

    has_chronic_condition BOOLEAN NOT NULL DEFAULT FALSE,

    chronic_condition_description TEXT NULL,

    medication_required BOOLEAN NOT NULL DEFAULT FALSE,

    medication_description TEXT NULL,

    mobility_level TINYINT UNSIGNED NULL,

    assessment_source ENUM(
        'staff',
        'shelter',
        'previous_owner',
        'veterinarian',
        'unknown'
    ) NOT NULL DEFAULT 'unknown',

    assessment_confidence TINYINT UNSIGNED NULL,

    assessed_at DATETIME NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT chk_health_mobility
        CHECK (
            mobility_level IS NULL
            OR mobility_level BETWEEN 1 AND 5
        ),

    CONSTRAINT chk_health_assessment_confidence
        CHECK (
            assessment_confidence IS NULL
            OR assessment_confidence BETWEEN 1 AND 5
        ),

    CONSTRAINT uq_health_pet
        UNIQUE (pet_id),

    CONSTRAINT fk_health_pet
        FOREIGN KEY (pet_id)
        REFERENCES pets(id)
        ON DELETE CASCADE
);


-- =========================================================
-- SECTION 7
-- PET CARE PROFILE
-- =========================================================

CREATE TABLE IF NOT EXISTS pet_care_profiles (

    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    pet_id INT NOT NULL,

    grooming_requirement TINYINT UNSIGNED NULL,
    exercise_requirement TINYINT UNSIGNED NULL,
    training_requirement TINYINT UNSIGNED NULL,
    attention_requirement TINYINT UNSIGNED NULL,

    feeding_complexity TINYINT UNSIGNED NULL,
    medical_care_requirement TINYINT UNSIGNED NULL,

    maintenance_level TINYINT UNSIGNED NULL,

    estimated_monthly_cost_level TINYINT UNSIGNED NULL,

    experienced_owner_required BOOLEAN NULL,

    first_time_owner_suitable BOOLEAN NULL,

    minimum_daily_exercise_minutes INT UNSIGNED NULL,

    assessment_source ENUM(
        'staff',
        'shelter',
        'previous_owner',
        'veterinarian',
        'unknown'
    ) NOT NULL DEFAULT 'unknown',

    assessment_confidence TINYINT UNSIGNED NULL,

    assessed_at DATETIME NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT chk_care_grooming
        CHECK (
            grooming_requirement IS NULL
            OR grooming_requirement BETWEEN 1 AND 5
        ),

    CONSTRAINT chk_care_exercise
        CHECK (
            exercise_requirement IS NULL
            OR exercise_requirement BETWEEN 1 AND 5
        ),

    CONSTRAINT chk_care_training
        CHECK (
            training_requirement IS NULL
            OR training_requirement BETWEEN 1 AND 5
        ),

    CONSTRAINT chk_care_attention
        CHECK (
            attention_requirement IS NULL
            OR attention_requirement BETWEEN 1 AND 5
        ),

    CONSTRAINT chk_care_feeding
        CHECK (
            feeding_complexity IS NULL
            OR feeding_complexity BETWEEN 1 AND 5
        ),

    CONSTRAINT chk_care_medical
        CHECK (
            medical_care_requirement IS NULL
            OR medical_care_requirement BETWEEN 1 AND 5
        ),

    CONSTRAINT chk_care_maintenance
        CHECK (
            maintenance_level IS NULL
            OR maintenance_level BETWEEN 1 AND 5
        ),

    CONSTRAINT chk_care_cost
        CHECK (
            estimated_monthly_cost_level IS NULL
            OR estimated_monthly_cost_level BETWEEN 1 AND 5
        ),

    CONSTRAINT chk_care_assessment_confidence
        CHECK (
            assessment_confidence IS NULL
            OR assessment_confidence BETWEEN 1 AND 5
        ),

    CONSTRAINT uq_care_pet
        UNIQUE (pet_id),

    CONSTRAINT fk_care_pet
        FOREIGN KEY (pet_id)
        REFERENCES pets(id)
        ON DELETE CASCADE
);


-- =========================================================
-- SECTION 8
-- PET ENVIRONMENT PROFILE
-- =========================================================

CREATE TABLE IF NOT EXISTS pet_environment_profiles (

    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    pet_id INT NOT NULL,

    suitable_for_apartment BOOLEAN NULL,

    requires_yard BOOLEAN NULL,

    minimum_space_level TINYINT UNSIGNED NULL,

    noise_tolerance_level TINYINT UNSIGNED NULL,

    heat_tolerance_level TINYINT UNSIGNED NULL,

    cold_tolerance_level TINYINT UNSIGNED NULL,

    indoor_preference TINYINT UNSIGNED NULL,

    outdoor_activity_requirement TINYINT UNSIGNED NULL,

    assessment_source ENUM(
        'staff',
        'shelter',
        'previous_owner',
        'veterinarian',
        'unknown'
    ) NOT NULL DEFAULT 'unknown',

    assessment_confidence TINYINT UNSIGNED NULL,

    assessed_at DATETIME NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT chk_environment_space
        CHECK (
            minimum_space_level IS NULL
            OR minimum_space_level BETWEEN 1 AND 5
        ),

    CONSTRAINT chk_environment_noise
        CHECK (
            noise_tolerance_level IS NULL
            OR noise_tolerance_level BETWEEN 1 AND 5
        ),

    CONSTRAINT chk_environment_heat
        CHECK (
            heat_tolerance_level IS NULL
            OR heat_tolerance_level BETWEEN 1 AND 5
        ),

    CONSTRAINT chk_environment_cold
        CHECK (
            cold_tolerance_level IS NULL
            OR cold_tolerance_level BETWEEN 1 AND 5
        ),

    CONSTRAINT chk_environment_indoor
        CHECK (
            indoor_preference IS NULL
            OR indoor_preference BETWEEN 1 AND 5
        ),

    CONSTRAINT chk_environment_outdoor
        CHECK (
            outdoor_activity_requirement IS NULL
            OR outdoor_activity_requirement BETWEEN 1 AND 5
        ),

    CONSTRAINT chk_environment_assessment_confidence
        CHECK (
            assessment_confidence IS NULL
            OR assessment_confidence BETWEEN 1 AND 5
        ),

    CONSTRAINT uq_environment_pet
        UNIQUE (pet_id),

    CONSTRAINT fk_environment_pet
        FOREIGN KEY (pet_id)
        REFERENCES pets(id)
        ON DELETE CASCADE
);


-- =========================================================
-- SECTION 9
-- INDEXES
-- =========================================================

CREATE INDEX idx_pets_pet_type
ON pets(pet_type);

CREATE INDEX idx_pets_breed
ON pets(breed);

CREATE INDEX idx_pets_adoption_status
ON pets(adoption_status);

CREATE INDEX idx_pets_availability_status
ON pets(availability_status);


-- =========================================================
-- SECTION 10
-- MIGRATE LEGACY DATA
-- =========================================================

-- Move legacy color into physical profile

INSERT INTO pet_physical_profiles (
    pet_id,
    primary_color
)
SELECT
    id,
    color
FROM pets
WHERE color IS NOT NULL
ON DUPLICATE KEY UPDATE
    primary_color = VALUES(primary_color);


-- Try to migrate legacy weight such as:
-- "10"
-- "10kg"
-- "10 kg"
--
-- Invalid values will remain NULL.

INSERT INTO pet_physical_profiles (
    pet_id,
    weight_kg
)
SELECT
    id,
    CAST(
        REGEXP_REPLACE(
            LOWER(weight),
            '[^0-9.]',
            ''
        )
        AS DECIMAL(6,2)
    )
FROM pets
WHERE weight IS NOT NULL
  AND REGEXP_REPLACE(
        LOWER(weight),
        '[^0-9.]',
        ''
      ) <> ''
ON DUPLICATE KEY UPDATE
    weight_kg = VALUES(weight_kg);


-- Migrate vaccination data conservatively.
-- Only exact/recognizable values are mapped.

INSERT INTO pet_health_profiles (
    pet_id,
    vaccination_status
)
SELECT
    id,
    CASE
        WHEN LOWER(vaccination) IN (
            'yes',
            'vaccinated',
            'up_to_date',
            'complete'
        )
        THEN 'up_to_date'

        WHEN LOWER(vaccination) IN (
            'partial',
            'partially vaccinated'
        )
        THEN 'partial'

        WHEN LOWER(vaccination) IN (
            'no',
            'not vaccinated'
        )
        THEN 'not_vaccinated'

        ELSE 'unknown'
    END
FROM pets
WHERE vaccination IS NOT NULL
ON DUPLICATE KEY UPDATE
    vaccination_status = VALUES(vaccination_status);


-- =========================================================
-- END
-- =========================================================