# Database Migrations — Pet_Mobile_BE

## Migration Order (bắt buộc)

Thứ tự áp dụng cho **DB mới từ 0**:

```
1. backend/database/schema.sql                          — schema gốc (users, pets, adoption_requests, ...)
2. node backend/database/run-migration.js               — base: user_connections, user_passkeys, pet_returns,
                                                          notifications, shelters, user_devices, pet_scans,
                                                          housing_reviews... + ALTER users/housing_reviews
3. node backend/database/initCollections.js             — pet_collections, pet_collection_items
4. node backend/database/initNotes.js                   — pet_notes
5. node backend/database/initSuperlike.js               — pet_likes.status ENUM('liked','passed','superliked') + index
6. node backend/database/user_pets_migration.js         — user_pets, user_pet_images
7. node backend/database/places_migration.js            — places, place_reviews, moderation_reports
8. migrations/001_pet_domain_v1.sql                     — (SQL, chạy 1 LẦN) pets +8 cột, 7 bảng pet_*_profiles, data backfill
9. migrations/002_pet_domain_v2.sql                     — (SQL, chạy 1 LẦN) pet_species/breeds/traits/tags,
                                                          pet_interactions, pet_recommendations, pets +3 cột + FK
10. migrations/003_best_match.sql                       — (SQL, chạy 1 LẦN) 7 bảng best_match
11. migrations/004_create_pet_attributes.sql            — (SQL, chạy 1 LẦN) pet_attributes
```

Cách chạy nhanh (bước 2-7 tự động):

```bash
node backend/database/migrate-all.js     # hoặc: npm run migrate --prefix backend
```

## Dependency giữa 001 và 002

**002 bắt buộc chạy sau 001.**

- `002` thêm cột `secondary_breed_id` vào `pets` với `AFTER breed_secondary` — cột này do `001` tạo.
- `002` tham chiếu `pet_interactions` tự tạo, nhưng FK `adoption_requests` (từ schema gốc).
- Chạy `002` trước `001` sẽ lỗi "Unknown column 'breed_secondary'".

`004_create_pet_attributes` chỉ phụ thuộc `pets(id)` — có thể chạy bất kỳ lúc nào sau `schema.sql`, nhưng đặt cuối để giữ đúng thứ tự đánh số.

## Non-idempotent statements (chạy lại sẽ LỖI)

Các file SQL sau có `ALTER TABLE ... ADD COLUMN` **không idempotent** — chạy lần 2 sẽ fail
"Duplicate column" (đã verify thực tế 2026-09-13):

| File | Statement không idempotent |
|---|---|
| `001_pet_domain_v1.sql` | 1 block ALTER pets — 8 cột: `breed_secondary, birth_date, estimated_age_months, source_type, intake_date, adoption_status, availability_status, notes` |
| `002_pet_domain_v2.sql` | 3 block ALTER pets — 3 cột (`species_id, primary_breed_id, secondary_breed_id`), 3 FK, 3 index |

Phần `INSERT ... SELECT ... ON DUPLICATE KEY UPDATE` trong 001 là idempotent (data backfill).
Phần `CREATE TABLE IF NOT EXISTS` trong cả 5 file là idempotent.

## Migration Ledger (`schema_migrations`)

Từ release sau 1.0.8, các SQL migration 001–004 được quản lý bởi
`database/migration_ledger.js` (được gọi đầu tiên trong `migrate-all.js`):

- Bảng `schema_migrations` ghi vết: `name` (UNIQUE), `applied_at`, `applied_by`, `execution_ms`.
- **Bootstrap mode** (ledger trống = DB đã tồn tại trước khi có ledger): runner **verify cấu trúc
  thực tế** (bảng + cột) trước khi ghi vết — không blind-mark. Nếu thiếu schema → execute thật.
- **Fresh mode** (DB mới từ 0): runner **execute thật** 001 → 002 → 003 → 004 theo thứ tự.
- Unique key `uq_schema_migrations_name` + flow "migrate trước, ghi ledger sau" → retry an toàn;
  runner chạy song song chỉ có 1 instance claim được (duplicate entry → skip).
- `004_production_bestmatch_petsnap.sql` KHÔNG nằm trong ledger/chain — xem mục Archived.

### Bootstrap existing production DB

Production đã apply 001–004 thủ công (2026-09-13) trước khi có ledger. Lần chạy
`migrate-all.js` đầu tiên sau khi deploy PR này sẽ tự: ledger trống → bootstrap mode →
verify schema thực tế → ghi `applied_by = 'bootstrap-verify'`. **Không chạy lại SQL** —
không rủi ro "Duplicate column".

Đã verify trên production 2026-09-13: ledger ghi đủ 4 migration, chạy lại → all skip.

### Tạo DB mới từ 0

1. Tạo database + user, set `.env` (DB_HOST/DB_USER/DB_PASSWORD/DB_NAME).
2. `mysql -u <user> -p <db> < backend/database/schema.sql`
3. `npm run migrate --prefix backend`
   - `migration_ledger.js` thấy ledger trống → bootstrap mode → verify schema (thiếu) →
     **execute thật** 001 → 002 → 003 → 004 theo đúng thứ tự.
   - Sau đó `run-migration.js` + các init scripts chạy như thường.
4. (Tuỳ chọn) `npm run seed:demo-places --prefix backend` — data demo places.

## Archived migration — KHÔNG CHẠY

`archive/004_production_bestmatch_petsnap.sql` — **SUPERSEDED, DO NOT RUN.**

Lý do: schema `best_matches` trong file này khác với schema do `003_best_match.sql` tạo
(003 dùng `cancelled_at`/`cancel_reason` khớp code hiện tại; file này dùng
`ended_at`/`source`/`notes` — code không sử dụng). File từng là bản "consolidated
production-safe" trước khi 002/003 vào production; hiện tại nó là no-op trên production
nhưng sẽ tạo **schema sai so với code** nếu chạy trên DB mới. Chi tiết xem header file.

## Quy ước migration mới

1. Tạo file `database/migrations/NNN_tên.sql` với số thứ tự tiếp theo.
2. **Luôn idempotent nếu có thể** (`CREATE TABLE IF NOT EXISTS`, check information_schema
   trước `ADD COLUMN`, hoặc dùng ledger).
3. Thêm entry vào `SQL_MIGRATIONS` trong `database/migration_ledger.js` (name, file,
   verify tables/columns).
4. Cập nhật README.md này (order + dependency).
5. `004_production_bestmatch_petsnap.sql` là ví dụ về việc KHÔNG nên làm: hai file cùng
   số `004` với schema khác nhau cho cùng bảng.

## Trạng thái production (2026-09-13)

- Toàn bộ migration 1–11 ở mục "Migration Order" **đã apply**.
- Ledger `schema_migrations` đã bootstrap: 001, 002, 003, 004_create_pet_attributes.
- Tổng số bảng: 63 (gồm 64 table ledger).
