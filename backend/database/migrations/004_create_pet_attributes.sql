CREATE TABLE IF NOT EXISTS pet_attributes (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    pet_id INT NOT NULL,

    attribute_key VARCHAR(100) NOT NULL,
    attribute_value VARCHAR(100) NOT NULL,

    source ENUM(
        'owner_form',
        'admin',
        'image_analysis',
        'video_analysis',
        'manual_review'
    ) NOT NULL DEFAULT 'owner_form',

    confidence DECIMAL(5,2) NULL,

    is_active TINYINT(1) NOT NULL DEFAULT 1,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_pet_attributes_pet
        FOREIGN KEY (pet_id)
        REFERENCES pets(id)
        ON DELETE CASCADE,

    CONSTRAINT uq_pet_attribute
        UNIQUE (pet_id, attribute_key, attribute_value),

    INDEX idx_pet_attributes_pet_id (pet_id),
    INDEX idx_pet_attributes_key_value (
        attribute_key,
        attribute_value
    )
);