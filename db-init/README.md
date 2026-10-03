# db-init — khởi tạo database lần đầu

Thư mục này được mount vào `/docker-entrypoint-initdb.d` của container MySQL.

## Quan trọng

- Script chỉ chạy **một lần duy nhất**, khi volume `db_data` **còn trống**.
- Không dùng cơ chế này để cập nhật schema cho DB đang chạy — việc đó do
  service `migrate` (`node database/migrate-all.js`) đảm nhiệm.

## Vì sao phải dùng dump thay vì `schema.sql`?

`backend/database/schema.sql` **không đủ** để dựng DB mới từ 0. Các bảng nền
như `adoption_requests` (được `001`, `003_best_match.sql` và
`run-migration.js` tham chiếu bằng khóa ngoại) **không được tạo ở bất kỳ file
SQL nào trong repo**. Vì vậy `schema.sql` + migrations sẽ lỗi trên DB trống.

Cách đúng: phục hồi từ dump của DB production hiện tại.

## Cách tạo dump (trên máy đang có DB)

Từ `backend/` (điều chỉnh host/port/user cho đúng):

```bash
mysqldump --host=<host> --port=<port> --user=<user> -p \
  --default-character-set=utf8mb4 --single-transaction --routines --triggers \
  --databases pet_helper > pet_helper_dump.sql
```

Repo cũng có sẵn script:
- `backend/scripts/backup_production.js` — dump + metadata SHA-256.
- `backend/scripts/backup-xampp.ps1` — dump từ XAMPP.

## Đặt file vào đây

Sao chép dump vào thư mục này và đặt tên để chạy trước, ví dụ:

```
db-init/
  01_pet_helper_dump.sql
```

Trên máy đích, trước lần `up` đầu tiên, thư mục phải tồn tại cùng cấp với
`docker-compose.prod.yml`.

> Nếu volume `db_data` đã có dữ liệu, các file trong `db-init/` **bị bỏ qua**.
> Muốn nạp lại phải xóa volume — chỉ làm khi thực sự muốn xóa toàn bộ DB.
