-- ============================================================
-- Migration: Pet Return Workflow Tables
-- ============================================================
USE pet_helper;

-- 1. Bảng lưu hồ sơ trả thú cưng
CREATE TABLE IF NOT EXISTS pet_returns (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    user_id             INT NOT NULL,
    pet_id              INT NOT NULL,
    adoption_request_id INT NOT NULL,
    reason_category     VARCHAR(50)  NOT NULL COMMENT 'financial|allergy|housing|behavior|medical|other',
    reason_detail       TEXT         NOT NULL,
    -- Snapshot tại thời điểm tạo (bất biến về sau)
    pet_name_snapshot   VARCHAR(255) NOT NULL,
    pet_image_snapshot  TEXT         NULL,
    -- Trạng thái: pending -> approved_online -> completed / rejected / cancelled
    status              VARCHAR(20)  NOT NULL DEFAULT 'pending',
    admin_notes         TEXT         NULL,
    reviewed_by         INT          NULL,
    reviewed_at         DATETIME     NULL,
    created_at          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)             REFERENCES users(id)             ON DELETE CASCADE,
    FOREIGN KEY (pet_id)              REFERENCES pets(id)              ON DELETE CASCADE,
    FOREIGN KEY (adoption_request_id) REFERENCES adoption_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by)         REFERENCES users(id)             ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Bảng lưu ảnh minh chứng thực tế (1-3 ảnh)
CREATE TABLE IF NOT EXISTS pet_return_images (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    pet_return_id   INT          NOT NULL,
    image_path      VARCHAR(500) NOT NULL,
    cloudinary_id   VARCHAR(255) NULL,
    created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pet_return_id) REFERENCES pet_returns(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Bảng lưu thông báo hệ thống (User + Staff)
CREATE TABLE IF NOT EXISTS notifications (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT          NOT NULL,
    title       VARCHAR(255) NOT NULL,
    message     TEXT         NOT NULL,
    type        VARCHAR(50)  DEFAULT 'system' COMMENT 'system|return_workflow',
    is_read     TINYINT      DEFAULT 0,
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_unread (user_id, is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
