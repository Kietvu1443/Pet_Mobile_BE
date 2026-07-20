/**
 * Migration script: Add verify column + email_verifications table
 * Run: node scripts/migrate_otp.js
 */
require("dotenv").config();
const { pool } = require("../config/db");

async function migrate() {
  try {
    console.log("🔄 Running OTP migration...");

    // 1. Add verify column to users (ignore if already exists)
    try {
      await pool.execute(
        "ALTER TABLE users ADD COLUMN verify TINYINT DEFAULT 0 COMMENT '0: chưa xác thực, 1: đã xác thực email'"
      );
      console.log("✅ Added 'verify' column to users table");
    } catch (err) {
      if (err.code === "ER_DUP_FIELDNAME") {
        console.log("ℹ️  'verify' column already exists, skipping.");
      } else {
        throw err;
      }
    }

    // 2. Create email_verifications table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS email_verifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        otp VARCHAR(6) NOT NULL,
        attempts INT DEFAULT 0,
        expires_at DATETIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX(user_id)
      )
    `);
    console.log("✅ Created email_verifications table");

    console.log("🎉 Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

migrate();
