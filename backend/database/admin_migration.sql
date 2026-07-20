-- ====================================================
-- Migration: Admin System - User Ban & Report Status
-- ====================================================

USE pet_helper;

-- 1. Thêm cột status, banned_reason, banned_at vào bảng users
ALTER TABLE users
    ADD COLUMN status ENUM('active', 'banned') DEFAULT 'active',
    ADD COLUMN banned_reason VARCHAR(255) NULL,
    ADD COLUMN banned_at TIMESTAMP NULL;

-- 2. Cập nhật ENUM status của bảng reports (thêm 'resolved')
ALTER TABLE reports
    MODIFY COLUMN status ENUM('pending', 'approved', 'rejected', 'resolved') DEFAULT 'pending';

-- 3. Index cho truy vấn admin (lọc user theo status/role)
CREATE INDEX idx_users_status ON users (status);
CREATE INDEX idx_users_role ON users (role);
