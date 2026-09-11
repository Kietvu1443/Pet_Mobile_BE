-- places_migration.sql
-- Migration tạo bảng địa điểm cộng đồng, đánh giá, và báo cáo vi phạm
-- Thuần DDL (không tự động chèn dữ liệu)

-- 1. Bảng địa điểm cộng đồng (Community Places)
CREATE TABLE IF NOT EXISTS places (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type ENUM('shelter', 'veterinary', 'grooming', 'pet_shop', 'pet_cafe', 'park', 'meetup', 'other') NOT NULL DEFAULT 'other',
    description TEXT NULL,
    address VARCHAR(500) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    phone VARCHAR(50) NULL,
    website VARCHAR(255) NULL,
    image_url VARCHAR(500) NULL,
    rating_avg DECIMAL(3, 2) NOT NULL DEFAULT 0.00,
    review_count INT NOT NULL DEFAULT 0,
    shelter_id INT NULL,
    created_by INT NOT NULL,
    status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    admin_notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_places_coords (latitude, longitude),
    INDEX idx_places_status_type (status, type),
    INDEX idx_places_created_by (created_by),
    FOREIGN KEY (shelter_id) REFERENCES shelters(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Bảng đánh giá địa điểm (Place Reviews)
CREATE TABLE IF NOT EXISTS place_reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    place_id INT NOT NULL,
    user_id INT NOT NULL,
    rating TINYINT UNSIGNED NOT NULL, -- 1 đến 5 sao
    comment TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_place_user_review (place_id, user_id),
    FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Bảng báo cáo vi phạm (Moderation Reports)
CREATE TABLE IF NOT EXISTS moderation_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    reporter_id INT NOT NULL,
    target_type ENUM('place', 'review') NOT NULL,
    target_id INT NOT NULL,
    reason ENUM('spam', 'incorrect_info', 'place_not_exist', 'wrong_location', 'inappropriate', 'other') NOT NULL,
    description TEXT NULL,
    status ENUM('pending', 'resolved', 'dismissed') NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_report_target_user (reporter_id, target_type, target_id),
    FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
