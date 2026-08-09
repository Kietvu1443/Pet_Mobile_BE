require("dotenv").config();
const { pool } = require("../config/db");

async function initSuperlike() {
  let connection;
  let hasError = false;
  try {
    connection = await pool.getConnection();
    console.log("Connecting to MySQL database to run Superlike migration...");

    // 1. Alter ENUM of status column
    await connection.query(`
      ALTER TABLE pet_likes
      MODIFY COLUMN status ENUM('liked', 'passed', 'superliked') NOT NULL DEFAULT 'liked';
    `);
    console.log("✓ Updated pet_likes.status ENUM to ('liked', 'passed', 'superliked')");

    // 2. Add Index if not exists
    try {
      await connection.query(`
        CREATE INDEX idx_pet_likes_status ON pet_likes(status);
      `);
      console.log("✓ Created index idx_pet_likes_status on pet_likes(status)");
    } catch (err) {
      if (err.code === 'ER_DUP_KEYNAME') {
        console.log("ℹ Index idx_pet_likes_status already exists.");
      } else {
        throw err;
      }
    }

    console.log("🎉 Superlike migration completed successfully!");
  } catch (error) {
    console.error("❌ Superlike migration failed:", error);
    hasError = true;
  } finally {
    if (connection) connection.release();
    process.exit(hasError ? 1 : 0);
  }
}

initSuperlike();
