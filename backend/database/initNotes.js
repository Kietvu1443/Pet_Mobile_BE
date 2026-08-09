require("dotenv").config();
const { pool } = require("../config/db");

async function initNotesTable() {
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS pet_notes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        pet_id INT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE,
        UNIQUE KEY uk_user_pet (user_id, pet_id)
      );
    `);
    console.log("✅ pet_notes table initialized successfully!");
  } catch (error) {
    console.error("❌ Error initializing pet_notes table:", error);
  }
}

initNotesTable().then(() => process.exit(0));
