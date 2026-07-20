/**
 * Run admin system migration
 * Adds status, banned_reason, banned_at to users table
 * Updates reports status enum to include 'resolved'
 */
const { pool } = require("../config/db");

async function migrate() {
  console.log("Running admin system migration...\n");

  // 1. Add status column to users
  try {
    await pool.execute("ALTER TABLE users ADD COLUMN status ENUM('active', 'banned') DEFAULT 'active'");
    console.log("✅ Added users.status");
  } catch (e) {
    if (e.errno === 1060) console.log("⏭️  users.status already exists");
    else throw e;
  }

  // 2. Add banned_reason column
  try {
    await pool.execute("ALTER TABLE users ADD COLUMN banned_reason VARCHAR(255) NULL");
    console.log("✅ Added users.banned_reason");
  } catch (e) {
    if (e.errno === 1060) console.log("⏭️  users.banned_reason already exists");
    else throw e;
  }

  // 3. Add banned_at column
  try {
    await pool.execute("ALTER TABLE users ADD COLUMN banned_at TIMESTAMP NULL");
    console.log("✅ Added users.banned_at");
  } catch (e) {
    if (e.errno === 1060) console.log("⏭️  users.banned_at already exists");
    else throw e;
  }

  // 4. Update reports status enum
  try {
    await pool.execute("ALTER TABLE reports MODIFY COLUMN status ENUM('pending', 'approved', 'rejected', 'resolved') DEFAULT 'pending'");
    console.log("✅ Updated reports.status enum");
  } catch (e) {
    console.log("⚠️  reports enum update:", e.message);
  }

  // 5. Add indexes
  try {
    await pool.execute("CREATE INDEX idx_users_status ON users (status)");
    console.log("✅ Added index idx_users_status");
  } catch (e) {
    if (e.errno === 1061) console.log("⏭️  idx_users_status already exists");
    else console.log("⚠️  idx_users_status:", e.message);
  }

  try {
    await pool.execute("CREATE INDEX idx_users_role ON users (role)");
    console.log("✅ Added index idx_users_role");
  } catch (e) {
    if (e.errno === 1061) console.log("⏭️  idx_users_role already exists");
    else console.log("⚠️  idx_users_role:", e.message);
  }

  console.log("\n🎉 Migration complete!");
  process.exit(0);
}

migrate().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
