-- =======================================================================
-- Migration: Create user_pets and user_pet_images
-- Mô tả: Tách biệt thú cưng cá nhân của người dùng khỏi bảng pets nhận nuôi
-- =======================================================================

CREATE TABLE IF NOT EXISTS user_pets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    species VARCHAR(50) DEFAULT 'cat',          -- 'cat', 'dog', 'other'
    breed VARCHAR(255) NULL,
    gender VARCHAR(20) NULL,                   -- 'male', 'female' (Đực, Cái)
    birth_date DATE NULL,                      -- Ngày sinh chuẩn (dùng tính tuổi động)
    color VARCHAR(100) NULL,
    weight DECIMAL(5,2) NULL,                  -- Cân nặng (kg), chuẩn số thập phân
    vaccinated TINYINT(1) DEFAULT 0,           -- 0: chưa tiêm, 1: đã tiêm
    description TEXT NULL,
    traits JSON NULL,                          -- Mảng JSON tính cách: ["Hiền lành", "Quấn người"]
    image_url TEXT NULL,                       -- URL ảnh đại diện (cache từ display_order = 0)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_pets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_pets_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_pet_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_pet_id INT NOT NULL,
    image_path VARCHAR(500) NOT NULL,
    display_order INT DEFAULT 0,               -- 0: ảnh đại diện, 1+: ảnh thư viện
    cloudinary_id VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_pet_images_pet FOREIGN KEY (user_pet_id) REFERENCES user_pets(id) ON DELETE CASCADE,
    INDEX idx_user_pet_images_display (user_pet_id, display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
