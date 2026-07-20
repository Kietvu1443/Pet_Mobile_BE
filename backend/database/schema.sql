-- Pet Helper Database Schema
-- Run this file to create the required tables

-- Tạo database nếu chưa có
CREATE DATABASE IF NOT EXISTS pet_helper CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE pet_helper;

-- Bảng của người dùng để phân cấp phân quyền
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    display_name VARCHAR(100) NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role INT DEFAULT 2 COMMENT '0: admin, 1: staff, 2: user',
    verify TINYINT DEFAULT 0 COMMENT '0: chưa xác thực, 1: đã xác thực email',
    birthday DATE NULL,
    address TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Bảng của các bé thú cưng
CREATE TABLE IF NOT EXISTS pets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    pet_type VARCHAR(50),          -- Chó, Mèo, Khác
    breed VARCHAR(255),            -- Giống
    age VARCHAR(50),               -- Nhí, Trẻ, Trưởng thành
    gender VARCHAR(20),            -- Đực, Cái
    color VARCHAR(100),            -- Màu sắc
    weight VARCHAR(20),            -- Cân nặng (kg)
    pet_code VARCHAR(50),          -- Mã HPA (VD: O5184)
    vaccination VARCHAR(50),       -- Tiêm phòng
    description TEXT,              -- Mô tả
    image_url TEXT,                -- Link ảnh
    contact_info TEXT,             -- TNV liên hệ
    source_url VARCHAR(500) UNIQUE,-- URL gốc (unique key)
    status VARCHAR(20) DEFAULT 'available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Bảng khi thích các bé thú cưng
CREATE TABLE IF NOT EXISTS pet_likes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    pet_id INT NOT NULL,
    status ENUM('liked', 'passed') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE,
    UNIQUE KEY unique_interaction (user_id, pet_id)
);

-- Bảng lưu ảnh thú cưng (quản lý thứ tự và logic hiển thị)
CREATE TABLE IF NOT EXISTS pet_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pet_id INT NOT NULL,
    image_path VARCHAR(500) NOT NULL,
    display_order INT DEFAULT 0 COMMENT '0 = ảnh đại diện, 1+ = ảnh gallery',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE,
    INDEX idx_pet_display (pet_id, display_order)
);

-- Bảng lưu OTP xác thực email
CREATE TABLE IF NOT EXISTS email_verifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    otp VARCHAR(6) NOT NULL,
    attempts INT DEFAULT 0,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX(user_id)
);

-- Tài khoản admin mặc định (mật khẩu: admin123)
INSERT INTO users (display_name, name, email, password, role) VALUES
('Admin', 'Administrator', 'admin@pethelper.vn', 'admin123', 0)
ON DUPLICATE KEY UPDATE id=id;
