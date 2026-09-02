require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { pool } = require("../config/db");

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS user_pets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    species VARCHAR(50) DEFAULT 'cat',
    breed VARCHAR(255) NULL,
    gender VARCHAR(20) NULL,
    birth_date DATE NULL,
    color VARCHAR(100) NULL,
    weight DECIMAL(5,2) NULL,
    vaccinated TINYINT(1) DEFAULT 0,
    description TEXT NULL,
    traits JSON NULL,
    image_url TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_pets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_pets_user (user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS user_pet_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_pet_id INT NOT NULL,
    image_path VARCHAR(500) NOT NULL,
    display_order INT DEFAULT 0,
    cloudinary_id VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_pet_images_pet FOREIGN KEY (user_pet_id) REFERENCES user_pets(id) ON DELETE CASCADE,
    INDEX idx_user_pet_images_display (user_pet_id, display_order)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

(async () => {
  console.log("🚀 Bắt đầu migration user_pets & user_pet_images...\n");
  let ok = 0;
  let failed = 0;

  for (const stmt of STATEMENTS) {
    const preview = stmt.trim().slice(0, 60).replace(/\s+/g, " ");
    try {
      await pool.execute(stmt);
      console.log(`✅ OK: ${preview}...`);
      ok++;
    } catch (err) {
      if (
        err.code === "ER_TABLE_EXISTS_ERROR" ||
        err.code === "ER_DUP_KEYNAME" ||
        (err.message && err.message.toLowerCase().includes("already exists"))
      ) {
        console.log(`⏭️  Skip (đã tồn tại): ${preview}...`);
        ok++;
      } else {
        console.error(`❌ Lỗi: ${err.message}`);
        failed++;
      }
    }
  }

  console.log(`\n📊 Kết quả: ${ok} thành công, ${failed} lỗi`);
  process.exit(failed > 0 ? 1 : 0);
})();
