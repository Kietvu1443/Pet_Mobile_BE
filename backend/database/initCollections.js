require("dotenv").config();
const { pool } = require("../config/db");

async function initCollectionTables() {
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS pet_collections (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        emoji VARCHAR(10) DEFAULT '📁',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS pet_collection_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        collection_id INT NOT NULL,
        pet_id INT NOT NULL,
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (collection_id) REFERENCES pet_collections(id) ON DELETE CASCADE,
        FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE,
        UNIQUE KEY uk_collection_pet (collection_id, pet_id)
      );
    `);

    console.log("✅ pet_collections and pet_collection_items tables initialized successfully!");
  } catch (error) {
    console.error("❌ Error initializing collection tables:", error);
  }
}

initCollectionTables().then(() => process.exit(0));
