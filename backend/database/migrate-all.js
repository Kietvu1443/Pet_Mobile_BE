/**
 * migrate-all.js — Chạy tuần tự tất cả database migrations.
 *
 * Được gọi trong deploy pipeline (deploy.yml) sau `npm ci`, trước `pm2 restart`.
 * Mỗi migration script con tự xử lý idempotency (CREATE IF NOT EXISTS / skip duplicate)
 * và tự exit với mã lỗi chuẩn (0 = OK, 1 = fail).
 *
 * Cách dùng:
 *   node database/migrate-all.js
 */
require("dotenv").config();
const { execFileSync } = require("child_process");
const path = require("path");

const DB_DIR = __dirname;

// Thứ tự quan trọng: run-migration.js tạo các bảng nền tảng trước,
// rồi đến các init/migration module chuyên biệt.
const MIGRATIONS = [
  { file: "run-migration.js", desc: "Schema nền tảng (users, shelters, notifications...)" },
  { file: "initCollections.js", desc: "Bảng pet_collections & pet_collection_items" },
  { file: "initNotes.js", desc: "Bảng pet_notes" },
  { file: "initSuperlike.js", desc: "Mở rộng ENUM pet_likes (superliked) + index" },
  { file: "user_pets_migration.js", desc: "Bảng user_pets & user_pet_images" },
  { file: "places_migration.js", desc: "Bảng places, place_reviews, moderation_reports" },
];

(async () => {
  console.log("🚀 Bắt đầu chạy toàn bộ migrations...\n");
  let ok = 0;
  let failed = 0;

  for (const m of MIGRATIONS) {
    const scriptPath = path.join(DB_DIR, m.file);
    console.log(`\n━━━ [${m.file}] — ${m.desc} ━━━`);
    try {
      execFileSync(process.execPath, [scriptPath], {
        stdio: "inherit",
        cwd: path.join(DB_DIR, ".."),
      });
      console.log(`✅ ${m.file} thành công`);
      ok++;
    } catch (err) {
      console.error(`❌ ${m.file} thất bại (exit code ${err.status})`);
      failed++;
      // Dừng ngay — không chạy tiếp để tránh cascade lỗi
      break;
    }
  }

  console.log(`\n📊 Kết quả: ${ok} thành công, ${failed} lỗi`);
  process.exit(failed > 0 ? 1 : 0);
})();
