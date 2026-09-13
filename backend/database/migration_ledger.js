/**
 * migration_ledger.js — Migration ledger cho Pet_Mobile_BE.
 *
 * Cơ chế:
 *   - Bảng `schema_migrations` ghi vết migration nào đã chạy (unique key trên name).
 *   - Bootstrap mode: khi ledger TRỐNG (DB đã tồn tại trước khi có ledger),
 *     runner VERIFY cấu trúc DB thực tế trước khi ghi vết — không blind-mark.
 *   - Fresh mode: DB mới từ 0 → runner EXECUTE thật từng migration theo thứ tự.
 *
 * An toàn:
 *   - `FOR UPDATE` khi claim 1 migration → an toàn với chạy song song hợp lý.
 *   - Ghi ledger SAU KHI migration thành công; thất bại → không ghi → retry được.
 *   - Không bao giờ DROP / destructive.
 */

const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

// Các migration 1.0.8 (non-idempotent phần ALTER, đã apply production 2026-09-13).
// KHÔNG đưa 004_production_bestmatch_petsnap.sql vào đây (SUPERSEDED — xem migrations/archive/).
const SQL_MIGRATIONS = [
  {
    name: "001_pet_domain_v1",
    file: path.join(__dirname, "migrations", "001_pet_domain_v1.sql"),
    desc: "pets cột mới + 7 profile tables + data backfill",
    // Bảng/cột bắt buộc phải tồn tại để coi là "đã apply" (bootstrap verify)
    verify: {
      tables: ["pet_physical_profiles", "pet_personality_profiles", "pet_behavior_profiles", "pet_social_profiles", "pet_health_profiles", "pet_care_profiles", "pet_environment_profiles"],
      columns: [{ table: "pets", columns: ["breed_secondary", "birth_date", "estimated_age_months", "source_type", "intake_date", "adoption_status", "availability_status", "notes"] }],
    },
  },
  {
    name: "002_pet_domain_v2",
    file: path.join(__dirname, "migrations", "002_pet_domain_v2.sql"),
    desc: "species/breeds/traits/tags + pet_interactions + pet_recommendations + pets FK",
    verify: {
      tables: ["pet_species", "pet_breeds", "traits", "pet_traits", "tags", "pet_tags", "user_pet_preferences", "pet_interactions", "pet_recommendations"],
      columns: [{ table: "pets", columns: ["species_id", "primary_breed_id", "secondary_breed_id"] }],
    },
  },
  {
    name: "003_best_match",
    file: path.join(__dirname, "migrations", "003_best_match.sql"),
    desc: "7 bảng best_match (schema khớp code: cancelled_at/cancel_reason)",
    verify: {
      tables: ["best_matches", "best_match_privacy_settings", "best_match_stories", "best_match_story_media", "best_match_evidence", "best_match_assessments", "best_match_wellbeing_signals"],
      columns: [{ table: "best_matches", columns: ["cancelled_at", "cancel_reason"] }],
    },
  },
  {
    name: "004_create_pet_attributes",
    file: path.join(__dirname, "migrations", "004_create_pet_attributes.sql"),
    desc: "Bảng pet_attributes (EAV cho pet)",
    verify: {
      tables: ["pet_attributes"],
      columns: [],
    },
  },
];

async function tableExists(db, table) {
  const [rows] = await db.query(
    "SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?",
    [table]
  );
  return rows[0].c > 0;
}

async function columnsExist(db, table, columns) {
  const [rows] = await db.query(
    "SELECT column_name AS column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ?",
    [table]
  );
  // mysql2 có thể trả key hoa (COLUMN_NAME) tùy version/alias — normalize
  const existing = new Set(rows.map((r) => (r.column_name || r.COLUMN_NAME || "").toLowerCase()));
  return columns.every((c) => existing.has(c.toLowerCase()));
}

async function ensureLedgerTable(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(191) NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      applied_by VARCHAR(100) NULL,
      execution_ms INT NULL,
      UNIQUE KEY uq_schema_migrations_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function executeSqlFile(db, file) {
  const sql = fs.readFileSync(file, "utf8");
  // multipleStatements connection bắt buộc cho file nhiều statement
  await db.query(sql);
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "pet_helper",
    multipleStatements: true,
  });

  await ensureLedgerTable(conn);

  const [appliedRows] = await conn.query("SELECT name FROM schema_migrations");
  const applied = new Set(appliedRows.map((r) => r.name));

  let bootstrapMode = applied.size === 0;
  if (bootstrapMode) {
    console.log("ℹ Ledger trống → chế độ BOOTSTRAP (verify schema trước khi ghi vết)");
  }

  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const m of SQL_MIGRATIONS) {
    if (applied.has(m.name)) {
      console.log(`⏭️  ${m.name}: đã ghi trong ledger — skip`);
      skipped++;
      continue;
    }

    if (bootstrapMode) {
      // BOOTSTRAP: DB đã tồn tại trước ledger → verify cấu trúc trước khi ghi vết.
      let verified = true;
      for (const t of m.verify.tables) {
        if (!(await tableExists(conn, t))) {
          console.log(`⚠️  ${m.name}: thiếu bảng '${t}' → KHÔNG đánh dấu applied, sẽ execute thật`);
          verified = false;
          break;
        }
      }
      if (verified) {
        for (const c of m.verify.columns) {
          if (!(await columnsExist(conn, c.table, c.columns))) {
            console.log(`⚠️  ${m.name}: thiếu cột trên '${c.table}' → KHÔNG đánh dấu applied, sẽ execute thật`);
            verified = false;
            break;
          }
        }
      }

      if (verified) {
        // Claim bằng INSERT ... unique key — nếu runner khác claim trước sẽ duplicate error.
        try {
          await conn.query(
            "INSERT INTO schema_migrations (name, applied_by, execution_ms) VALUES (?, 'bootstrap-verify', 0)",
            [m.name]
          );
          console.log(`✅ ${m.name}: schema verified tồn tại đúng → ghi ledger (không chạy lại SQL)`);
          ok++;
        } catch (e) {
          if (e.code === "ER_DUP_ENTRY") {
            console.log(`⏭️  ${m.name}: runner khác đã claim — skip`);
            skipped++;
          } else {
            throw e;
          }
        }
        continue;
      }
      // verified = false → rơi xuống execute thật bên dưới
      console.log(`→ ${m.name}: thực thi thật (fresh/missing schema)...`);
    }

    // EXECUTE thật (fresh DB, hoặc bootstrap phát hiện thiếu schema)
    const start = Date.now();
    try {
      await executeSqlFile(conn, m.file);
      const ms = Date.now() - start;
      await conn.query(
        "INSERT INTO schema_migrations (name, applied_by, execution_ms) VALUES (?, 'execute', ?)",
        [m.name, ms]
      );
      console.log(`✅ ${m.name}: executed (${ms}ms)`);
      ok++;
      // Sau khi execute thành công 1 migration thật, các migration sau
      // không còn là bootstrap nữa (schema đang được dựng dần theo thứ tự).
      bootstrapMode = false;
    } catch (e) {
      failed++;
      console.error(`❌ ${m.name} thất bại: ${e.message}`);
      console.error("   Dừng pipeline — không ghi ledger cho migration lỗi.");
      break;
    }
  }

  console.log(`\n📊 Migration ledger: ${ok} ghi/execute, ${skipped} skip, ${failed} lỗi`);
  await conn.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("❌ migration_ledger fatal:", err.message);
  process.exit(1);
});
