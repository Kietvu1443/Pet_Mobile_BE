const path = require("path");
const fs = require("fs");
const dotenv = require("../node_modules/dotenv");

// Load .env
dotenv.config({ path: path.join(__dirname, "../.env") });

const { pool } = require("../config/db");

async function runPlacesMigration() {
  console.log("🚀 Bắt đầu migration bảng places, place_reviews, moderation_reports...");

  const sqlPath = path.join(__dirname, "migrations", "places_migration.sql");
  const sqlContent = fs.readFileSync(sqlPath, "utf8");

  // Loại bỏ comments trước
  const cleanSql = sqlContent
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

  const statements = cleanSql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  let successCount = 0;
  for (const statement of statements) {
    try {
      await pool.query(statement);
      successCount++;
    } catch (error) {
      console.error("❌ Lỗi khi thực thi statement:", statement.substring(0, 80) + "...");
      console.error("Chi tiết lỗi:", error.message);
      throw error;
    }
  }

  console.log(`✅ Migration hoàn tất thành công! (${successCount} statements executed)`);
  process.exit(0);
}

runPlacesMigration().catch((err) => {
  console.error("❌ Migration thất bại:", err);
  process.exit(1);
});
