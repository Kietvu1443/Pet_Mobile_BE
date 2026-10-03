# DEPLOYMENT — Pet Helper (Pet_Mobile_BE)

Tài liệu đóng gói & triển khai bằng Docker image sang thiết bị khác.

## 1. Kiến trúc

| Thành phần | Image | Ghi chú |
|---|---|---|
| `app` | `pet-helper-app:<tag>` (build từ repo) | Express + frontend tĩnh |
| `migrate` | **cùng image** với `app` | Chạy `node database/migrate-all.js`, xong rồi thoát |
| `db` | `mysql:8.0` | Volume `db_data`; **không** publish port |

- `migrate` chạy **trước** `app` (`depends_on: service_completed_successfully`).
- MySQL **chỉ** nằm trong Docker network, không publish ra host/public.
- **Không** có phpMyAdmin ở production. Quản trị DB bằng DBeaver qua SSH tunnel.

## 2. Điểm cần biết trước khi triển khai

1. **Build context là thư mục gốc `Pet_Mobile_BE/`**, không phải `backend/`.
   Express serve frontend qua `../frontend`, nên image phải chứa cả
   `/app/backend` và `/app/frontend`.
2. **DB mới không tự dựng đủ từ repo.** `backend/database/schema.sql` thiếu các
   bảng nền (`adoption_requests`, ...). Phải nạp dump của DB production thật
   (xem `db-init/README.md`).
3. **`migrate` dùng env của `.env.production`**, không đọc `.env` trong repo.
   `DB_HOST=db`, `DB_PORT=3306`.
4. **Ảnh dùng Cloudinary** ở production. Điền đủ `CLOUDINARY_*`; nếu thiếu, upload sẽ lỗi.
5. **Chưa quyết định domain/HTTPS** → không hardcode. Xem mục 7.

## 3. Build & export (máy BUILD)

Từ thư mục `Pet_Mobile_BE/`:

```bash
# 1. Chuẩn bị env cho compose interpolation
cp .env.production.example .env.production   # rồi điền giá trị

# 2. Build image (chọn --platform theo CPU máy đích)
docker build --platform linux/amd64 -t pet-helper-app:1.0.0 .
# hoặc: --platform linux/arm64  (Raspberry Pi / ARM)

# 3. (Tuỳ chọn) chạy thử toàn stack tại máy build
docker compose --env-file .env.production build
docker compose --env-file .env.production up -d

# 4. Export image
docker save pet-helper-app:1.0.0 -o pet-helper-app-1.0.0.tar
```

> `docker save` giữ kiến trúc của máy build. Nếu máy đích khác kiến trúc, PHẢI
> build với `--platform` tương ứng (hoặc dùng buildx multi-arch).

## 4. Chuyển sang máy đích

Chuyển **đủ** các artifact sau (không chỉ image tar):

| # | Artifact | Bắt buộc | Ghi chú |
|---|---|---|---|
| 1 | `pet-helper-app-1.0.0.tar` | ✔ | image |
| 2 | `docker-compose.prod.yml` | ✔ | không chứa `build:` |
| 3 | `.env.production` | ✔ | tạo riêng trên máy đích, chứa secret |
| 4 | `db-init/<dump>.sql` | ✔ (lần đầu) | chỉ chạy khi volume trống |

Không cần source code hay `Dockerfile` trên máy đích.

## 5. Khởi chạy trên máy đích

```bash
docker load -i pet-helper-app-1.0.0.tar

# đặt 3 file còn lại cùng một thư mục, rồi:
docker compose --env-file .env.production -f docker-compose.prod.yml up -d

docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

Thứ tự: `db` healthy → `migrate` exit 0 → `app` healthy.

## 6. DBeaver qua SSH tunnel (không mở MySQL ra Internet)

MySQL không publish port, nên không kết nối trực tiếp `host:3306`. Dùng SSH
tunnel tới **IP tĩnh của container db** trong Docker network.

Trong DBeaver → Connection → **SSH**:

| Trường | Giá trị |
|---|---|
| Host/IP | IP máy đích |
| Port | SSH port (mặc định 22) |
| User | user SSH có quyền |
| Auth | key hoặc password |

Tab **Main** (MySQL):

| Trường | Giá trị |
|---|---|
| Host | `${DB_STATIC_IP}` — mặc định `172.30.0.10` |
| Port | `3306` |
| Database | `pet_helper` |
| User / Password | `DB_USER` / `DB_PASSWORD` trong `.env.production` |

DBeaver sẽ forward qua SSH tới `172.30.0.10:3306` (địa chỉ này do máy đích
route tới Docker bridge). Không cần mở firewall/port MySQL.

Kiểm tra IP thực tế nếu đã đổi cấu hình:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml \
  exec db hostname -i
```

