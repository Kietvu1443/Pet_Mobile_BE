/**
 * run-migration.js (v2) - Chạy từng statement một, đơn giản và debug rõ hơn
 */
require("dotenv").config();
const { pool } = require("../config/db");

const STATEMENTS = [
  // 1. Cho phép password nullable
  `ALTER TABLE users MODIFY COLUMN password VARCHAR(255) NULL`,

  // 2. Tạo bảng user_connections
  `CREATE TABLE IF NOT EXISTS user_connections (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    user_id       INT NOT NULL,
    provider      VARCHAR(50) NOT NULL,
    provider_id   VARCHAR(255) NOT NULL,
    linked_email  VARCHAR(255) DEFAULT NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_conn_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_provider (user_id, provider),
    UNIQUE KEY unique_provider_id (provider, provider_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // 3. Tạo bảng user_passkeys
  `CREATE TABLE IF NOT EXISTS user_passkeys (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    credential_id   VARCHAR(511) NOT NULL,
    public_key      TEXT NOT NULL,
    counter         BIGINT DEFAULT 0,
    device_type     VARCHAR(100) DEFAULT NULL,
    backed_up       TINYINT(1) DEFAULT 0,
    transports      VARCHAR(255) DEFAULT NULL,
    label           VARCHAR(100) DEFAULT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_passkey_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_credential_id (credential_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // 4. Tạo bảng pet_returns (hồ sơ trả thú cưng)
  `CREATE TABLE IF NOT EXISTS pet_returns (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    user_id             INT NOT NULL,
    pet_id              INT NOT NULL,
    adoption_request_id INT NOT NULL,
    reason_category     VARCHAR(50)  NOT NULL,
    reason_detail       TEXT         NOT NULL,
    pet_name_snapshot   VARCHAR(255) NOT NULL,
    pet_image_snapshot  TEXT         NULL,
    status              VARCHAR(20)  NOT NULL DEFAULT 'pending',
    admin_notes         TEXT         NULL,
    reviewed_by         INT          NULL,
    reviewed_at         DATETIME     NULL,
    created_at          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_pr_user   FOREIGN KEY (user_id)             REFERENCES users(id)             ON DELETE CASCADE,
    CONSTRAINT fk_pr_pet    FOREIGN KEY (pet_id)              REFERENCES pets(id)              ON DELETE CASCADE,
    CONSTRAINT fk_pr_adopt  FOREIGN KEY (adoption_request_id) REFERENCES adoption_requests(id) ON DELETE CASCADE,
    CONSTRAINT fk_pr_staff  FOREIGN KEY (reviewed_by)         REFERENCES users(id)             ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // 5. Tạo bảng pet_return_images (ảnh minh chứng thực tế)
  `CREATE TABLE IF NOT EXISTS pet_return_images (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    pet_return_id   INT          NOT NULL,
    image_path      VARCHAR(500) NOT NULL,
    cloudinary_id   VARCHAR(255) NULL,
    created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pri_return FOREIGN KEY (pet_return_id) REFERENCES pet_returns(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // 6. Tạo bảng notifications (hệ thống thông báo)
  `CREATE TABLE IF NOT EXISTS notifications (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT          NOT NULL,
    title       VARCHAR(255) NOT NULL,
    message     TEXT         NOT NULL,
    type        VARCHAR(50)  DEFAULT 'system',
    is_read     TINYINT      DEFAULT 0,
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_noti_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // 7. Mở rộng bảng users: gender và phone
  `ALTER TABLE users ADD COLUMN gender VARCHAR(20) NULL AFTER birthday`,
  `ALTER TABLE users ADD COLUMN phone VARCHAR(20) NULL AFTER gender`,

  // 8. Mở rộng bảng users: preferences JSON
  `ALTER TABLE users ADD COLUMN preferences JSON NULL AFTER address`,

  // 9. Bảng housing_reviews (phiên bản có history)
  `CREATE TABLE IF NOT EXISTS housing_reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    house_type VARCHAR(50) NOT NULL,
    own_or_rent VARCHAR(20) NOT NULL,
    has_allergies TINYINT(1) DEFAULT 0,
    has_pets TINYINT(1) DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    is_active TINYINT(1) DEFAULT 1,
    admin_notes TEXT NULL,
    reviewed_by INT NULL,
    reviewed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_hr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_hr_admin FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_hr_user_active (user_id, is_active),
    INDEX idx_hr_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // 10. Mở rộng housing_reviews: Premium UI fields
  `ALTER TABLE housing_reviews ADD COLUMN outdoor_space VARCHAR(20) NULL AFTER has_pets`,
  `ALTER TABLE housing_reviews ADD COLUMN has_children TINYINT(1) DEFAULT 0 AFTER has_pets`,
  `ALTER TABLE housing_reviews ADD COLUMN time_at_home VARCHAR(20) NULL AFTER has_children`,
  `ALTER TABLE housing_reviews ADD COLUMN experience VARCHAR(20) NULL AFTER time_at_home`,
  `ALTER TABLE housing_reviews ADD COLUMN income VARCHAR(20) NULL AFTER experience`,
  `ALTER TABLE housing_reviews ADD COLUMN when_away JSON NULL AFTER income`,

  // 11. Bảng housing_review_photos
  `CREATE TABLE IF NOT EXISTS housing_review_photos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    review_id INT NOT NULL,
    image_path VARCHAR(500) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_hrp_review FOREIGN KEY (review_id) REFERENCES housing_reviews(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // 12. Bảng shelters
  `CREATE TABLE IF NOT EXISTS shelters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    address TEXT NOT NULL,
    phone VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    admin_notes TEXT NULL,
    reviewed_by INT NULL,
    reviewed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_shelter_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_shelter_admin FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_user_shelter (user_id),
    INDEX idx_shelter_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // 13. Bảng shelter_photos
  `CREATE TABLE IF NOT EXISTS shelter_photos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    shelter_id INT NOT NULL,
    image_path VARCHAR(500) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sp_shelter FOREIGN KEY (shelter_id) REFERENCES shelters(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // 14. Bảng shelter_documents
  `CREATE TABLE IF NOT EXISTS shelter_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    shelter_id INT NOT NULL,
    document_path VARCHAR(500) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sd_shelter FOREIGN KEY (shelter_id) REFERENCES shelters(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // 15. Bảng user_devices (push tokens)
  `CREATE TABLE IF NOT EXISTS user_devices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    push_token VARCHAR(255) NOT NULL,
    device_platform VARCHAR(50) NOT NULL,
    last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_ud_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_device_token (push_token),
    INDEX idx_user_devices (user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // 16. Bảng pet_scans (analytics)
  `CREATE TABLE IF NOT EXISTS pet_scans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    pet_id INT NOT NULL,
    scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    referrer VARCHAR(50) NOT NULL DEFAULT 'collar_qr',
    device_platform VARCHAR(50) NULL,
    scan_location_lat DECIMAL(9,6) NULL,
    scan_location_lng DECIMAL(9,6) NULL,
    CONSTRAINT fk_scans_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_scans_pet FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE,
    INDEX idx_pet_scanned (pet_id, scanned_at),
    INDEX idx_user_scanned (user_id, scanned_at),
    INDEX idx_scans_date (scanned_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

(async () => {
  console.log("🚀 Chạy migration...\n");
  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const stmt of STATEMENTS) {
    const preview = stmt.trim().slice(0, 70).replace(/\s+/g, " ");
    try {
      await pool.execute(stmt);
      console.log(`✅ OK: ${preview}...`);
      ok++;
    } catch (err) {
      if (
        err.code === "ER_DUP_KEYNAME" ||
        err.code === "ER_TABLE_EXISTS_ERROR" ||
        (err.message && err.message.toLowerCase().includes("duplicate"))
      ) {
        console.log(`⏭️  Skip (đã tồn tại): ${preview}...`);
        skipped++;
      } else {
        console.error(`❌ Lỗi: ${err.message}`);
        console.error(`   SQL: ${preview}`);
        failed++;
      }
    }
  }

  console.log(`\n📊 Kết quả: ${ok} thành công, ${skipped} bỏ qua, ${failed} lỗi`);
  process.exit(failed > 0 ? 1 : 0);
})();