> SSH server phải cho phép TCP forwarding (mặc định `AllowTcpForwarding yes`).
> Nếu `DB_STATIC_IP`/`DOCKER_SUBNET` trùng network sẵn có, đổi trong
> `.env.production` rồi tạo lại network (xem mục 9).

## 7. Trước khi public app (TODO)

Hiện chưa chốt cách expose (domain + HTTPS / IP:port / LAN). Các mục cần hoàn
thiện trước khi public, **tất cả qua env — không sửa code/compose**:

1. **Domain + HTTPS**: thêm reverse proxy (chưa có trong repo, vd nginx/Caddy)
   và chứng chỉ TLS.
2. **PASSKEY_RP_ID / PASSKEY_ORIGIN**: đặt đúng domain/origin thật
   (`PASSKEY_RP_ID` không scheme, `PASSKEY_ORIGIN` có scheme + port).
3. **Cookie `secure`**: khi `NODE_ENV=production` và `PASSKEY_ORIGIN` không chứa
   `localhost`, `app.js` bật `cookie.secure=true` → **bắt buộc HTTPS**, nếu không
   session/WebAuthn sẽ lỗi.
4. **Turnstile**: đặt key thật, `TURNSTILE_USE_TEST_KEYS=false`.
5. **OAuth redirect URI**: cập nhật Google/Facebook console theo domain thật.
6. **Firewall**: chỉ mở port app + SSH; không mở MySQL.

## 8. Validation

Chạy trên máy đích, với `COMPOSE="docker compose --env-file .env.production -f docker-compose.prod.yml"`.

1. **Cấu hình hợp lệ**
   ```bash
   $COMPOSE config
   ```
2. **Trạng thái service**
   ```bash
   $COMPOSE ps          # db healthy, app healthy, migrate exited 0
   ```
3. **Health endpoint**
   ```bash
   $COMPOSE exec app wget -qO- http://127.0.0.1:3000/api/v1/health
   ```
   → JSON `{"status":"ok",...}` (endpoint này **không** kiểm tra DB).
4. **API kết nối DB** (chứng minh DB thật sự dùng được)
   ```bash
   curl -s http://localhost:3000/api/v1/pets | head -c 300
   $COMPOSE exec db mysql -uroot -p"$DB_PASSWORD" pet_helper -e "SHOW TABLES;" | head
   ```
5. **Static assets** (chứng minh frontend được copy đúng vào image)
   ```bash
   curl -sI http://localhost:3000/pages/index.html   # 200
   curl -sI http://localhost:3000/stylesheets/style.css  # 200
   ```
6. **Cloudinary upload**: đăng nhập admin → upload ảnh pet → URL trả về phải là
   `res.cloudinary.com` (không ghi local).
7. **Restart bền vững**
   ```bash
   $COMPOSE restart app     # app healthy trở lại, dữ liệu còn
   $COMPOSE down            # KHÔNG dùng -v
   $COMPOSE up -d           # dữ liệu vẫn còn
   ```

> ⚠️ **KHÔNG chạy `docker compose down -v`** trên dữ liệu cần giữ — lệnh này xóa
> volume `db_data` và toàn bộ DB.

## 9. Vận hành

- **Xem log**: `$COMPOSE logs -f app` / `$COMPOSE logs migrate` / `$COMPOSE logs db`
- **Chạy lại migration** (idempotent/ledger-safe):
  `$COMPOSE run --rm migrate`
- **Backup DB**:
  ```bash
  $COMPOSE exec -T db mysqldump -uroot -p"$DB_PASSWORD" --single-transaction \
    --routines --triggers --databases pet_helper > backup_$(date +%F).sql
  ```
- **Đổi subnet/static IP**: sửa `DOCKER_SUBNET`/`DB_STATIC_IP` trong `.env.production`,
  rồi:
  ```bash
  $COMPOSE down
  docker network rm pet_mobile_be_pet_helper_net   # tên có thể khác theo project
  $COMPOSE up -d
  ```
  (Không ảnh hưởng volume `db_data`.)

## 10. Ghi chú nội bộ

- File `backend/Dockerfile.deprecated` và `backend/docker-compose.yml.deprecated`
  là bản cũ (build context `backend/` → thiếu frontend). Không dùng.
- Node runtime: **Node.js 22** (alpine), dependencies tương thích.
- Healthcheck dùng `wget` (busybox có sẵn trong `node:*-alpine`), không cần `curl`.
